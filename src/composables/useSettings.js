import { ref, computed, watch } from 'vue'
import { api } from '../api/client.js'

const DEFAULTS = {
  siteTitle: '童年游戏厅',
  siteSubtitle: '8090 怀旧游戏厅',
  netplayEnabled: true,
}

const settings = ref({ ...DEFAULTS })
const loaded = ref(false)
let primed = false

function normalize(raw) {
  const out = { ...DEFAULTS, ...raw }
  // coerce "1"/"0" → boolean
  if (typeof out.netplayEnabled === 'string') out.netplayEnabled = out.netplayEnabled === '1'
  return out
}

async function refresh() {
  try {
    const data = await api.settings()
    if (data && typeof data === 'object') settings.value = normalize(data)
  } catch {}
  finally { loaded.value = true }
}

watch(
  () => settings.value.siteTitle,
  (title) => {
    if (typeof document !== 'undefined' && title) document.title = title
  },
  { immediate: true },
)

export function useSettings() {
  if (!primed) {
    primed = true
    refresh()
  }
  return {
    settings: computed(() => settings.value),
    loaded: computed(() => loaded.value),
    refresh,
    updateLocal(patch) {
      settings.value = normalize({ ...settings.value, ...patch })
    },
  }
}
