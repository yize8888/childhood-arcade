<template>
  <div class="my-page container">
    <header class="page-head">
      <div>
        <h1 class="page-title">我的 ROM</h1>
        <p class="page-sub">上传并管理自己的 ROM，公开后其他玩家也能试玩</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-primary" @click="openUpload">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          上传 ROM
        </button>
      </div>
    </header>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'active' }" @click="activeTab = 'active'">
        全部 <span class="n">{{ roms.length }}</span>
      </button>
      <button class="tab" :class="{ active: activeTab === 'trash' }" @click="onSwitchTrash">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        回收站 <span class="n">{{ trashRoms.length }}</span>
      </button>
    </div>

    <section v-if="activeTab === 'active'">
      <div v-if="loading" class="panel-card loading-card">
        <div class="spinner"></div>
        <p>加载中…</p>
      </div>
      <div v-else-if="!roms.length" class="panel-card empty-card">
        <div class="empty-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h3>还没有上传过 ROM</h3>
        <p>把 .nes / .zip / .gba / .chd 等文件拖进来开始收藏</p>
        <button class="btn btn-primary btn-sm" @click="openUpload">选择文件</button>
      </div>
      <div v-else class="panel-card rom-table">
        <div class="trow trow-head">
          <span class="col-check"></span>
          <span>游戏</span>
          <span>平台</span>
          <span>大小</span>
          <span>上传时间</span>
          <span>公开</span>
          <span class="col-actions">操作</span>
        </div>
        <div v-for="rom in roms" :key="rom.id" class="trow">
          <span class="col-check"><span class="pdot" :style="{ background: platformColor(rom.platform) }"></span></span>
          <div class="col-title">
            <div v-if="editingId === rom.id" class="rt-edit">
              <input
                ref="editInput"
                v-model.trim="editTitle"
                class="rt-input"
                maxlength="128"
                @keydown.enter.prevent="saveTitle(rom)"
                @keydown.esc.prevent="cancelEdit"
                @blur="saveTitle(rom)"
              />
            </div>
            <div v-else class="rt" :title="rom.title + ' · 点击重命名'" @click="startEdit(rom)">
              <span class="rt-text">{{ rom.title }}</span>
              <svg class="rt-pen" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
            <div class="rf">{{ rom.fileName }}</div>
          </div>
          <div>
            <span class="plat-badge" :style="{ '--pc': platformColor(rom.platform) }">{{ platformLabel(rom.platform) }}</span>
          </div>
          <div class="muted">{{ fmtSize(rom.fileSize) }}</div>
          <div class="muted">{{ fmtTime(rom.createdAt) }}</div>
          <div>
            <label class="switch" :title="rom.isPublic ? '公开' : '私密'">
              <input type="checkbox" :checked="rom.isPublic" @change="togglePublic(rom, $event.target.checked)" />
              <span class="track"><span class="thumb"></span></span>
              <span class="switch-label">{{ rom.isPublic ? '公开' : '私密' }}</span>
            </label>
          </div>
          <div class="col-actions">
            <button class="btn btn-sm" @click="play(rom)">试玩</button>
            <button class="btn btn-sm btn-danger" @click="remove(rom)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'trash'">
      <div v-if="trashRoms.length" class="trash-hint">
        这些 ROM 已标记为删除，文件仍在磁盘上保留。恢复可将其还原，永久删除会抹除磁盘上的 ROM、存档与子版本。
      </div>
      <div v-if="trashLoading" class="panel-card loading-card">
        <div class="spinner"></div>
        <p>加载中…</p>
      </div>
      <div v-else-if="!trashRoms.length" class="panel-card empty-card">
        <div class="empty-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </div>
        <h3>回收站是空的</h3>
        <p>删除的 ROM 会出现在这里，可以随时恢复</p>
      </div>
      <div v-else class="panel-card rom-table">
        <div class="trow trow-head trow-trash">
          <span class="col-check"></span>
          <span>游戏</span>
          <span>平台</span>
          <span>大小</span>
          <span>删除时间</span>
          <span class="col-actions">操作</span>
        </div>
        <div v-for="rom in trashRoms" :key="rom.id" class="trow trow-trash">
          <span class="col-check"><span class="pdot" :style="{ background: platformColor(rom.platform) }"></span></span>
          <div class="col-title">
            <div class="rt"><span class="rt-text">{{ rom.title }}</span></div>
            <div class="rf">{{ rom.fileName }}</div>
          </div>
          <div>
            <span class="plat-badge" :style="{ '--pc': platformColor(rom.platform) }">{{ platformLabel(rom.platform) }}</span>
          </div>
          <div class="muted">{{ fmtSize(rom.fileSize) }}</div>
          <div class="muted">{{ fmtTime(rom.updatedAt) }}</div>
          <div class="col-actions">
            <button class="btn btn-sm btn-primary" @click="restore(rom)">恢复</button>
            <button class="btn btn-sm btn-danger" @click="purge(rom)">永久删除</button>
          </div>
        </div>
      </div>
    </section>

    <UploadDialog v-if="showUpload" @close="showUpload = false" @uploaded="onUploaded" />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { getPlatform } from '../constants/platforms.js'
