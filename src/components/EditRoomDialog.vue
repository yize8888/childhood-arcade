<template>
  <Teleport to="body">
    <div class="mask" @click.self="$emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="编辑房间">
        <header class="dh">
          <h3>编辑房间</h3>
          <button class="btn btn-ghost btn-icon btn-sm" @click="$emit('close')" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form @submit.prevent="submit" class="form">
          <div class="room-hint">
            房间码 <span class="code">{{ room.code }}</span>
          </div>
          <div>
            <label class="label">房间名称</label>
            <input v-model.trim="name" class="input" maxlength="60" required />
          </div>

          <div>
            <label class="label">游戏 ROM</label>
            <div class="rom-search">
              <input v-model="romQuery" class="input" placeholder="搜索 ROM…" />
              <div v-if="filteredRoms.length" class="rom-list">
                <button
                  v-for="r in filteredRoms.slice(0, 8)"
                  :key="r.id"
                  type="button"
                  class="rom-row"
                  :class="{ selected: selectedRomId === r.id }"
                  @click="selectedRomId = r.id"
                >
                  <span class="rt">{{ r.title }}</span>
                  <span class="rp">{{ r.platform }}</span>
                </button>
              </div>
              <div v-else class="rom-empty">没有匹配结果</div>
              <div v-if="romChanged" class="rom-warn">
                切换游戏后，当前连接的访客会被断开，需要重新加入房间。
              </div>
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

          <div class="pw-area">
            <label class="label">密码</label>
            <div class="pw-state" v-if="room.hasPassword && !clearPw">
              <span class="pw-badge">已设密码</span>
              <button type="button" class="btn btn-sm btn-ghost" @click="clearPw = true">清除密码</button>
            </div>
            <div v-else-if="clearPw" class="pw-state pw-cleared">
              <span class="pw-badge pw-badge-clear">将移除密码</span>
              <button type="button" class="btn btn-sm btn-ghost" @click="clearPw = false">取消</button>
            </div>
            <input v-model="password" class="input" type="password"
                   :placeholder="room.hasPassword ? '输入新密码则替换，留空不改' : '留空表示无密码'"
                   maxlength="64" />
          </div>

          <div v-if="error" class="err">{{ error }}</div>

          <footer class="df">
            <button type="button" class="btn" :disabled="busy" @click="$emit('close')">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy || !name || !selectedRomId">
              {{ busy ? '保存中…' : '保存' }}
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

const props = defineProps({
  room: { type: Object, required: true },
})
const emit = defineEmits(['close', 'updated'])

const name = ref(props.room.name)
const isPublic = ref(props.room.isPublic !== false)
const allowPlay = ref(props.room.allowPlay !== false)
const password = ref('')
const clearPw = ref(false)
const error = ref('')
const busy = ref(false)

const roms = ref([])
const romQuery = ref('')
const selectedRomId = ref(props.room.romId)

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
    if (!roms.value.some((r) => r.id === props.room.romId) && props.room.romTitle) {
      roms.value.unshift({
        id: props.room.romId,
        title: props.room.romTitle,
        platform: props.room.romPlatform || '',
      })
    }
  } catch {}
})

const filteredRoms = computed(() => {
  const q = romQuery.value.trim().toLowerCase()
  if (!q) return roms.value
  return roms.value.filter((r) =>
    r.title.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q),
  )
})
const romChanged = computed(() => selectedRomId.value !== props.room.romId)

async function submit() {
  error.value = ''
  busy.value = true
  const patch = {}
  if (name.value !== props.room.name) patch.name = name.value
  if (isPublic.value !== props.room.isPublic) patch.isPublic = isPublic.value
  if (allowPlay.value !== (props.room.allowPlay !== false)) patch.allowPlay = allowPlay.value
  if (selectedRomId.value && selectedRomId.value !== props.room.romId) patch.romId = selectedRomId.value
  if (clearPw.value) patch.password = null
  else if (password.value) patch.password = password.value

  try {
    if (Object.keys(patch).length === 0) {
      emit('close')
      return
    }
    const updated = await api.roomUpdate(props.room.code, patch)
    if (patch.password === null) sessionStorage.removeItem(`room:${props.room.code}:pw`)
    else if (patch.password) sessionStorage.setItem(`room:${props.room.code}:pw`, patch.password)
    emit('updated', updated)
  } catch (err) {
    error.value = err?.message || '保存失败'
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
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
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

.room-hint {
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
}
.room-hint .code {
  font-family: var(--mono-stack);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.08em;
  margin-left: 4px;
}

.rom-search { display: flex; flex-direction: column; gap: 8px; }
.rom-list {
  max-height: 200px;
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
.rom-warn {
  padding: 8px 12px;
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
  color: var(--warn);
  font-size: 12px;
}

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

.pw-area { display: flex; flex-direction: column; gap: 8px; }
.pw-state { display: flex; align-items: center; gap: 8px; }
.pw-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 11px; font-weight: 600;
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}
.pw-badge-clear { background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn); }

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
