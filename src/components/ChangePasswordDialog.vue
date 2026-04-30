<template>
  <Teleport to="body">
    <div class="mask" @click.self="$emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="修改密码">
        <header class="dh">
          <h3>修改密码</h3>
          <button class="btn btn-ghost btn-icon btn-sm" @click="$emit('close')" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form @submit.prevent="submit" class="form">
          <div>
            <label class="label">当前密码</label>
            <input v-model="currentPassword" class="input" type="password" autocomplete="current-password" required />
          </div>
          <div>
            <label class="label">新密码</label>
            <input v-model="newPassword" class="input" type="password" autocomplete="new-password" placeholder="至少 6 位" required />
          </div>
          <div>
            <label class="label">确认新密码</label>
            <input v-model="confirmPassword" class="input" type="password" autocomplete="new-password" required />
          </div>

          <div v-if="error" class="err">{{ error }}</div>
          <div v-if="success" class="ok">密码已更新</div>

          <footer class="df">
            <button type="button" class="btn" :disabled="busy" @click="$emit('close')">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || !currentPassword || !newPassword">
              {{ busy ? '保存中…' : '保存' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../api/client.js'

const emit = defineEmits(['close'])

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const busy = ref(false)

async function submit() {
  error.value = ''
  success.value = false
  if (newPassword.value.length < 6) { error.value = '新密码至少 6 位'; return }
  if (newPassword.value !== confirmPassword.value) { error.value = '两次输入的新密码不一致'; return }
  busy.value = true
  try {
    await api.changePassword(currentPassword.value, newPassword.value)
    success.value = true
    setTimeout(() => emit('close'), 1000)
  } catch (err) {
    error.value = err?.message || '修改失败'
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

.err {
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  color: var(--error);
  font-size: 13px;
  text-align: center;
}
.ok {
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--success);
  font-size: 13px;
  text-align: center;
}

.df { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
</style>
