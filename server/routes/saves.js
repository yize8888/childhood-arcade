import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { mkdirSync, unlinkSync, createReadStream, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { stream } from 'hono/streaming'
import { db } from '../db/index.js'
import { saveStates, roms, STATUS } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'

const liveSave = (extra) =>
  extra ? and(eq(saveStates.status, STATUS.normal), extra) : eq(saveStates.status, STATUS.normal)

const SAVES_DIR = resolve(process.env.SAVES_DIR || 'data/saves')
const MAX_STATE_BYTES = Number(process.env.MAX_STATE_BYTES) || 8 * 1024 * 1024 // 8 MB

export const saveRoutes = new Hono()

function serialize(row) {
  return {
    id: row.id,
    romId: row.romId,
    slot: row.slot,
    size: row.fileSize,
    updatedAt: row.updatedAt,
  }
}

// List all saves for the current user
saveRoutes.get('/mine', requireAuth, async (c) => {
  const me = c.get('user')
  const rows = await db.select().from(saveStates)
    .where(liveSave(eq(saveStates.userId, me.id)))
  return c.json({ saves: rows.map(serialize) })
})

// Get the save for a specific ROM + slot (returns binary blob)
saveRoutes.get('/:romId', requireAuth, async (c) => {
  const me = c.get('user')
  const romId = Number(c.req.param('romId'))
  const slot = Number(c.req.query('slot') || 0)
  const row = (await db.select().from(saveStates)
    .where(liveSave(and(eq(saveStates.userId, me.id), eq(saveStates.romId, romId), eq(saveStates.slot, slot))))
    .limit(1))[0]
  if (!row) return c.json({ error: '无存档' }, 404)

  let st
  try { st = statSync(row.filePath) }
  catch { return c.json({ error: '存档文件缺失' }, 404) }

  c.header('Content-Type', 'application/octet-stream')
  c.header('Content-Length', String(st.size))
  c.header('X-Save-Updated-At', String(row.updatedAt instanceof Date ? Math.floor(row.updatedAt.getTime()/1000) : row.updatedAt))
  return stream(c, async (s) => {
    const rs = createReadStream(row.filePath)
    await s.pipe(new ReadableStream({
      start(controller) {
        rs.on('data', (chunk) => controller.enqueue(chunk))
        rs.on('end', () => controller.close())
        rs.on('error', (err) => controller.error(err))
      },
    }))
  })
})

// Upload / overwrite save for a ROM + slot (body is raw binary)
saveRoutes.post('/:romId', requireAuth, async (c) => {
  const me = c.get('user')
  const romId = Number(c.req.param('romId'))
  const slot = Number(c.req.query('slot') || 0)

  // Validate ROM exists + accessible
  const rom = (await db.select().from(roms).where(eq(roms.id, romId)).limit(1))[0]
  if (!rom) return c.json({ error: 'ROM 不存在' }, 404)
  if (rom.userId !== me.id && !rom.isPublic && me.role !== 'admin') {
    return c.json({ error: '无权为该 ROM 存档' }, 403)
  }

  const buf = Buffer.from(await c.req.arrayBuffer())
  if (!buf.length) return c.json({ error: '空存档' }, 400)
  if (buf.length > MAX_STATE_BYTES) return c.json({ error: `存档超过 ${Math.round(MAX_STATE_BYTES/1024/1024)}MB` }, 413)

  const userDir = join(SAVES_DIR, String(me.id))
  mkdirSync(userDir, { recursive: true })
  const fileName = `${romId}.s${slot}.state`
  const filePath = join(userDir, fileName)
  await writeFile(filePath, buf)

  // Upsert DB row
  const existing = (await db.select().from(saveStates)
    .where(liveSave(and(eq(saveStates.userId, me.id), eq(saveStates.romId, romId), eq(saveStates.slot, slot))))
    .limit(1))[0]

  let row
  if (existing) {
    [row] = await db.update(saveStates)
      .set({ filePath, fileSize: buf.length, updatedAt: new Date() })
      .where(eq(saveStates.id, existing.id))
      .returning()
  } else {
    [row] = await db.insert(saveStates).values({
      userId: me.id, romId, slot, filePath, fileSize: buf.length,
    }).returning()
  }
  return c.json(serialize(row))
})

// Delete a save
saveRoutes.delete('/:romId', requireAuth, async (c) => {
  const me = c.get('user')
  const romId = Number(c.req.param('romId'))
  const slot = Number(c.req.query('slot') || 0)
  const row = (await db.select().from(saveStates)
    .where(liveSave(and(eq(saveStates.userId, me.id), eq(saveStates.romId, romId), eq(saveStates.slot, slot))))
    .limit(1))[0]
  if (!row) return c.json({ ok: true })
  try { unlinkSync(row.filePath) } catch {}
  await db.update(saveStates).set({ status: STATUS.deleted }).where(eq(saveStates.id, row.id))
  return c.json({ ok: true })
})
