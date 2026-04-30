// Hono websocket upgrade at /api/rooms/:code/ws — validates auth + room +
// password, then hands the socket off to room-hub for signaling relay.

import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { rooms, STATUS } from '../db/schema.js'
import { currentUser } from '../middleware/auth.js'
import { getSetting } from './settings.js'
import * as hub from '../room-hub.js'

export function installRoomsWebSocket(app, upgradeWebSocket) {
  app.get(
    '/api/rooms/:code/ws',
    upgradeWebSocket(async (c) => {
      const code = (c.req.param('code') || '').toUpperCase()
      const password = c.req.query('password') || ''
      const user = await currentUser(c)

      const row = (await db.select().from(rooms)
        .where(and(eq(rooms.code, code), eq(rooms.status, STATUS.normal)))
        .limit(1))[0]

      let peer = null
      let rejectReason = null

      // Global netplay kill-switch (admins bypass on their own rooms)
      const netplayEnabled = await getSetting('netplayEnabled', '1')
      // Anonymous guests are allowed in as spectators on public rooms — they
      // receive the host's video stream + chat but can't host or save state.
      // Private rooms still require the password (checked below regardless of
      // auth state); host/admin identity only matters for bypassing it.
      const isHostOrAdmin = !!user && (user.id === row?.hostUserId || user.role === 'admin')
      if (netplayEnabled !== '1' && user?.role !== 'admin') rejectReason = 'netplay-disabled'
      else if (!row || row.closedAt) rejectReason = 'room-not-found'
      else if (row.passwordHash && !isHostOrAdmin) {
        const ok = await bcrypt.compare(password, row.passwordHash)
        if (!ok) rejectReason = 'bad-password'
      }
      // Rooms persist after the host disconnects; everyone but the host joining
      // an empty room gets a clear error instead of an indefinite black wait.
      // Host themselves can always re-enter (they "wake" the room).
      else if (row && !(user && user.id === row.hostUserId) && !hub.isHostOnline(code)) {
        rejectReason = 'host-offline'
      }

      return {
        onOpen(_evt, ws) {
          if (rejectReason) {
            try { ws.send(JSON.stringify({ type: 'error', reason: rejectReason })) } catch {}
            ws.close()
            return
          }
          hub.ensureRoom(code, row)
          peer = hub.addPeer(code, { user, ws })
        },
        onMessage(evt, ws) {
          if (!peer) return
          let msg
          try {
            msg = typeof evt.data === 'string' ? JSON.parse(evt.data) : null
          } catch {
            return
          }
          if (!msg || typeof msg.type !== 'string') return
          hub.relay(code, peer.id, msg)
        },
        onClose() {
          if (peer) hub.removePeer(code, peer.id)
          peer = null
        },
        onError() {
          if (peer) hub.removePeer(code, peer.id)
          peer = null
        },
      }
    }),
  )
}
