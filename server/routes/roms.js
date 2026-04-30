import { Hono } from 'hono'
import { and, desc, eq, inArray, isNull, sql, or } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { mkdirSync, createReadStream, statSync, unlinkSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'
import { db } from '../db/index.js'
import { roms, users, favorites, STATUS } from '../db/schema.js'
import { requireAuth, currentUser } from '../middleware/auth.js'
import { stream } from 'hono/streaming'
import { getSetting } from './settings.js'

const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR || 'data/uploads')
const MAX_SIZE = Number(process.env.MAX_UPLOAD_BYTES) || 100 * 1024 * 1024
const ALLOWED_PLATFORMS = new Set([
  'arcade',
  'nes', 'famicom', 'fds', 'sfc', 'snes', 'gb', 'gbc', 'gba',
  'megadrive', 'genesis', 'sms', 'gamegear',
  'psx',
])

// Matches only live (non-soft-deleted) ROMs
const liveRom = (extra) => extra ? and(eq(roms.status, STATUS.normal), extra) : eq(roms.status, STATUS.normal)

export const romRoutes = new Hono()

function serialize(rom, owner, opts = {}) {
  return {
    id: rom.id,
    title: rom.title,
    platform: rom.platform,
    fileName: rom.fileName,
    fileSize: rom.fileSize,
    isPublic: Boolean(rom.isPublic),
    userId: rom.userId,
    owner: owner ? { id: owner.id, username: owner.username } : undefined,
    parentRomId: rom.parentRomId ?? null,
    versionLabel: rom.versionLabel ?? null,
    versionCount: opts.versionCount ?? undefined,
    isFavorite: !!opts.isFavorite,
    createdAt: rom.createdAt,
    updatedAt: rom.updatedAt,
  }
}

// Count child ROMs grouped by parent id — used to annotate parent listings
// with a "N 版本" badge in the Gallery.
async function childCountsFor(parentIds) {
  if (!parentIds.length) return new Map()
  const rows = await db
    .select({ parentRomId: roms.parentRomId, n: sql`count(*)`.as('n') })
    .from(roms)
    .where(and(eq(roms.status, STATUS.normal), inArray(roms.parentRomId, parentIds)))
    .groupBy(roms.parentRomId)
  const out = new Map()
  for (const r of rows) out.set(r.parentRomId, Number(r.n))
  return out
}

// Returns a Set<romId> of the current user's favorites, or null when anon.
async function favoriteSetFor(user, romIds) {
  if (!user || romIds.length === 0) return null
  const rows = await db.select({ romId: favorites.romId })
    .from(favorites)
    .where(and(eq(favorites.userId, user.id), inArray(favorites.romId, romIds)))
  return new Set(rows.map((r) => r.romId))
}

romRoutes.get('/mine', requireAuth, async (c) => {
  const user = c.get('user')
  // `/mine` returns everything the user uploaded (parents + children) so they
  // can manage variants from one place. Gallery filters children separately.
  const rows = await db.select().from(roms)
    .where(liveRom(eq(roms.userId, user.id)))
    .orderBy(desc(roms.createdAt))
  const favSet = await favoriteSetFor(user, rows.map((r) => r.id))
  const counts = await childCountsFor(rows.filter((r) => !r.parentRomId).map((r) => r.id))
  return c.json({ roms: rows.map((r) => serialize(r, null, {
    isFavorite: favSet?.has(r.id),
    versionCount: counts.get(r.id),
  })) })
})

// List the current user's soft-deleted ROMs — the "recycle bin" view.
// Ordered by updatedAt (most recently deleted first) so the newest go to top.
romRoutes.get('/trash', requireAuth, async (c) => {
  const user = c.get('user')
  const rows = await db.select().from(roms)
    .where(and(eq(roms.status, STATUS.deleted), eq(roms.userId, user.id)))
    .orderBy(desc(roms.updatedAt))
  return c.json({ roms: rows.map((r) => serialize(r, null)) })
})

// Restore a soft-deleted ROM (user-owned only, or admin). If the ROM is a
// child version whose parent is also deleted, the caller is responsible for
// restoring the parent first — otherwise the ROM would be orphaned.
romRoutes.post('/:id/restore', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rom = (await db.select().from(roms).where(eq(roms.id, id)).limit(1))[0]
  if (!rom) return c.json({ error: '不存在' }, 404)
  if (rom.userId !== user.id && user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  if (rom.status === STATUS.normal) return c.json({ ok: true })
  await db.update(roms).set({ status: STATUS.normal }).where(eq(roms.id, id))
  return c.json({ ok: true })
})

