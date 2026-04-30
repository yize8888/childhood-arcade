// Thin WebSocket client for /api/rooms/:code/ws. Exposes an on/off event bus
// so Player.vue can hook 'welcome', 'peer-joined', 'peer-left', 'chat',
// 'offer', 'answer', 'ice', 'room-closed' without caring about wire format.

import { ref } from 'vue'

export function useRoomSignal({ code, password = '' }) {
  const connected = ref(false)
  const listeners = new Map()   // event → Set<fn>
  let ws = null
  let closedByUs = false
  let reconnectTimer = null

  function on(event, fn) {
    let s = listeners.get(event)
    if (!s) { s = new Set(); listeners.set(event, s) }
    s.add(fn)
    return () => s.delete(fn)
  }
  function emit(event, msg) {
    const s = listeners.get(event)
    if (s) for (const fn of s) { try { fn(msg) } catch (e) { console.warn('[signal] handler error', e) } }
  }

  function send(msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try { ws.send(JSON.stringify(msg)); return true } catch { return false }
  }

  function connect() {
    if (ws) return
    closedByUs = false
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const pw = password ? `?password=${encodeURIComponent(password)}` : ''
    const url = `${proto}://${location.host}/api/rooms/${encodeURIComponent(code)}/ws${pw}`
    ws = new WebSocket(url)

    ws.onopen = () => {
      connected.value = true
    }
    ws.onmessage = (evt) => {
      let msg
      try { msg = JSON.parse(evt.data) } catch { return }
      if (!msg || typeof msg.type !== 'string') return
      emit(msg.type, msg)
    }
    ws.onclose = () => {
      connected.value = false
      emit('closed', {})
      ws = null
      if (!closedByUs) {
        // Soft auto-reconnect once after 2s (handles transient network blips)
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, 2000)
      }
    }
    ws.onerror = () => {
      // Error path ultimately triggers onclose; log for visibility only.
      // Intentionally no retry here — onclose handles it.
    }
  }

  function close() {
    closedByUs = true
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (ws) {
      try { ws.close() } catch {}
      ws = null
    }
    connected.value = false
  }

  function sendChat(text) {
    if (!text) return
    send({ type: 'chat', text: String(text).slice(0, 500) })
  }
  function sendOffer(toPeerId, sdp) { send({ type: 'offer', to: toPeerId, sdp }) }
  function sendAnswer(toPeerId, sdp) { send({ type: 'answer', to: toPeerId, sdp }) }
  function sendIce(toPeerId, candidate) { send({ type: 'ice', to: toPeerId, candidate }) }

  return {
    connected,
    on,
    connect,
    close,
    send,
    sendChat,
    sendOffer,
    sendAnswer,
    sendIce,
  }
}
