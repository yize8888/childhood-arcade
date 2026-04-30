import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, STATUS } from '../db/schema.js'
import { createSession, destroyCurrentSession, currentUser } from '../middleware/auth.js'

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'

const credentialsSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(128),
})

export const authRoutes = new Hono()

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = credentialsSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: '用户名或密码格式不正确' }, 400)
  const { username, password } = parsed.data

  const existing = await db.select().from(users)
    .where(and(eq(users.username, username), eq(users.status, STATUS.normal)))
    .limit(1)
  if (existing.length) return c.json({ error: '用户名已被占用' }, 409)

  const passwordHash = await bcrypt.hash(password, 10)
  const role = username === ADMIN_USERNAME ? 'admin' : 'user'
  const [row] = await db.insert(users).values({ username, passwordHash, role }).returning()

  await createSession(c, row.id)
  return c.json({ id: row.id, username: row.username, role: row.role })
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = credentialsSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: '用户名或密码格式不正确' }, 400)
  const { username, password } = parsed.data

  const rows = await db.select().from(users)
    .where(and(eq(users.username, username), eq(users.status, STATUS.normal)))
    .limit(1)
  const user = rows[0]
  if (!user) return c.json({ error: '用户名或密码错误' }, 401)
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return c.json({ error: '用户名或密码错误' }, 401)

  await createSession(c, user.id)
  return c.json({ id: user.id, username: user.username, role: user.role })
})

authRoutes.post('/logout', async (c) => {
  await destroyCurrentSession(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const user = await currentUser(c)
  if (!user) return c.json({ user: null })
  return c.json({ user: { id: user.id, username: user.username, role: user.role } })
})

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
})

authRoutes.post('/password', async (c) => {
  const me = await currentUser(c)
  if (!me) return c.json({ error: '未登录' }, 401)
  const body = await c.req.json().catch(() => null)
  const parsed = passwordChangeSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: '密码格式不正确（至少 6 位）' }, 400)

  const ok = await bcrypt.compare(parsed.data.currentPassword, me.passwordHash)
  if (!ok) return c.json({ error: '当前密码不正确' }, 401)

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, me.id))
  return c.json({ ok: true })
})