romRoutes.get('/public', async (c) => {
  // Only top-level parents show up in the public Gallery. Children are still
  // reachable via /api/roms/:parentId/versions for the version picker.
  const rows = await db.select({
    rom: roms,
    user: { id: users.id, username: users.username },
  })
    .from(roms)
    .innerJoin(users, eq(users.id, roms.userId))
    .where(liveRom(and(eq(roms.isPublic, true), isNull(roms.parentRomId))))
    .orderBy(desc(roms.createdAt))
  const me = await currentUser(c)
  const favSet = await favoriteSetFor(me, rows.map(({ rom }) => rom.id))
  const counts = await childCountsFor(rows.map(({ rom }) => rom.id))
  return c.json({ roms: rows.map(({ rom, user }) => serialize(rom, user, {
    isFavorite: favSet?.has(rom.id),
    versionCount: counts.get(rom.id),
  })) })
})

// List all versions (parent + children) for a given ROM id. Accepts either the
// parent's id or any child's id — in both cases returns the full family.
romRoutes.get('/:id/versions', async (c) => {
  const id = Number(c.req.param('id'))
  const seed = (await db.select().from(roms).where(liveRom(eq(roms.id, id))).limit(1))[0]
  if (!seed) return c.json({ versions: [] })
  const parentId = seed.parentRomId ?? seed.id
  const rows = await db.select({
    rom: roms,
    user: { id: users.id, username: users.username },
  })
    .from(roms)
    .innerJoin(users, eq(users.id, roms.userId))
    .where(liveRom(or(eq(roms.id, parentId), eq(roms.parentRomId, parentId))))
    .orderBy(roms.id)
  const me = await currentUser(c)
  return c.json({
    parentId,
    versions: rows
      .filter(({ rom }) => rom.isPublic || rom.userId === me?.id || me?.role === 'admin')
      .map(({ rom, user }) => serialize(rom, user)),
  })
})

// List the current user's favorited ROMs. Pulls any ROM they favorited that
// is still live AND they can access (their own ROM, or isPublic).
romRoutes.get('/favorites', requireAuth, async (c) => {
  const user = c.get('user')
  const rows = await db.select({
    rom: roms,
    user: { id: users.id, username: users.username },
  })
    .from(favorites)
    .innerJoin(roms, eq(roms.id, favorites.romId))
    .innerJoin(users, eq(users.id, roms.userId))
    .where(and(
      eq(favorites.userId, user.id),
      eq(roms.status, STATUS.normal),
    ))
    .orderBy(desc(favorites.createdAt))
  return c.json({
    roms: rows
      .filter(({ rom }) => rom.isPublic || rom.userId === user.id || user.role === 'admin')
      .map(({ rom, user: owner }) => serialize(rom, owner, { isFavorite: true })),
  })
})

romRoutes.post('/:id/favorite', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rom = (await db.select().from(roms).where(liveRom(eq(roms.id, id))).limit(1))[0]
  if (!rom) return c.json({ error: '不存在' }, 404)
  if (!rom.isPublic && rom.userId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403)
  }
  try {
    await db.insert(favorites).values({ userId: user.id, romId: id })
  } catch {
    // already favorited — primary-key conflict is fine
  }
  return c.json({ ok: true, isFavorite: true })
})

romRoutes.delete('/:id/favorite', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.romId, id)))
  return c.json({ ok: true, isFavorite: false })
})

romRoutes.post('/upload', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.parseBody({ all: false })
  const file = body.file
  if (!file || typeof file === 'string') return c.json({ error: '未收到文件' }, 400)
  if (file.size > MAX_SIZE) return c.json({ error: `文件超过 ${Math.round(MAX_SIZE / 1024 / 1024)}MB` }, 413)

  const platform = String(body.platform || '')
  if (!ALLOWED_PLATFORMS.has(platform)) return c.json({ error: '不支持的平台' }, 400)

  const titleSchema = z.string().min(1).max(128)
  const title = titleSchema.safeParse(String(body.title || '').trim() || file.name)
  if (!title.success) return c.json({ error: '标题格式不正确' }, 400)

  const isPublic = String(body.isPublic || '') === 'true'

  // Optional parent/version linkage. Parent must be an existing ROM the user
  // can see, on the same platform (arcade clone of arcade, etc).
  let parentRomId = null
  let versionLabel = null
  if (body.parentRomId) {
    const pid = Number(body.parentRomId)
    if (Number.isFinite(pid) && pid > 0) {
      const parent = (await db.select().from(roms).where(liveRom(eq(roms.id, pid))).limit(1))[0]
      if (!parent) return c.json({ error: '父 ROM 不存在' }, 400)
      if (parent.platform !== platform) return c.json({ error: '父 ROM 平台不匹配' }, 400)
      if (!parent.isPublic && parent.userId !== user.id && user.role !== 'admin') {
        return c.json({ error: '无权引用该父 ROM' }, 403)
      }
      if (parent.parentRomId) return c.json({ error: '不支持嵌套版本（父 ROM 本身是变体）' }, 400)
      parentRomId = pid
      const lbl = String(body.versionLabel || '').trim().slice(0, 64)
      versionLabel = lbl || '变体'
    }
  }

  const userDir = join(UPLOADS_DIR, String(user.id), platform)
  mkdirSync(userDir, { recursive: true })
  const safeExt = extname(file.name).replace(/[^\w.]/g, '').slice(0, 10) || '.bin'
  const storedName = `${randomUUID()}${safeExt}`
  const filePath = join(userDir, storedName)
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buf)

  const [row] = await db.insert(roms).values({
    userId: user.id,
    title: title.data,
    platform,
    fileName: file.name,
    filePath,
    fileSize: file.size,
    isPublic,
    parentRomId,
    versionLabel,
  }).returning()

  return c.json(serialize(row))
})

