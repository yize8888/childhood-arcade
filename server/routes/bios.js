import { Hono } from 'hono'
import { existsSync, statSync, createReadStream, readdirSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'
import { stream } from 'hono/streaming'

const BIOS_DIR = resolve(process.env.BIOS_DIR || 'data/bios')

// Content-Type picked from the extension so non-zip BIOS (.rom / .bin for
// PSX / GBA / FDS / etc.) don't get served as application/zip.
function contentTypeFor(name) {
  const ext = extname(name).toLowerCase()
  if (ext === '.zip') return 'application/zip'
  return 'application/octet-stream'
}

export const biosRoutes = new Hono()

biosRoutes.get('/:platform/:file', (c) => {
  const platform = c.req.param('platform').replace(/[^a-z0-9_-]/gi, '')
  const file = c.req.param('file').replace(/[^a-zA-Z0-9._-]/g, '')
  if (!platform || !file) return c.text('bad request', 400)
  const full = join(BIOS_DIR, platform, file)
  if (!full.startsWith(BIOS_DIR)) return c.text('forbidden', 403)
  if (!existsSync(full)) return c.text('not found', 404)

  const st = statSync(full)
  // No caching — every request re-downloads. Simpler, no stale-cache headaches
  // when swapping BIOS files on disk. ~5 MB per arcade boot is cheap locally.
  c.header('Cache-Control', 'no-store')
  c.header('Content-Type', contentTypeFor(file))
  c.header('Content-Length', String(st.size))
  return stream(c, async (s) => {
    const rs = createReadStream(full)
    await s.pipe(new ReadableStream({
      start(controller) {
        rs.on('data', (chunk) => controller.enqueue(chunk))
        rs.on('end', () => controller.close())
        rs.on('error', (err) => controller.error(err))
      },
    }))
  })
})

biosRoutes.get('/:platform', (c) => {
  const platform = c.req.param('platform').replace(/[^a-z0-9_-]/gi, '')
  const dir = join(BIOS_DIR, platform)
  if (!existsSync(dir)) return c.json({ files: [] })
  try {
    const files = readdirSync(dir).filter((n) => !n.startsWith('.'))
    return c.json({ files })
  } catch {
    return c.json({ files: [] })
  }
})