import UploadDialog from '../components/UploadDialog.vue'

const router = useRouter()
const roms = ref([])
const trashRoms = ref([])
const loading = ref(true)
const trashLoading = ref(false)
const trashLoaded = ref(false)
const showUpload = ref(false)
const editingId = ref(null)
const editTitle = ref('')
const editInput = ref(null)
const activeTab = ref('active')

async function load() {
  loading.value = true
  try { roms.value = (await api.romsMine()).roms } finally { loading.value = false }
}
async function loadTrash() {
  trashLoading.value = true
  try { trashRoms.value = (await api.romsTrash()).roms }
  catch { trashRoms.value = [] }
  finally { trashLoading.value = false; trashLoaded.value = true }
}
onMounted(load)

function onSwitchTrash() {
  activeTab.value = 'trash'
  if (!trashLoaded.value) loadTrash()
}

function openUpload() { showUpload.value = true }
function onUploaded(r) {
  roms.value = [r, ...roms.value]
  showUpload.value = false
}

async function togglePublic(rom, val) {
  try {
    const updated = await api.romUpdate(rom.id, { isPublic: val })
    rom.isPublic = updated.isPublic
  } catch (err) { alert(err.message) }
}

function startEdit(rom) {
  editingId.value = rom.id
  editTitle.value = rom.title
  nextTick(() => {
    const el = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value
    el?.focus()
    el?.select()
  })
}
function cancelEdit() {
  editingId.value = null
  editTitle.value = ''
}
async function saveTitle(rom) {
  if (editingId.value !== rom.id) return
  const next = editTitle.value.trim()
  if (!next || next === rom.title) { cancelEdit(); return }
  const id = rom.id
  editingId.value = null
  try {
    const updated = await api.romUpdate(id, { title: next })
    rom.title = updated.title
  } catch (err) {
    alert(err?.message || '重命名失败')
  }
}

async function remove(rom) {
  if (!confirm(`删除 "${rom.title}"？将移至回收站，可随时恢复。`)) return
  try {
    await api.romDelete(rom.id)
    roms.value = roms.value.filter((r) => r.id !== rom.id)
    trashLoaded.value = false
  } catch (err) {
    alert(err?.message || '删除失败')
  }
}

async function restore(rom) {
  try {
    await api.romRestore(rom.id)
    trashRoms.value = trashRoms.value.filter((r) => r.id !== rom.id)
    roms.value = [rom, ...roms.value]
  } catch (err) {
    alert(err?.message || '恢复失败')
  }
}

