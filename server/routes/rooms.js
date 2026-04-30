import { Hono } from 'hono'
import { and, desc, eq, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { customAlphabet } from 'nanoid'
import { db } from '../db/index.js'
import { rooms, roms, users, STATUS } from '../db/schema.js'
import { requireAuth, currentUser } from '../middleware/auth.js'
import { getSetting } from './settings.js'
import { isHostOnline } from '../room-hub.js'

const liveRoom = (extra) =>
  extra ? and(eq(rooms.status, STATUS.normal), isNull(rooms.closedAt), extra)
        : and(eq(rooms.status, STATUS.normal), isNull(rooms.closedAt))

// 6-char alphanumeric codes, unambiguous (no 0/O/1/I/L)
const makeCode = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 6)

const createSchema = z.object({
  name: z.string().min(1).max(60),
  romId: z.number().int().positive(),
  isPublic: z.boolean().default(true),
  allowPlay: z.boolean().default(true),
  password: z.string().min(0).max(64).optional(),
})

export const roomRoutes = new Hono()

function serializeRoom(row, extras = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isPublic: Boolean(row.isPublic),
    allowPlay: row.allowPlay === undefined ? true : Boolean(row.allowPlay),
    hasPassword: !!row.passwordHash,
    hostUserId: row.hostUserId,
    romId: row.romId,
    createdAt: row.createdAt,
    ...extras,
  }
}

// List open public rooms with basic info
roomRoutes.get('/', async (c) => {
  const rows = await db.select({
    r: rooms,
    hostUsername: users.username,
    romTitle: roms.title,
    romPlatform: roms.platform,
  })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostUserId))
    .innerJoin(roms, eq(roms.id, rooms.romId))
    .where(liveRoom(eq(rooms.isPublic, true)))
    .orderBy(desc(rooms.createdAt))

  return c.json({
    rooms: rows.map(({ r, hostUsername, romTitle, romPlatform }) =>
      serializeRoom(r, {
        hostUsername, romTitle, romPlatform,
        hostOnline: isHostOnline(r.code),
      }),
    ),
  })
})

// List all OPEN rooms the current user hosts (public + private)
roomRoutes.get('/mine', requireAuth, async (c) => {
  const me = c.get('user')
  const rows = await db.select({
    r: rooms,
    romTitle: roms.title,
    romPlatform: roms.platform,
  })
    .from(rooms)
    .innerJoin(roms, eq(roms.id, rooms.romId))
    .where(liveRoom(eq(rooms.hostUserId, me.id)))
    .orderBy(desc(rooms.createdAt))
  return c.json({
    rooms: rows.map(({ r, romTitle, romPlatform }) =>
      serializeRoom(r, {
        hostUsername: me.username, romTitle, romPlatform,
        hostOnline: isHostOnline(r.code),
      }),
    ),
  })
})

// Create room (must be authed; rom must be accessible to user)
roomRoutes.post('/', requireAuth, async (c) => {
  const me = c.get('user')
  // Honor global netplay kill-switch (admins bypass)
  if (me.role !== 'admin' && (await getSetting('netplayEnabled', '1')) !== '1') {
    return c.json({ error: '管理员已关闭对战功能' }, 403)
  }
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: '参数不合法' }, 400)
  const { name, romId, isPublic, allowPlay, password } = parsed.data

  const rom = (await db.select().from(roms).where(eq(roms.id, romId)).limit(1))[0]
  if (!rom) return c.json({ error: 'ROM 不存在' }, 404)
  if (rom.userId !== me.id && !rom.isPublic && me.role !== 'admin') {
    return c.json({ error: '无权使用该 ROM' }, 403)
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null

  // try a few times in case of a code collision
  let code, inserted
  for (let i = 0; i < 5; i++) {
    code = makeCode()
    try {
      [inserted] = await db.insert(rooms).values({
        code,
        hostUserId: me.id,
        romId,
        name: name.trim(),
        isPublic,
        allowPlay,
        passwordHash,
      }).returning()
      break
    } catch (err) {
      if (i === 4) throw err
    }
  }

  return c.json(serializeRoom(inserted, { hostUsername: me.username }))
})

