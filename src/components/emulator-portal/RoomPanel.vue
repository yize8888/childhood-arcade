<template>
  <Transition name="slide">
    <aside v-if="open" class="room-panel" @click.stop>
      <header class="rp-head">
        <div class="rp-title">
          <span class="rp-code">{{ code }}</span>
          <span class="rp-state" :class="connected ? 'ok' : 'pending'">
            {{ connected ? (isHost ? '主机' : '已连接') : '连接中…' }}
          </span>
        </div>
        <button class="rp-close" @click="$emit('close')" aria-label="关闭">×</button>
      </header>

      <section class="rp-members">
        <div class="rp-section-title">房间成员 ({{ sortedPeers.length }})</div>
        <ul class="rp-list">
          <li v-for="p in sortedPeers" :key="p.id" :class="{ me: p.id === mePeerId }">
            <span class="m-name">{{ p.username || '游客' }}</span>
            <span v-if="p.isHost" class="m-host">主机</span>
            <span v-else-if="!allowPlay" class="m-observer">观战</span>
          </li>
        </ul>
      </section>

      <section class="rp-chat">
        <div class="rp-section-title">聊天</div>
        <div class="rp-log" ref="logRef">
          <div v-for="(c, i) in chat" :key="i" class="msg" :class="{ me: c.from === mePeerId }">
            <span class="msg-from">{{ c.fromName || '匿名' }}</span>
            <span class="msg-text">{{ c.text }}</span>
          </div>
        </div>
        <form class="rp-input" @submit.prevent="submit">
          <input
            v-model="draft"
            placeholder="说点什么…"
            maxlength="500"
            :disabled="!connected"
          />
          <button type="submit" :disabled="!draft.trim() || !connected">发送</button>
        </form>
      </section>
    </aside>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  open: Boolean,
  code: String,
  connected: Boolean,
  isHost: Boolean,
  allowPlay: { type: Boolean, default: true },
  mePeerId: String,
  peers: { type: Object, default: () => ({}) },
  chat: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'send'])

const draft = ref('')
const logRef = ref(null)

const sortedPeers = computed(() => {
  const arr = Object.values(props.peers || {})
  // Hosts first, then me, then others alphabetically
  arr.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0))
  return arr
})

function submit() {
  const text = draft.value.trim()
  if (!text) return
  emit('send', text)
  draft.value = ''
}

// Auto-scroll on new messages
watch(() => props.chat.length, async () => {
  await nextTick()
  if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
})
</script>

<style scoped>
.room-panel {
  position: fixed;
  right: 16px;
  top: 64px;
  bottom: 16px;
  width: 320px;
  max-width: calc(100vw - 32px);
  background: rgba(20, 20, 22, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  color: #fff;
  z-index: 50;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.rp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.rp-title { display: flex; align-items: center; gap: 10px; }
.rp-code  { font-family: ui-monospace, monospace; font-size: 14px; letter-spacing: 0.12em; }
.rp-state {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
.rp-state.ok { background: rgba(52, 199, 89, 0.25); }
.rp-state.pending { background: rgba(255, 149, 0, 0.22); }
.rp-close {
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent; color: rgba(255,255,255,0.6);
  border: 0; cursor: pointer; font-size: 18px; line-height: 1;
}
.rp-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

.rp-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.4);
  margin-bottom: 6px;
}

.rp-members { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.rp-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.rp-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 13px;
}
.rp-list li.me { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.m-name  { flex: 1; }
.m-host  { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--warn) 25%, transparent); color: var(--warn); }
.m-observer { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

.rp-chat { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 12px 16px; }
.rp-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
  margin-bottom: 10px;
}
.msg { font-size: 13px; line-height: 1.4; }
.msg-from { color: rgba(255,255,255,0.5); margin-right: 6px; }
.msg.me .msg-from { color: #5ac8fa; }
.rp-input { display: flex; gap: 8px; }
.rp-input input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
}
.rp-input input:focus { border-color: rgba(10,132,255,0.5); }
.rp-input button {
  background: rgba(10,132,255,0.3);
  color: #fff;
  border: 0;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.rp-input button:disabled { opacity: 0.4; cursor: not-allowed; }

.slide-enter-active, .slide-leave-active { transition: transform 0.22s ease, opacity 0.22s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(12px); opacity: 0; }

@media (max-width: 600px) {
  .room-panel { right: 8px; left: 8px; width: auto; top: 56px; bottom: 8px; }
}
</style>
