// Persistent Blob cache backed by IndexedDB — same minimal pattern as
// EmulatorJS: one object store, URL → Blob. On fetch, check IDB first; if
// not present, download from network and store. Failures (quota / evicted)
// are swallowed — the caller still has the fresh Blob in memory so playback
// is unaffected, only the next-boot cache is skipped.

const DB_NAME = 'childhood-arcade'
const STORE = 'blobs'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function idbOp(mode, fn) {
  return openDb().then((db) => new Promise((resolve) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const r = fn(store)
    tx.oncomplete = () => resolve(r?.result ?? null)
    tx.onerror = () => resolve(null)
    tx.onabort = () => resolve(null)
  }))
}

function getCached(url) {
  return idbOp('readonly', (s) => s.get(url))
}

function putCached(url, blob) {
  return idbOp('readwrite', (s) => s.put(blob, url))
}

export async function clearCache() {
  await idbOp('readwrite', (s) => s.clear())
}

export async function stats() {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const cursor = tx.objectStore(STORE).openCursor()
    let count = 0
    let bytes = 0
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) { count++; bytes += c.value?.size || 0; c.continue() }
      else resolve({ count, bytes })
    }
    cursor.onerror = () => resolve({ count, bytes })
  })
}

// Fetch a URL as a Blob, using IndexedDB as the persistent cache.
export async function cachedFetch(url) {
  const hit = await getCached(url)
  if (hit) return hit

  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
  const blob = await res.blob()
  await putCached(url, blob)
  return blob
}
