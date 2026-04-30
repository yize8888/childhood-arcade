// Serve libretro cores from local disk. Files are shipped with the repo /
// Docker image under data/cores/ so runtime is pure static reads — no outbound
// fetches, no dependency on jsdelivr being reachable.
//
//   GET /api/cores/<core>.js   → application/javascript
//   GET /api/cores/<core>.wasm → application/wasm

import { Hono } from 'hono'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const CORES_DIR = resolve(process.env.CORES_DIR || 'data/cores')

export const coreRoutes = new Hono()

coreRoutes.get('/:file', (c) => {
  const file = c.req.param('file')
  const m = /^([a-z0-9_]+)\.(js|wasm)$/.exec(file)
  if (!m) return c.text('bad request', 400)
  const [, , ext] = m

  const full = join(CORES_DIR, file)
  if (!full.startsWith(CORES_DIR) || !existsSync(full)) {
    return c.text('core not found on disk', 404)
  }

  const body = readFileSync(full)
  return new Response(body, {
    headers: {
      'Content-Type': ext === 'js' ? 'application/javascript; charset=utf-8' : 'application/wasm',
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
