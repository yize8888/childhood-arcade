import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, roms, STATUS } from '../db/schema.js'
import { requireAdmin } from '../middleware/auth.js'

export const adminRoutes = new Hono()

adminRoutes.use('*', requireAdmin)

adminRoutes.get('/users', async (c) => {
  const rows = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users)
    .where(eq(users.status, STATUS.normal))
    .orderBy(desc(users.createdAt))
  return c.json({ users: rows })
})

// Soft-delete a user (cascade soft-deletes their ROMs / rooms by leaving the
// `status` column flipped; the rows still exist for audit).
adminRoutes.delete('/users/:id', async (c) => {
  const me = c.get('user')
  const id = Number(c.req.param('id'))
  if (id === me.id) return c.json({ error: '不能删除自己' }, 400)
  const victim = (await db.select().from(users)
    .where(and(eq(users.id, id), eq(users.status, STATUS.normal))).limit(1))[0]
  if (!victim) return c.json({ error: 'not found' }, 404)
  await db.update(users).set({ status: STATUS.deleted }).where(eq(users.id, id))
  // Soft-delete their ROMs so they disappear from the library
  await db.update(roms).set({ status: STATUS.deleted }).where(eq(roms.userId, id))
  return c.json({ ok: true })
})

adminRoutes.patch('/users/:id', async (c) => {
  const me = c.get('user')
  const id = Number(c.req.param('id'))
  if (id === me.id) return c.json({ error: '不能修改自己的角色' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const patch = {}
  if (body.role === 'user' || body.role === 'admin') patch.role = body.role
  if (Object.keys(patch).length === 0) return c.json({ error: '没有可修改的字段' }, 400)
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning()
  return c.json({
    id: updated.id,
    username: updated.username,
    role: updated.role,
    createdAt: updated.createdAt,
  })
})

adminRoutes.get('/roms', async (c) => {
  const rows = await db.select({
    rom: roms,
    user: { id: users.id, username: users.username },
  })
    .from(roms)
    .innerJoin(users, eq(users.id, roms.userId))
    .where(eq(roms.status, STATUS.normal))
    .orderBy(desc(roms.createdAt))
  return c.json({
    roms: rows.map(({ rom, user }) => ({
      id: rom.id,
      title: rom.title,
      platform: rom.platform,
      fileName: rom.fileName,
      fileSize: rom.fileSize,
      isPublic: Boolean(rom.isPublic),
      createdAt: rom.createdAt,
      owner: user,
    })),
  })
})
