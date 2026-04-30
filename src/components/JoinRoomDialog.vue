<template>
  <Teleport to="body">
    <div class="mask" @click.self="$emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="加入房间">
        <header class="dh">
          <h3>加入房间</h3>
          <button class="btn btn-ghost btn-icon btn-sm" @click="$emit('close')" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form @submit.prevent="submit" class="form">
          <div v-if="room" class="room-card">
            <div class="room-name">{{ room.name }}</div>
            <div class="room-meta">
              <span>房主 @{{ room.hostUsername }}</span>
              <span>·</span>
              <span>{{ room.romTitle }}</span>
            </div>
          </div>
          <div v-else>
            <label class="label">房间码</label>
            <input v-model="code" class="input" placeholder="6 位房间码" maxlength="6" style="text-transform: uppercase;" required />
          </div>

          <div v-if="needsPassword || forcePassword">
            <label class="label">房间密码</label>
            <input v-model="password" class="input" type="password" placeholder="输入房间密码" autofocus required />
          </div>

          <div v-if="error" class="err">{{ error }}</div>

          <footer class="df">
            <button type="button" class="btn" :disabled="busy" @click="$emit('close')">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || (!code && !room)">
              {{ busy ? '加入中…' : '加入' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'

const props = defineProps({
  room: { type: Object, default: null },
  forcePassword: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'joined'])
const router = useRouter()

const code = ref(props.room?.code || '')
const password = ref('')
const needsPassword = ref(props.room?.hasPassword || false)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const roomCode = (props.room?.code || code.value).trim().toUpperCase()
  if (!roomCode) { error.value = '请输入房间码'; return }
  busy.value = true
  try {
    const joined = await api.roomJoin(roomCode, password.value)
    if (password.value) sessionStorage.setItem(`room:${joined.code}:pw`, password.value)
    emit('joined', joined)
    router.push(`/play/${joined.romId}?room=${joined.code}`)
  } catch (err) {
    if (err?.data?.needsPassword) {
      needsPassword.value = true
      error.value = '此房间需要密码'
    } else {
      error.value = err?.message || '加入失败'
    }
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.mask {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fadeIn 0.18s var(--ease-out);
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 24px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  animation: popIn 0.2s var(--ease-spring);
}
@keyframes popIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

.dh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.dh h3 { margin: 0; font-size: 17px; font-weight: 600; }

.form { display: flex; flex-direction: column; gap: 14px; }

.room-card {
  padding: 14px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.room-name { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.room-meta { display: flex; gap: 6px; font-size: 12px; color: var(--text-tertiary); }

.err {
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  color: var(--error);
  font-size: 13px;
  text-align: center;
}
.df { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
</style>
