// RTCPeerConnection wrapper for host↔guest video/audio stream + a DataChannel
// for input forwarding. The signaling layer (useRoomSignal) is injected so
// SDP offers/answers/ICE candidates travel through our own server.
//
// Host: calls startCall(peerId, stream) to offer media + a DC to the guest.
// Guest: listens passively — handleOffer creates a PC answering the host,
//        exposing the incoming stream via onRemoteStream and DC msgs via
//        onDataMessage.

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
}

export function useWebRTC({ signal, onRemoteStream, onDataMessage, onStateChange }) {
  // peerId → { pc, dc }
  const peers = new Map()

  function getOrCreate(peerId, { initiatorStream = null } = {}) {
    let entry = peers.get(peerId)
    if (entry) return entry

    const pc = new RTCPeerConnection(ICE_CONFIG)
    entry = { pc, dc: null }
    peers.set(peerId, entry)

    pc.onicecandidate = (ev) => {
      if (ev.candidate) signal.sendIce(peerId, ev.candidate)
    }
    pc.ontrack = (ev) => {
      onRemoteStream?.(ev.streams[0])
    }
    pc.onconnectionstatechange = () => {
      onStateChange?.(pc.connectionState)
    }
    pc.oniceconnectionstatechange = () => {
      onStateChange?.('ice:' + pc.iceConnectionState)
    }
    pc.ondatachannel = (ev) => {
      // Guest (non-initiator) receives the host's DataChannel here
      entry.dc = ev.channel
      wireDataChannel(entry.dc)
    }

    if (initiatorStream) {
      for (const track of initiatorStream.getTracks()) {
        pc.addTrack(track, initiatorStream)
      }
      // Host-side DC: carries guest-input messages back to host
      entry.dc = pc.createDataChannel('input', { ordered: false, maxRetransmits: 0 })
      wireDataChannel(entry.dc)
    }

    return entry
  }

  function wireDataChannel(dc) {
    dc.onopen = () => onStateChange?.('dc:open')
    dc.onclose = () => onStateChange?.('dc:close')
    dc.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      onDataMessage?.(msg)
    }
  }

  async function startCall(peerId, stream) {
    const { pc } = getOrCreate(peerId, { initiatorStream: stream })
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signal.sendOffer(peerId, offer)
  }

  async function handleOffer(fromPeerId, sdp) {
    const { pc } = getOrCreate(fromPeerId)
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signal.sendAnswer(fromPeerId, answer)
  }

  async function handleAnswer(fromPeerId, sdp) {
    const entry = peers.get(fromPeerId)
    if (!entry) return
    await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
  }

  async function handleIce(fromPeerId, candidate) {
    const entry = peers.get(fromPeerId)
    if (!entry) return
    try { await entry.pc.addIceCandidate(candidate) } catch (err) {
      // remote candidate may arrive before we've set remote description; swallow
    }
  }

  function sendData(msg) {
    const data = JSON.stringify(msg)
    for (const { dc } of peers.values()) {
      if (dc && dc.readyState === 'open') {
        try { dc.send(data) } catch {}
      }
    }
  }

  function close() {
    for (const { pc, dc } of peers.values()) {
      try { dc?.close() } catch {}
      try { pc.close() } catch {}
    }
    peers.clear()
  }

  function closePeer(peerId) {
    const entry = peers.get(peerId)
    if (!entry) return
    try { entry.dc?.close() } catch {}
    try { entry.pc.close() } catch {}
    peers.delete(peerId)
  }

  return {
    startCall,
    handleOffer,
    handleAnswer,
    handleIce,
    sendData,
    closePeer,
    close,
  }
}
