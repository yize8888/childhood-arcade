// In-memory room hub. Tracks live peers + their websockets and routes
// signaling traffic between them. The canonical room record lives in SQLite
// (server/db/schema.js:rooms); this module only mirrors transient presence.
//
// Lifecycle policy: rooms in the DB are NEVER auto-closed when the host
// disconnects. The room-record lives until the host (or an admin) explicitly
// closes it via the API. Instead, when a guest tries to join while the host
// is offline, the join handler returns a 'host-offline' error so the guest
// gets a clear message. Existing peers in a room keep their socket but see
// the host as `peer-left(reconnecting:true)` indefinitely until host returns.

import { nanoid } from 'nanoid'

// roomCode → { code, hostUserId, peers: Map<peerId, Peer>, chatHistory: [...] }
const rooms = new Map()

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)) } catch {}
}

export function ensureRoom(code, row) {
  let r = rooms.get(code)
  if (!r) {
    r = { code, hostUserId: row.hostUserId, peers: new Map(), chatHistory: [] }
    rooms.set(code, r)
  }
  return r
}

export function isHostOnline(code) {
  const room = rooms.get(code)
  if (!room) return false
  for (const p of room.peers.values()) if (p.isHost) return true
  return false
}

export function addPeer(code, { user, ws }) {
  const room = rooms.get(code)
  if (!room) return null

  // Authed users: dedupe any ghost socket from the same user id (page refresh
  // race). Anonymous spectators are never deduped because they have no stable
  // id — each tab is its own peer.
  if (user?.id) {
    for (const existing of [...room.peers.values()]) {
      if (existing.userId === user.id) {
        try { existing.ws.close(4000, 'superseded') } catch {}
        removePeer(code, existing.id)
      }
    }
  }

  const peerId = nanoid(8)
  const userId = user?.id ?? null
  const username = user?.username ?? `访客-${peerId.slice(0, 4)}`
  const isHost = userId != null && userId === room.hostUserId
  const isGuest = !userId
  const peer = { id: peerId, userId, username, isHost, isGuest, ws }
  room.peers.set(peerId, peer)

  // Welcome the new peer with its id + current peer list
  send(ws, {
    type: 'welcome',
    peerId,
    isHost,
    peers: [...room.peers.values()].map(summary),
    chat: room.chatHistory.slice(-50),
  })
  // Broadcast arrival to everyone else
  for (const other of room.peers.values()) {
    if (other.id === peerId) continue
    send(other.ws, { type: 'peer-joined', peer: summary(peer) })
  }
  return peer
}

export function removePeer(code, peerId) {
  const room = rooms.get(code)
  if (!room) return
  const gone = room.peers.get(peerId)
  if (!gone) return
  room.peers.delete(peerId)

  // Notify remaining peers. If host went offline, surface `reconnecting:true`
  // so guests see "主机重连中…" rather than a hard "room closed" — the room
  // still exists, host can come back any time and we'll resume.
  for (const other of room.peers.values()) {
    send(other.ws, {
      type: 'peer-left',
      peerId,
      wasHost: gone.isHost,
      reconnecting: gone.isHost,
    })
  }

  // Drop the in-memory entry once everyone is gone. The DB record is kept
  // alive — host or admin must explicitly close the room from the UI.
  if (room.peers.size === 0) rooms.delete(code)
}

// Dispatch any inbound message from `fromPeerId`. Recognizes a small signaling
// vocabulary (offer/answer/ice directed to a specific peer, chat broadcast).
export function relay(code, fromPeerId, msg) {
  const room = rooms.get(code)
  if (!room) return
  const from = room.peers.get(fromPeerId)
  if (!from) return

  switch (msg.type) {
    case 'chat': {
      const text = String(msg.text || '').slice(0, 500)
      if (!text) return
      const entry = { from: from.id, fromName: from.username, text, at: Date.now() }
      room.chatHistory.push(entry)
      if (room.chatHistory.length > 200) room.chatHistory.shift()
      for (const peer of room.peers.values()) {
        send(peer.ws, { type: 'chat', ...entry })
      }
      return
    }
    case 'offer':
    case 'answer':
    case 'ice': {
      const target = room.peers.get(msg.to)
      if (!target) return
      const fwd = { ...msg, from: from.id }
      delete fwd.to
      send(target.ws, fwd)
      return
    }
    default:
      return
  }
}

function summary(peer) {
  return {
    id: peer.id,
    userId: peer.userId,
    username: peer.username,
    isHost: peer.isHost,
    isGuest: !!peer.isGuest,
  }
}