async function purge(rom) {
  if (!confirm(`永久删除 "${rom.title}"？磁盘上的 ROM 文件、所有云存档以及子版本都会被抹除，不可恢复。`)) return
  try {
    await api.romDelete(rom.id, { permanent: true })
    trashRoms.value = trashRoms.value.filter((r) => r.id !== rom.id)
  } catch (err) {
    alert(err?.message || '永久删除失败')
  }
}

function play(rom) { router.push(`/play/${rom.id}`) }
function platformColor(p) { return getPlatform(p).color }
function platformLabel(p) { return getPlatform(p).shortLabel }
function fmtSize(b) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}
function fmtTime(v) {
  if (v == null) return '—'
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleString('zh-CN', {
    year: sameYear ? undefined : 'numeric',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}
</script>

<style scoped>
.my-page { padding-bottom: 60px; }

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 2px;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--t-fast), border-color var(--t-fast);
  white-space: nowrap;
}
.tab:hover { color: var(--text-primary); }
.tab.active { color: var(--text-primary); font-weight: 600; border-bottom-color: var(--accent); }
.tab .n {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  min-width: 20px;
  text-align: center;
  border-radius: var(--r-pill);
  background: var(--bg-3);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.tab.active .n { background: var(--accent-soft); color: var(--accent); }

.trash-hint {
  padding: 12px 16px;
  margin-bottom: 16px;
  background: color-mix(in srgb, var(--warn) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
  border-radius: var(--r-md);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.loading-card, .empty-card { text-align: center; padding: 56px 24px; }
.spinner {
  width: 28px; height: 28px; margin: 0 auto 12px;
  border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-icon {
  width: 64px; height: 64px;
  margin: 0 auto 16px;
  border-radius: var(--r-md);
  background: var(--bg-3);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary);
}
.empty-card h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
.empty-card p, .loading-card p { margin: 0 0 18px; color: var(--text-tertiary); font-size: 14px; }

.rom-table { padding: 6px; }
.trow {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 110px 100px 150px 130px 170px;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  border-radius: var(--r-md);
  transition: background var(--t-fast);
}
.trow.trow-trash {
  grid-template-columns: 40px minmax(0, 1fr) 110px 100px 150px 200px;
}
.trow:not(.trow-head):hover { background: var(--bg-3); }
.trow-head {
  font-size: 12px; font-weight: 500; color: var(--text-tertiary);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}
.col-check { display: flex; align-items: center; }
.pdot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.col-title { min-width: 0; }
.rt {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary);
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 100%;
  overflow: hidden;
  cursor: text;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background var(--t-fast);
}
.rt:hover { background: var(--bg-3); }
.rt:hover .rt-pen { opacity: 1; }
.rt-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.rt-pen { opacity: 0; flex-shrink: 0; color: var(--text-tertiary); transition: opacity var(--t-fast); }
.rt-edit { padding: 0; }
.rt-input {
  width: 100%;
  font-size: 14px; font-weight: 600;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-1);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 4px 8px;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.rf { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plat-badge {
  --pc: var(--accent);
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 600;
  background: color-mix(in srgb, var(--pc) 14%, transparent);
  color: var(--pc);
}
.muted { color: var(--text-secondary); font-size: 13px; }

.col-actions { display: flex; gap: 6px; justify-content: flex-end; }

.switch { position: relative; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.track {
  position: relative;
  width: 40px; height: 24px;
  border-radius: 12px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  transition: background var(--t), border-color var(--t);
}
.thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: var(--shadow-xs);
  transition: transform var(--t) var(--ease-spring);
}
.switch input:checked + .track { background: var(--success); border-color: var(--success); }
.switch input:checked + .track .thumb { transform: translateX(16px); }
.switch-label { font-size: 12px; color: var(--text-tertiary); font-weight: 500; min-width: 28px; }
.switch input:checked ~ .switch-label { color: var(--success); }

@media (max-width: 820px) {
  .trow, .trow-head { grid-template-columns: 32px minmax(0, 1fr) 80px; gap: 10px; }
  .trow > *:nth-child(n+4), .trow-head > *:nth-child(n+4) { display: none; }
}
</style>
