import { and, eq, gt } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../db/index.js'
import { users, sessions, STATUS } from '../db/schema.js'

const COOKIE_NAME = 'session'
const DEFAULT_TTL_DAYS = 30
const TTL_MS = DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000

function newToken() {
  // 32 bytes = 43 chars base64url, plenty of entropy
  return randomBytes(32).toString('base64url')
}

export async function createSession(c, userId) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + TTL_MS)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || null
  const userAgent = (c.req.header('user-agent') || '').slice(0, 512)
  await db.insert(sessions).values({ userId, token, ip, userAgent, expiresAt })
  setCookie(c, token, expiresAt)
  return token
}

export async function destroyCurrentSession(c) {
  const token = readCookie(c)
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token))
  }
  clearCookie(c)
}

export async function currentUser(c) {
  const token = readCookie(c)
  if (!token) return null
  const now = new Date()
  const rows = await db.select({
    s: sessions,
    u: users,
  })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.u.status !== STATUS.normal) return null
  // Touch lastActivityAt (best effort, fire-and-forget)
  db.update(sessions).set({ lastActivityAt: now })
    .where(eq(sessions.id, row.s.id)).execute?.() ?? null
  return row.u
}

export async function requireAuth(c, next) {
  const user = await currentUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', user)
  await next()
}

export async function requireAdmin(c, next) {
  const user = await currentUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  c.set('user', user)
  await next()
}

// ----- cookie helpers -----
function readCookie(c) {
  const header = c.req.header('cookie')
  if (!header) return null
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq) === COOKIE_NAME) return decodeURIComponent(part.slice(eq + 1))
  }
  return null
}
function setCookie(c, token, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production'
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (isProd) attrs.push('Secure')
  c.header('Set-Cookie', attrs.join('; '))
}
function clearCookie(c) {
  c.header('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

// Periodic expired-session cleanup (call opportunistically)
export async function cleanupExpiredSessions() {
  try {
    await db.delete(sessions).where(gt(new Date(), sessions.expiresAt))
  } catch {}
}
