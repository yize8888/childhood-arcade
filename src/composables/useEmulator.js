// Vue lifecycle wrapper around Nostalgist. Uses the prepare/start two-phase
// pattern borrowed from retroassembly — we let Nostalgist own the canvas
// element (via getCanvas()) and mount it into our container once ready.

import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { prepareEmulator } from './nostalgist.js'

// Some libretro cores probe `navigator.mediaDevices.getUserMedia` on boot,
// which pops an unwanted camera-permission prompt. We null it out during
// start() and restore immediately after — lifted from retroassembly.
const originalGetUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia
  ?.bind(globalThis.navigator.mediaDevices)

export function useEmulator() {
  // Where Nostalgist's generated canvas gets inserted.
  const wrapperRef = ref(null)
  const booting = ref(false)
  const error = ref(null)
  const instance = shallowRef(null)

  // Cached for WebRTC's canvas.captureStream() call later
  let currentCanvas = null
  let wakeLock = null

  async function boot({ core, rom, romUrl, romFileName, bios = [], retroarchConfig = {}, shader }) {
    if (!wrapperRef.value) throw new Error('wrapper not mounted')
    if (instance.value) return instance.value
    booting.value = true
    error.value = null
    try {
      // Accept either a unified `rom` (object | array | url) or the legacy
      // romUrl/romFileName pair. Normalising here keeps callers flexible.
      const romInput = rom !== undefined
        ? rom
        : (romFileName ? { fileName: romFileName, fileContent: romUrl } : romUrl)
      const emu = await prepareEmulator({ core, rom: romInput, bios, retroarchConfig, shader })

      // Re-check mount: prepareEmulator is async (seconds), the component may
      // have been torn down while we waited (e.g. guest role arrived and the
      // v-if flipped). Bail cleanly instead of crashing on a null wrapper.
      if (!wrapperRef.value) {
        try { await emu.exit() } catch {}
        return null
      }
      instance.value = emu

      const canvas = emu.getCanvas()
      currentCanvas = canvas
      canvas.setAttribute('tabindex', '-1')
      canvas.classList.add('portal-canvas')
      wrapperRef.value.append(canvas)

      try { globalThis.navigator.mediaDevices.getUserMedia = null } catch {}
      try { await emu.start() }
      finally { try { globalThis.navigator.mediaDevices.getUserMedia = originalGetUserMedia } catch {} }

      canvas.focus({ preventScroll: true })

      try { wakeLock = await navigator.wakeLock?.request('screen') } catch {}

      return emu
    } catch (err) {
      error.value = err
      throw err
    } finally {
      booting.value = false
    }
  }

  async function saveState() {
    if (!instance.value) return null
    const { state } = await instance.value.saveState()
    return state
  }

  async function loadState(blobOrArrayBuffer) {
    if (!instance.value) return
    await instance.value.loadState(blobOrArrayBuffer)
  }

  function canvas() { return currentCanvas }

  // Tap into Nostalgist's internal AudioContext via MediaStreamDestination so
  // the host-mode WebRTC path can forward audio to the guest. Returns null
  // when we can't wire it up (caller falls back to video-only).
  function captureAudioStream() {
    const inst = instance.value
    if (!inst) return null
    const emuModule = inst?.getEmscripten?.()?.Module
    const ctx = emuModule?.audioContext || emuModule?.AL?.currentCtx?.audioCtx
    if (!ctx || typeof ctx.createMediaStreamDestination !== 'function') return null
    try {
      const dest = ctx.createMediaStreamDestination()
      if (emuModule?.SDL2?.audio?.scriptProcessorNode) {
        emuModule.SDL2.audio.scriptProcessorNode.connect(dest)
      } else if (emuModule?.AL?.alcDevice?.script) {
        emuModule.AL.alcDevice.script.connect(dest)
      } else {
        return null
      }
      return dest.stream
    } catch {
      return null
    }
  }

  async function toggleFullscreen() {
    const el = wrapperRef.value
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
    } else {
      await el.requestFullscreen?.()
    }
  }

  async function destroy() {
    const inst = instance.value
    instance.value = null
    currentCanvas = null
    try { await wakeLock?.release() } catch {}
    wakeLock = null
    if (!inst) return
    try { await inst.exit() } catch {}
  }

  onBeforeUnmount(() => { destroy() })

  return {
    wrapperRef,
    booting,
    error,
    instance,
    boot,
    saveState,
    loadState,
    canvas,
    captureAudioStream,
    toggleFullscreen,
    destroy,
  }
}
