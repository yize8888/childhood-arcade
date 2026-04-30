import { ref, onBeforeUnmount } from 'vue'
import { useInputMapping } from './useInputMapping.js'

/**
 * Polls navigator.getGamepads() each animation frame and dispatches synthetic
 * KeyboardEvents matching the user's current gamepad→retropad mapping.
 *
 * Solo / host mode: dispatches real keyboard events that Nostalgist listens to.
 * Guest mode: caller provides `onButton` to intercept — when it returns true
 *             we skip keyboard dispatch (guest forwards over DataChannel).
 */
export function useGamepads({ onButton } = {}) {
  const { mapping } = useInputMapping()
  const connected = ref(false)
  const padCount = ref(0)

  let rafId = null
  const state = Object.create(null)   // "padIndex:buttonIndex" → pressed?

  function poll() {
    const pads = (navigator.getGamepads?.() || []).filter(Boolean)
    padCount.value = pads.length
    connected.value = pads.length > 0

    for (const pad of pads) {
      if (!pad || pad.index !== 0) continue   // P1 only

      const gpMap = mapping.value.gamepad || {}
      const reverseMap = invertGamepadMap(gpMap)

      for (let i = 0; i < pad.buttons.length; i++) {
        const pressed = pad.buttons[i].pressed
        const k = pad.index + ':' + i
        if (pressed === !!state[k]) continue
        state[k] = pressed

        const btn = reverseMap[i]
        if (!btn) continue
        const handled = onButton ? !!onButton(pressed ? 'down' : 'up', btn) : false
        if (handled) continue
        const key = mapping.value.keyboard[btn]
        if (key) dispatchKey(pressed ? 'keydown' : 'keyup', key)
      }
    }
    rafId = requestAnimationFrame(poll)
  }

  function invertGamepadMap(gpMap) {
    const out = {}
    for (const [btn, idx] of Object.entries(gpMap)) out[idx] = btn
    return out
  }

  function dispatchKey(type, key) {
    const SPECIAL = {
      up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
      enter: 'Enter', space: ' ', shift: 'Shift', rshift: 'Shift',
    }
    const CODE = {
      up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
      enter: 'Enter', space: 'Space', shift: 'ShiftLeft', rshift: 'ShiftRight',
    }
    const k = key.toLowerCase()
    const keyStr = SPECIAL[k] || key
    const codeStr = CODE[k] || (key.length === 1 ? 'Key' + key.toUpperCase() : key)
    try {
      const ev = new KeyboardEvent(type, { key: keyStr, code: codeStr, bubbles: true, cancelable: true })
      window.dispatchEvent(ev)
    } catch {}
  }

  function start() { if (!rafId) rafId = requestAnimationFrame(poll) }
  function stop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null } }

  const onConnect = () => start()
  window.addEventListener('gamepadconnected', onConnect)
  start()

  onBeforeUnmount(() => {
    stop()
    window.removeEventListener('gamepadconnected', onConnect)
  })

  return { connected, padCount }
}
