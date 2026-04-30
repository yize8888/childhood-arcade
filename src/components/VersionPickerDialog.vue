<template>
  <Teleport to="body">
    <div class="mask" @click.self="$emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="选择版本">
        <header class="dh">
          <div class="dh-text">
            <h3>选择版本</h3>
            <p class="sub">{{ title }} · {{ versions.length }} 个版本</p>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" @click="$emit('close')" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div v-if="loading" class="loading">
          <div class="skeleton" style="height: 52px;"></div>
          <div class="skeleton" style="height: 52px;"></div>
        </div>
        <div v-else class="list">
          <button
            v-for="(v, i) in versions"
            :key="v.id"
            class="row"
            @click="$emit('pick', v)"
          >
            <span class="row-idx">{{ i + 1 }}</span>
            <div class="left">
              <div class="name">{{ versionName(v) }}</div>
            </div>
            <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/client.js'

const props = defineProps({
  rom: { type: Object, required: true },
})
defineEmits(['close', 'pick'])

const versions = ref([])
const loading = ref(true)
const title = props.rom.title

onMounted(async () => {
  try {
    const { versions: list } = await api.romVersions(props.rom.id)
    versions.value = list || []
  } catch {
    versions.value = [props.rom]
  } finally {
    loading.value = false
  }
})

function versionName(v) {
  if (!v.parentRomId) return '原版'
  return v.versionLabel || '变体'
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
  animation: fadeIn 0.2s var(--ease-out);
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog {
  width: 100%;
  max-width: 400px;
  padding: 20px 20px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  animation: popIn 0.22s var(--ease-spring);
}
@keyframes popIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.dh {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.dh-text { min-width: 0; flex: 1; }
.dh h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}
.sub { margin: 3px 0 0; font-size: 12px; color: var(--text-tertiary); }

.loading { display: flex; flex-direction: column; gap: 6px; padding: 2px 0; }

.list { display: flex; flex-direction: column; gap: 6px; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-1);
  color: var(--text-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
}
.row:hover {
  background: var(--bg-2);
  border-color: var(--accent);
  transform: translateX(2px);
}
.row:hover .chev { color: var(--accent); transform: translateX(2px); }
.row:focus-visible { outline: none; border-color: var(--accent); box-shadow: var(--shadow-focus); }

.row-idx {
  flex-shrink: 0;
  width: 22px; height: 22px;
  border-radius: 6px;
  background: var(--bg-3);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.row:hover .row-idx { background: var(--accent-soft); color: var(--accent); }

.chev {
  color: var(--text-quaternary);
  flex-shrink: 0;
  transition: color var(--t-fast), transform var(--t-fast);
}
.left { min-width: 0; flex: 1; }
.name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
</style>