// Fetch room info by code (public endpoint; validates password if provided)
roomRoutes.post('/:code/join', async (c) => {
  const code = c.req.param('code').toUpperCase()
  const body = await c.req.json().catch(() => ({}))
  const password = typeof body?.password === 'string' ? body.password : ''

  const row = (await db.select({
    r: rooms,
    hostUsername: users.username,
    romTitle: roms.title,
    romPlatform: roms.platform,
  })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostUserId))
    .innerJoin(roms, eq(roms.id, rooms.romId))
    .where(eq(rooms.code, code))
    .limit(1))[0]

  if (!row || row.r.closedAt || row.r.status !== STATUS.normal) return c.json({ error: '房间不存在或已关闭' }, 404)

  if (row.r.passwordHash) {
    if (!password) return c.json({ error: '此房间需要密码', needsPassword: true }, 401)
    const ok = await bcrypt.compare(password, row.r.passwordHash)
    if (!ok) return c.json({ error: '密码不正确' }, 401)
  }

  // Block guests from entering when the host isn't currently connected.
  // The host themselves can always re-enter (their socket re-creates the
  // in-memory hub entry).
  const me = await currentUser(c)
  const isHost = me && me.id === row.r.hostUserId
  if (!isHost && !isHostOnline(code)) {
    return c.json({ error: '房主不在线，请稍后再试', hostOffline: true }, 503)
  }

  return c.json(serializeRoom(row.r, {
    hostUsername: row.hostUsername,
    romTitle: row.romTitle,
    romPlatform: row.romPlatform,
    hostOnline: isHostOnline(code),
  }))
})

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  romId: z.number().int().positive().optional(),
  isPublic: z.boolean().optional(),
  allowPlay: z.boolean().optional(),
  // password: null clears, '' is treated as null, otherwise sets new hash
  password: z.union([z.string().max(64), z.null()]).optional(),
})

// Update room (host or admin)
roomRoutes.patch('/:code', requireAuth, async (c) => {
  const me = c.get('user')
  const code = c.req.param('code').toUpperCase()
  const row = (await db.select().from(rooms).where(eq(rooms.code, code)).limit(1))[0]
  if (!row || row.status !== STATUS.normal) return c.json({ error: '房间不存在' }, 404)
  if (row.closedAt) return c.json({ error: '房间已关闭' }, 410)
  if (row.hostUserId !== me.id && me.role !== 'admin') {
    return c.json({ error: '无权修改该房间' }, 403)
  }
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: '参数不合法' }, 400)

  const patch = {}
  if (typeof parsed.data.name === 'string') patch.name = parsed.data.name.trim()
  if (typeof parsed.data.isPublic === 'boolean') patch.isPublic = parsed.data.isPublic
  if (typeof parsed.data.allowPlay === 'boolean') patch.allowPlay = parsed.data.allowPlay
  if (typeof parsed.data.romId === 'number' && parsed.data.romId !== row.romId) {
    const rom = (await db.select().from(roms).where(eq(roms.id, parsed.data.romId)).limit(1))[0]
    if (!rom) return c.json({ error: 'ROM 不存在' }, 404)
    if (rom.userId !== me.id && !rom.isPublic && me.role !== 'admin') {
      return c.json({ error: '无权使用该 ROM' }, 403)
    }
    patch.romId = parsed.data.romId
  }
  if ('password' in parsed.data) {
    const pw = parsed.data.password
    patch.passwordHash = (pw === null || pw === '') ? null : await bcrypt.hash(pw, 10)
  }
  if (Object.keys(patch).length === 0) {
    const rom = (await db.select().from(roms).where(eq(roms.id, row.romId)).limit(1))[0]
    return c.json(serializeRoom(row, { romTitle: rom?.title, romPlatform: rom?.platform, hostUsername: me.username }))
  }

  const [updated] = await db.update(rooms).set(patch).where(eq(rooms.code, code)).returning()
  const rom = (await db.select().from(roms).where(eq(roms.id, updated.romId)).limit(1))[0]
  return c.json(serializeRoom(updated, { romTitle: rom?.title, romPlatform: rom?.platform, hostUsername: me.username }))
})

// Close a room (host or admin)
roomRoutes.delete('/:code', requireAuth, async (c) => {
  const me = c.get('user')
  const code = c.req.param('code').toUpperCase()
  const row = (await db.select().from(rooms).where(eq(rooms.code, code)).limit(1))[0]
  if (!row) return c.json({ error: '房间不存在' }, 404)
  if (row.hostUserId !== me.id && me.role !== 'admin') {
    return c.json({ error: '无权关闭该房间' }, 403)
  }
  await db.update(rooms)
    .set({ closedAt: new Date(), status: STATUS.deleted })
    .where(eq(rooms.code, code))
  return c.json({ ok: true })
})
