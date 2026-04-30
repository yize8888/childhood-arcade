// Theme selection — 'light' | 'dark'. Default is light.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'theme'
const theme = ref(normalize(localStorage.getItem(STORAGE_KEY)))

function normalize(v) {
  return v === 'dark' ? 'dark' : 'light'
}

function apply(t) {
  document.documentElement.setAttribute('data-theme', t)
}

apply(theme.value)
watch(theme, (t) => {
  localStorage.setItem(STORAGE_KEY, t)
  apply(t)
})

export function useTheme() {
  function cycle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }
  return { theme, cycle }
}
