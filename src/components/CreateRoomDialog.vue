<template>
  <Teleport to="body">
    <div class="mask" @click.self="$emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="创建房间">
        <header class="dh">
          <h3>创建房间</h3>
          <button class="btn btn-ghost btn-icon btn-sm" @click="$emit('close')" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form @submit.prevent="submit" class="form">
          <div>
            <label class="label">房间名称</label>
            <input v-model.trim="name" class="input" placeholder="例如: 拳皇 97 开黑" maxlength="60" required />
          </div>

          <div>
            <label class="label">游戏 ROM</label>
            <div class="rom-search">
              <input v-model="romQuery" class="input" placeholder="搜索你的 ROM 或公开 ROM…" />
              <div v-if="filteredRoms.length" class="rom-list">
                <button
                  v-for="r in filteredRoms.slice(0, 8)"
                  :key="r.id"
                  type="button"
                  class="rom-row"
                  :class="{ selected: selectedRom?.id === r.id }"
                  @click="selectedRom = r"
                >
                  <span class="rt">{{ r.title }}</span>
                  <span class="rp">{{ r.platform }}</span>
                </button>
              </div>
              <div v-else class="rom-empty">{{ roms.length ? '没有匹配结果' : '你还没有 ROM，先去上传或让管理员公开一些 ROM' }}</div>
            </div>
          </div>

          <label class="opt">
            <div class="sw">
              <input type="checkbox" v-model="isPublic" />
              <span class="track"><span class="thumb"></span></span>
            </div>
            <div class="opt-text">
              <div class="pt">房间公开</div>
              <div class="ps">公开房间会显示在对战大厅里</div>
            </div>
          </label>
          <label class="opt">
            <div class="sw">
              <input type="checkbox" v-model="allowPlay" />
              <span class="track"><span class="thumb"></span></span>
            </div>
            <div class="opt-text">
              <div class="pt">允许对战</div>
              <div class="ps">关闭后访客只能观战，不能操作</div>
            </div>
          </label>

          <div>
            <label class="label">房间密码（可选）</label>
            <input v-model="password" class="input" type="password" placeholder="留空表示不需要密码" maxlength="64" />
          </div>

          <div v-if="error" class="err">{{ error }}</div>

          <footer class="df">
            <button type="button" class="btn" :disabled="busy" @click="$emit('close')">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || !name || !selectedRom">
              {{ busy ? '创建中…' : '创建房间' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client.js'

const emit = defineEmits(['close', 'created'])

const roms = ref([])
const romQuery = ref('')
const selectedRom = ref(null)
const name = ref('')
const isPublic = ref(true)
const allowPlay = ref(true)
const password = ref('')
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  try {
    const [mine, pub] = await Promise.all([
      api.romsMine().catch(() => ({ roms: [] })),
      api.romsPublic().catch(() => ({ roms: [] })),
    ])
    const merged = [...mine.roms, ...pub.roms]
    const seen = new Set()
    roms.value = merged.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  } catch {}
})

const filteredRoms = computed(() => {
  const q = romQuery.value.trim().toLowerCase()
  if (!q) return roms.value
  return roms.value.filter((r) =>
    r.title.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q),
  )
})

async function submit() {
  error.value = ''
  if (!selectedRom.value) { error.value = '请选择一个 ROM'; return }
  busy.value = true
  try {
    const room = await api.roomCreate({
      name: name.value,
      romId: selectedRom.value.id,
      isPublic: isPublic.value,
      allowPlay: allowPlay.value,
      password: password.value || undefined,
    })
    if (password.value) sessionStorage.setItem(`room:${room.code}:pw`, password.value)
    emit('created', room)
  } catch (err) {
    error.value = err?.message || '创建失败'
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
  animation: fadeIn 0.2s var(--ease-out);
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  animation: popIn 0.2s var(--ease-spring);
}
@keyframes popIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

.dh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.dh h3 { margin: 0; font-size: 17px; font-weight: 600; }

.form { display: flex; flex-direction: column; gap: 14px; }

.rom-search { display: flex; flex-direction: column; gap: 8px; }
.rom-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-2);
}
.rom-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background var(--t-fast);
  border-bottom: 1px solid var(--border);
}
.rom-row:last-child { border-bottom: none; }
.rom-row:hover { background: var(--bg-3); }
.rom-row.selected { background: var(--accent-soft); color: var(--accent); }
.rt { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp { color: var(--text-tertiary); font-size: 11px; margin-left: 8px; flex-shrink: 0; }
.rom-empty { padding: 14px; font-size: 12px; color: var(--text-tertiary); text-align: center; }

.opt { display: flex; gap: 14px; align-items: center; cursor: pointer; }
.sw { position: relative; flex-shrink: 0; }
.sw input { opacity: 0; position: absolute; width: 100%; height: 100%; top: 0; left: 0; margin: 0; cursor: pointer; }
.track {
  position: relative; display: block;
  width: 40px; height: 24px;
  border-radius: 12px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  transition: all var(--t);
}
.thumb {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: var(--shadow-xs);
  transition: transform var(--t) var(--ease-spring);
}
.sw input:checked + .track { background: var(--success); border-color: var(--success); }
.sw input:checked + .track .thumb { transform: translateX(16px); }
.pt { font-size: 14px; font-weight: 600; }
.ps { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

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
