<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="orb-brand">童</span>
        <div class="brand-text">
          <h1 class="brand-name">{{ settings.siteTitle }}</h1>
          <p class="brand-sub">{{ mode === 'login' ? '欢迎回来' : '创建一个账号' }}</p>
        </div>
      </div>

      <div class="seg auth-seg">
        <button class="seg-btn" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button class="seg-btn" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label class="label">用户名</label>
          <input v-model.trim="username" class="input" autocomplete="username" placeholder="3-32 位字母数字下划线" required />
        </div>
        <div class="field">
          <label class="label">密码</label>
          <input v-model="password" class="input" type="password" autocomplete="current-password" placeholder="至少 6 位" required />
        </div>
        <div v-if="error" class="err">{{ error }}</div>
        <button class="btn btn-primary btn-lg btn-submit" :disabled="submitting">
          {{ submitting ? '处理中…' : (mode === 'login' ? '登录' : '创建账号') }}
        </button>
      </form>

      <p class="foot-tip">
        {{ mode === 'login' ? '还没有账号？' : '已经有账号？' }}
        <a href="#" @click.prevent="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? '立即注册' : '前往登录' }}
        </a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useSettings } from '../composables/useSettings.js'

const { login, register } = useAuth()
const { settings } = useSettings()
const router = useRouter()
const route = useRoute()

const mode = ref(route.query.mode === 'register' ? 'register' : 'login')
const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  if (username.value.length < 3) return (error.value = '用户名至少 3 位')
  if (password.value.length < 6) return (error.value = '密码至少 6 位')
  submitting.value = true
  try {
    if (mode.value === 'login') await login(username.value, password.value)
    else await register(username.value, password.value)
    router.push(route.query.redirect || '/')
  } catch (err) {
    error.value = err?.message || '操作失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: calc(100dvh - var(--header-h) - 40px);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 32px 28px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.auth-brand .orb-brand { width: 40px; height: 40px; font-size: 16px; }
.brand-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.brand-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.brand-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.auth-seg { display: flex; width: 100%; margin-bottom: 20px; }
.auth-seg .seg-btn { flex: 1; height: 32px; }

.auth-form { display: flex; flex-direction: column; gap: 14px; }
.err {
  padding: 9px 12px;
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  color: var(--error);
  font-size: 13px;
}
.btn-submit { width: 100%; margin-top: 4px; }

.foot-tip {
  text-align: center;
  margin: 18px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
.foot-tip a { color: var(--accent); font-weight: 500; }
.foot-tip a:hover { color: var(--accent-hover); }
</style>
