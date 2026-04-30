async function request(path, { method = 'GET', body, formData, headers = {} } = {}) {
  const opts = {
    method,
    headers: { Accept: 'application/json', ...headers },
    credentials: 'include',
  }
  if (formData) {
    opts.body = formData
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(path, opts)
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, formData) => request(p, { method: 'POST', formData }),

  // auth
  me: () => request('/api/auth/me'),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  register: (username, password) => request('/api/auth/register', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) =>
    request('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),

  // roms
  romsMine: () => request('/api/roms/mine'),
  romsPublic: () => request('/api/roms/public'),
  romsFavorites: () => request('/api/roms/favorites'),
  romUpload: (fd) => request('/api/roms/upload', { method: 'POST', formData: fd }),
  romUpdate: (id, patch) => request(`/api/roms/${id}`, { method: 'PATCH', body: patch }),
  romDelete: (id, { permanent = false } = {}) =>
    request(`/api/roms/${id}${permanent ? '?permanent=1' : ''}`, { method: 'DELETE' }),
  romsTrash:  () => request('/api/roms/trash'),
  romRestore: (id) => request(`/api/roms/${id}/restore`, { method: 'POST' }),
  romFavorite:   (id) => request(`/api/roms/${id}/favorite`, { method: 'POST' }),
  romUnfavorite: (id) => request(`/api/roms/${id}/favorite`, { method: 'DELETE' }),
  romVersions:   (id) => request(`/api/roms/${id}/versions`),
  // Include the original filename as the last URL segment so emulators that
  // infer romset identity from the archive name (FBNeo, MAME) can find matches.
  romFileUrl: (id, name) => name
    ? `/api/roms/${id}/file/${encodeURIComponent(name)}`
    : `/api/roms/${id}/file`,

  // saves
  savesMine: () => request('/api/saves/mine'),
  saveLoad: async (romId, slot = 0) => {
    const res = await fetch(`/api/saves/${romId}?slot=${slot}`, { credentials: 'include' })
    if (res.status === 404) return null
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      throw new Error(d?.error || `加载存档失败 (${res.status})`)
    }
    return await res.blob()
  },
  saveUpload: async (romId, blob, slot = 0) => {
    const res = await fetch(`/api/saves/${romId}?slot=${slot}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) throw new Error(d?.error || `上传存档失败 (${res.status})`)
    return d
  },

  // rooms
  roomsPublic: () => request('/api/rooms'),
  roomsMine:   () => request('/api/rooms/mine'),
  roomCreate:  (body) => request('/api/rooms', { method: 'POST', body }),
  roomJoin:    (code, password) => request(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: { password: password || '' } }),
  roomUpdate:  (code, patch) => request(`/api/rooms/${encodeURIComponent(code)}`, { method: 'PATCH', body: patch }),
  roomClose:   (code) => request(`/api/rooms/${encodeURIComponent(code)}`, { method: 'DELETE' }),

  // settings
  settings: () => request('/api/settings'),
  adminSettings: () => request('/api/admin/settings'),
  adminUpdateSettings: (patch) => request('/api/admin/settings', { method: 'PATCH', body: patch }),

  // admin
  adminUsers: () => request('/api/admin/users'),
  adminRoms: () => request('/api/admin/roms'),
  adminUpdateUser: (id, patch) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: patch }),
  adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
}
