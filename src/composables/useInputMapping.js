// User-customizable keyboard + gamepad mapping per virtual retropad button.
// Stored in localStorage, keyed by user id (guests share a single 'guest' slot).
// Drives VirtualGamepad/useGamepads dispatch and the InputSettings UI.

import { ref, computed, watch } from 'vue'
import { useAuth } from './useAuth.js'

export const BUTTON_DEFS = [
  { key: 'up',     label: '上',      group: 'dpad' },
  { key: 'down',   label: '下',      group: 'dpad' },
  { key: 'left',   label: '左',      group: 'dpad' },
  { key: 'right',  label: '右',      group: 'dpad' },
  { key: 'a',      label: 'A',       group: 'face' },
  { key: 'b',      label: 'B',       group: 'face' },
  { key: 'x',      label: 'X',       group: 'face' },
  { key: 'y',      label: 'Y',       group: 'face' },
  { key: 'l',      label: 'L',       group: 'shoulder' },
  { key: 'r',      label: 'R',       group: 'shoulder' },
  { key: 'l2',     label: 'L2',      group: 'shoulder' },
  { key: 'r2',     label: 'R2',      group: 'shoulder' },
  { key: 'start',  label: 'Start',   group: 'system' },
  { key: 'select', label: 'Select',  group: 'system' },
]

const DEFAULT_KEYBOARD = {
  up: 'up', down: 'down', left: 'left', right: 'right',
  a: 'x', b: 'z',
  x: 's', y: 'a',
  l: 'q', r: 'w',
  l2: '1', r2: '3',
  start: 'enter', select: 'rshift',
}

// Player-2 retropad buttons map to dedicated F13–F24 virtual keys so they
// never collide with P1 bindings even if the user remaps aggressively.
export const P2_KEY_MAP = {
  up: 'f13', down: 'f14', left: 'f15', right: 'f16',
  a: 'f17', b: 'f18',
  x: 'f19', y: 'f20',
  l: 'f21', r: 'f22',
  start: 'f23', select: 'f24',
}

// RetroArch config fragment for P2 using the F-key bindings above.
export function buildPlayer2RetroarchConfig() {
  const cfg = {}
  for (const [btn, key] of Object.entries(P2_KEY_MAP)) {
    cfg[`input_player2_${btn}`] = key
  }
  return cfg
}

// numeric values are W3C Gamepad button indexes (Xbox layout).
const DEFAULT_GAMEPAD = {
  a: 1, b: 0, x: 3, y: 2,
  l: 4, r: 5, l2: 6, r2: 7,
  select: 8, start: 9,
  up: 12, down: 13, left: 14, right: 15,
}

function storageKey(userId) { return `input-mapping:${userId || 'guest'}` }

function loadMapping(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function saveMapping(userId, mapping) {
  localStorage.setItem(storageKey(userId), JSON.stringify(mapping))
}

const mapping = ref({ keyboard: { ...DEFAULT_KEYBOARD }, gamepad: { ...DEFAULT_GAMEPAD } })
let loaded = false

function refreshForUser(userId) {
  const stored = loadMapping(userId)
  mapping.value = {
    keyboard: { ...DEFAULT_KEYBOARD, ...(stored?.keyboard || {}) },
    gamepad:  { ...DEFAULT_GAMEPAD,  ...(stored?.gamepad  || {}) },
  }
}

export function useInputMapping() {
  const { user } = useAuth()

  if (!loaded) {
    loaded = true
    refreshForUser(user.value?.id)
    watch(() => user.value?.id, (id) => refreshForUser(id))
  }

  function setKeyboard(btn, key) {
    mapping.value = { ...mapping.value, keyboard: { ...mapping.value.keyboard, [btn]: key } }
    saveMapping(user.value?.id, mapping.value)
  }
  function setGamepad(btn, idx) {
    mapping.value = { ...mapping.value, gamepad: { ...mapping.value.gamepad, [btn]: idx } }
    saveMapping(user.value?.id, mapping.value)
  }
  function resetKeyboard() {
    mapping.value = { ...mapping.value, keyboard: { ...DEFAULT_KEYBOARD } }
    saveMapping(user.value?.id, mapping.value)
  }
  function resetGamepad() {
    mapping.value = { ...mapping.value, gamepad: { ...DEFAULT_GAMEPAD } }
    saveMapping(user.value?.id, mapping.value)
  }

  // Retroarch-style input config for player 1 derived from the current mapping.
  const retroarchConfig = computed(() => {
    const cfg = {}
    for (const { key } of BUTTON_DEFS) {
      cfg[`input_player1_${key}`] = mapping.value.keyboard[key] || 'nul'
      const gp = mapping.value.gamepad[key]
      if (typeof gp === 'number') cfg[`input_player1_${key}_btn`] = gp
    }
    return cfg
  })

  return {
    mapping: computed(() => mapping.value),
    retroarchConfig,
    setKeyboard, setGamepad,
    resetKeyboard, resetGamepad,
  }
}
