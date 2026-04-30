import { ref, computed } from 'vue'
import { api } from '../api/client.js'

const user = ref(null)
const loading = ref(true)
let primed = false

async function refresh() {
  try {
    const { user: u } = await api.me()
    user.value = u
  } catch {
    user.value = null
  } finally {
    loading.value = false
  }
}

export function useAuth() {
  if (!primed) {
    primed = true
    refresh()
  }

  async function login(username, password) {
    const u = await api.login(username, password)
    user.value = u
    return u
  }

  async function register(username, password) {
    const u = await api.register(username, password)
    user.value = u
    return u
  }

  async function logout() {
    try { await api.logout() } finally {
      user.value = null
    }
  }

  return {
    user: computed(() => user.value),
    loading: computed(() => loading.value),
    isAuthed: computed(() => !!user.value),
    isAdmin: computed(() => user.value?.role === 'admin'),
    login,
    register,
    logout,
    refresh,
  }
}