romRoutes.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(roms).where(liveRom(eq(roms.id, id))).limit(1)
  const rom = rows[0]
  if (!rom) return c.json({ error: '不存在' }, 404)
  if (rom.userId !== user.id && user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const patch = {}
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim()
  if (typeof body.isPublic === 'boolean') patch.isPublic = body.isPublic
  if (Object.keys(patch).length === 0) return c.json(serialize(rom))
  const [updated] = await db.update(roms).set(patch).where(eq(roms.id, id)).returning()
  return c.json(serialize(updated))
})

// DELETE /api/roms/:id
//   default:           soft-delete (status=deleted, file kept on disk for admin recovery)
//   ?permanent=1:      hard-delete — unlinks rom file + all save-state files,
//                      cascade-removes favorites/save_states/rooms rows,
//                      and also purges any child-version ROMs belonging to this
//                      parent (kof97 parent → also wipes kof97pls / kof97a).
romRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const permanent = c.req.query('permanent') === '1' || c.req.query('permanent') === 'true'

  // Hard-delete needs to find both live AND already-soft-deleted rows so admins
  // can purge the trash. Soft-delete path keeps the live-only filter.
  const finder = permanent
    ? db.select().from(roms).where(eq(roms.id, id))
    : db.select().from(roms).where(liveRom(eq(roms.id, id)))
  const rows = await finder.limit(1)
  const rom = rows[0]
  if (!rom) return c.json({ error: '不存在' }, 404)
  if (rom.userId !== user.id && user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)

  if (!permanent) {
    await db.update(roms).set({ status: STATUS.deleted }).where(eq(roms.id, id))
    return c.json({ ok: true, mode: 'soft' })
  }

  // Hard delete path
  const targets = [rom]
  // If this is a parent, grab the children too — parentRomId has no FK cascade,
  // so we must enumerate and wipe them manually.
  if (!rom.parentRomId) {
    const children = await db.select().from(roms).where(eq(roms.parentRomId, id))
    targets.push(...children)
  }

  // Purge on-disk artifacts first (rom files + save state blobs for each target)
  const { saveStates } = await import('../db/schema.js')
  for (const t of targets) {
    // save-state files
    const states = await db.select().from(saveStates).where(eq(saveStates.romId, t.id))
    for (const s of states) {
      try { unlinkSync(s.filePath) } catch {}
    }
    // the rom file itself
    try { unlinkSync(t.filePath) } catch {}
  }

  // DB: children first, then the parent. FK cascades remove favorites/save_states/rooms.
  for (const t of targets) {
    if (t.id !== rom.id) await db.delete(roms).where(eq(roms.id, t.id))
  }
  await db.delete(roms).where(eq(roms.id, rom.id))

  return c.json({ ok: true, mode: 'permanent', purgedCount: targets.length })
})

async function serveRomFile(c) {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(roms).where(liveRom(eq(roms.id, id))).limit(1)
  const rom = rows[0]
  if (!rom) return c.json({ error: 'not found' }, 404)

  // Gating: playing normally requires a logged-in account. Admins can opt in
  // to guest play via the `guestPlayEnabled` setting — anonymous visitors
  // then get to boot PUBLIC ROMs only (no save-states, no netplay; those
  // still require auth elsewhere).
  const user = await currentUser(c)
  if (!user) {
    const guestOk = (await getSetting('guestPlayEnabled', '0')) === '1'
    if (!guestOk) return c.json({ error: '请先登录' }, 401)
    if (!rom.isPublic) return c.json({ error: '该 ROM 非公开' }, 403)
  } else if (!rom.isPublic && user.id !== rom.userId && user.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403)
  }

  const st = statSync(rom.filePath)
  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(st.size))
  c.header('Content-Disposition', `inline; filename="${encodeURIComponent(rom.fileName)}"`)
  return stream(c, async (s) => {
    const fileStream = createReadStream(rom.filePath)
    await s.pipe(new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk))
        fileStream.on('end', () => controller.close())
        fileStream.on('error', (err) => controller.error(err))
      },
    }))
  })
}

romRoutes.get('/:id/file', serveRomFile)
// Alias with the filename as the last segment — lets FBNeo / MAME pick up the
// romset name from the URL (the :name segment is cosmetic, content comes from DB).
romRoutes.get('/:id/file/:name', serveRomFile)
