<template>
  <div class="app-shell">
    <AppHeader v-if="showChrome" />
    <router-view v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <keep-alive include="Gallery">
          <component :is="Component" :key="route.fullPath" />
        </keep-alive>
      </Transition>
    </router-view>
    <footer v-if="showChrome" class="app-footer">
      <span>童年游戏厅 · 作者 YiZe</span>
      <span class="dot">·</span>
      <span class="mono">v1.0</span>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
const showChrome = computed(() => !route.meta?.fullscreen)
</script>

<style>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.app-footer {
  margin-top: auto;
  padding: 24px 16px 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary, #86868B);
  letter-spacing: 0.04em;
}
.app-footer .dot { color: var(--text-quaternary, #B4B4B8); }
.app-footer .mono {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  letter-spacing: 0.1em;
  color: var(--text-tertiary, #86868B);
}
</style>
