<template>
  <div class="admin container">
    <header class="page-head">
      <div>
        <h1 class="page-title">管理后台</h1>
        <p class="page-sub">管理用户、ROM 以及站点设置</p>
      </div>
    </header>

    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-icon icon-blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <div class="stat-body">
          <div class="stat-label">用户</div>
          <div class="stat-value">{{ users.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon icon-orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>
        </span>
        <div class="stat-body">
          <div class="stat-label">ROM</div>
          <div class="stat-value">{{ roms.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon icon-green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10"/></svg>
        </span>
        <div class="stat-body">
          <div class="stat-label">公开 ROM</div>
          <div class="stat-value">{{ publicRomCount }}</div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon icon-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </span>
        <div class="stat-body">
          <div class="stat-label">管理员</div>
          <div class="stat-value">{{ adminCount }}</div>
        </div>
      </div>
    </div>

    <nav class="seg admin-seg">
      <button class="seg-btn" :class="{ active: tab === 'site' }" @click="tab = 'site'">站点</button>
      <button class="seg-btn" :class="{ active: tab === 'users' }" @click="tab = 'users'">用户</button>
      <button class="seg-btn" :class="{ active: tab === 'roms' }" @click="tab = 'roms'">ROM</button>
    </nav>

    <section v-if="tab === 'site'" class="panel-card panel">
      <h2 class="panel-title">站点设置</h2>
      <div class="field">
        <label class="label">网站名称</label>
        <input v-model.trim="form.siteTitle" class="input" maxlength="40" placeholder="童年游戏厅" />
      </div>
      <div class="field">
        <label class="label">副标题</label>
        <input v-model.trim="form.siteSubtitle" class="input" maxlength="80" />
      </div>
      <label class="toggle-row">
        <div class="toggle-sw">
          <input type="checkbox" v-model="form.netplayEnabled" />
          <span class="sw-track"><span class="sw-thumb"></span></span>
        </div>
        <div class="toggle-text">
          <div class="tr-t">开启对战功能</div>
          <div class="tr-s">关闭后用户无法创建或加入房间；管理员不受影响</div>
        </div>
      </label>

      <label class="toggle-row">
        <div class="toggle-sw">
          <input type="checkbox" v-model="form.guestPlayEnabled" />
          <span class="sw-track"><span class="sw-thumb"></span></span>
        </div>
        <div class="toggle-text">
          <div class="tr-t">允许游客试玩</div>
          <div class="tr-s">开启后未登录用户可以试玩公开 ROM；存档和对战仍然需要登录</div>
        </div>
      </label>

      <div class="row-end">
        <button class="btn btn-primary" :disabled="savingSite" @click="saveSite">
          {{ savingSite ? '保存中…' : '保存' }}
        </button>
        <Transition name="saved">
          <span v-if="siteSaved" class="saved">已保存</span>
        </Transition>
      </div>
    </section>

    <section v-if="tab === 'users'" class="panel-card panel">
      <h2 class="panel-title">用户列表</h2>
      <div class="tbl">
        <div class="trow trow-head">
          <div>用户名</div><div>角色</div><div>注册时间</div><div class="right">操作</div>
        </div>
        <div v-for="u in users" :key="u.id" class="trow">
          <div class="u-name">
            <div class="avatar">{{ u.username.slice(0, 1).toUpperCase() }}</div>
            <span>{{ u.username }}</span>
          </div>
          <div>
            <span class="pill-tag" :class="u.role === 'admin' ? 'pill-admin' : 'pill-member'">
              {{ u.role === 'admin' ? '管理员' : '用户' }}
            </span>
          </div>
          <div class="muted">{{ fmtTime(u.createdAt) }}</div>
          <div class="actions">
            <template v-if="u.id !== me.id">
              <button class="btn btn-sm" @click="toggleRole(u)">
                {{ u.role === 'admin' ? '降为用户' : '设为管理员' }}
              </button>
              <button class="btn btn-sm btn-danger" @click="removeUser(u)">删除</button>
            </template>
            <span v-else class="muted">（当前账号）</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="tab === 'roms'" class="panel-card panel">
      <div class="panel-head">
        <h2 class="panel-title">全部 ROM</h2>
        <button class="btn btn-primary btn-sm" @click="openUpload">上传</button>
      </div>
      <div class="tbl">
        <div class="trow trow-head trow-roms">
          <div>游戏</div><div>平台</div><div>上传者</div><div>上传时间</div><div>状态</div><div class="right">操作</div>
        </div>
        <div v-for="r in roms" :key="r.id" class="trow trow-roms">
          <div class="u-name">
            <div class="pdot" :style="{ background: platColor(r.platform) }"></div>
            <div>
              <div class="rt">{{ r.title }}</div>
              <div class="rf">{{ r.fileName }} · {{ fmtSize(r.fileSize) }}</div>
            </div>
          </div>
          <div>
            <span class="plat-badge" :style="{ '--pc': platColor(r.platform) }">{{ platLabel(r.platform) }}</span>
          </div>
          <div class="muted">@{{ r.owner?.username || '—' }}</div>
          <div class="muted">{{ fmtTime(r.createdAt) }}</div>
          <div>
            <button
              class="pill-tag pill-toggle"
              :class="r.isPublic ? 'pill-pub' : 'pill-priv'"
              :disabled="togglingId === r.id"
              @click="togglePublic(r)"
              :title="r.isPublic ? '点击设为私密' : '点击设为公开'"
            >
              {{ togglingId === r.id ? '…' : (r.isPublic ? '公开' : '私密') }}
            </button>
          </div>
          <div class="actions">
            <button class="btn btn-sm" @click="play(r)">试玩</button>
            <button class="btn btn-sm btn-danger" @click="deleteRom(r)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <UploadDialog v-if="showUpload" @close="showUpload = false" @uploaded="onUploaded" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { useAuth } from '../composables/useAuth.js'
import { useSettings } from '../composables/useSettings.js'
import { getPlatform } from '../constants/platforms.js'
import UploadDialog from '../components/UploadDialog.vue'

const router = useRouter()
const { user: me } = useAuth()
const { updateLocal } = useSettings()

const tab = ref('site')
const form = reactive({ siteTitle: '', siteSubtitle: '', netplayEnabled: true, guestPlayEnabled: false })
const savingSite = ref(false)
const siteSaved = ref(false)

const users = ref([])
const roms = ref([])
const showUpload = ref(false)

const publicRomCount = computed(() => roms.value.filter((r) => r.isPublic).length)
const adminCount = computed(() => users.value.filter((u) => u.role === 'admin').length)

onMounted(async () => {
  loadUsers(); loadRoms()
  try {
    const s = await api.adminSettings()
    form.siteTitle = s.siteTitle || ''
    form.siteSubtitle = s.siteSubtitle || ''
    form.netplayEnabled = s.netplayEnabled === '1'
    form.guestPlayEnabled = s.guestPlayEnabled === '1'
  } catch {}
})

async function saveSite() {
  savingSite.value = true
  siteSaved.value = false
  try {
    const next = await api.adminUpdateSettings({
      siteTitle: form.siteTitle,
      siteSubtitle: form.siteSubtitle,
      netplayEnabled: form.netplayEnabled,
      guestPlayEnabled: form.guestPlayEnabled,
    })
    updateLocal({
      siteTitle: next.siteTitle,
      siteSubtitle: next.siteSubtitle,
      netplayEnabled: next.netplayEnabled === '1',
      guestPlayEnabled: next.guestPlayEnabled === '1',
    })
    siteSaved.value = true
    setTimeout(() => { siteSaved.value = false }, 1600)
  } catch (err) { alert(err?.message || '保存失败') }
  finally { savingSite.value = false }
}

async function loadUsers() { try { users.value = (await api.adminUsers()).users } catch {} }
async function loadRoms()  { try { roms.value  = (await api.adminRoms()).roms   } catch {} }

async function toggleRole(u) {
  const nextRole = u.role === 'admin' ? 'user' : 'admin'
  if (!confirm(`确认将 ${u.username} 设为 ${nextRole === 'admin' ? '管理员' : '普通用户'} ？`)) return
  try {
    const updated = await api.adminUpdateUser(u.id, { role: nextRole })
    u.role = updated.role
  } catch (err) { alert(err.message) }
}

async function removeUser(u) {
  if (!confirm(`删除用户 ${u.username} 及其所有 ROM？该操作不可撤销。`)) return
  try {
    await api.adminDeleteUser(u.id)
    users.value = users.value.filter((x) => x.id !== u.id)
    loadRoms()
  } catch (err) { alert(err.message) }
}

function openUpload() { showUpload.value = true }
function onUploaded(r) {
  roms.value = [r, ...roms.value]
  showUpload.value = false
}

async function deleteRom(r) {
  if (!confirm(`删除 "${r.title}" ？将移至回收站，用户可在「我的 ROM」里恢复。`)) return
  await api.romDelete(r.id)
  roms.value = roms.value.filter((x) => x.id !== r.id)
}

const togglingId = ref(null)
async function togglePublic(r) {
  togglingId.value = r.id
  try {
    const updated = await api.romUpdate(r.id, { isPublic: !r.isPublic })
    const i = roms.value.findIndex((x) => x.id === r.id)
    if (i !== -1) roms.value[i] = { ...roms.value[i], isPublic: !!updated.isPublic }
  } catch (err) {
    alert(err?.message || '切换失败')
  } finally {
    togglingId.value = null
  }
}

function play(r) { router.push(`/play/${r.id}`) }
function platColor(p) { return getPlatform(p).color }
function platLabel(p) { return getPlatform(p).shortLabel }
function fmtSize(b) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}
function fmtTime(v) {
  if (v == null) return '—'
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.admin { padding-bottom: 60px; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xs);
  transition: box-shadow var(--t-fast), transform var(--t-fast);
}
.stat-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }

.stat-icon {
  width: 44px; height: 44px;
  border-radius: var(--r-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-blue   { background: color-mix(in srgb, var(--sys-blue) 14%, transparent);   color: var(--sys-blue); }
.icon-orange { background: color-mix(in srgb, var(--sys-orange) 14%, transparent); color: var(--sys-orange); }
.icon-green  { background: color-mix(in srgb, var(--sys-green) 14%, transparent);  color: var(--sys-green); }
.icon-purple { background: color-mix(in srgb, var(--sys-purple) 14%, transparent); color: var(--sys-purple); }

.stat-body { min-width: 0; }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-bottom: 2px; }
.stat-value {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.admin-seg { margin-bottom: 20px; }

.panel { padding: 24px; }
.panel-title { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }

.field { margin-bottom: 16px; max-width: 480px; }

.toggle-row {
  display: flex; align-items: center; gap: 14px;
  margin: 18px 0 22px;
  padding: 14px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  max-width: 480px;
}
.toggle-sw { position: relative; flex-shrink: 0; }
.toggle-sw input { position: absolute; inset: 0; opacity: 0; cursor: pointer; margin: 0; }
.sw-track {
  display: block; width: 40px; height: 24px;
  border-radius: 12px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  position: relative;
  transition: all var(--t);
}
.sw-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: var(--shadow-xs);
  transition: transform var(--t) var(--ease-spring);
}
.toggle-sw input:checked + .sw-track { background: var(--success); border-color: var(--success); }
.toggle-sw input:checked + .sw-track .sw-thumb { transform: translateX(16px); }
.tr-t { font-size: 14px; font-weight: 600; }
.tr-s { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.row-end { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
.saved { color: var(--success); font-size: 13px; font-weight: 600; }
.saved-enter-active, .saved-leave-active { transition: all 0.2s var(--ease-out); }
.saved-enter-from, .saved-leave-to { opacity: 0; transform: translateY(4px); }

.tbl { display: flex; flex-direction: column; gap: 2px; }
.trow {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 180px;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--r-md);
  transition: background var(--t-fast);
}
.trow-roms { grid-template-columns: 2fr 110px 1fr 160px 90px 170px; }
.trow:not(.trow-head):hover { background: var(--bg-3); }
.trow-head {
  font-size: 12px; font-weight: 500; color: var(--text-tertiary);
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}
.right { text-align: right; }

.u-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}
.pdot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.rt { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--text-tertiary); font-size: 13px; }

.actions { display: flex; gap: 6px; justify-content: flex-end; }

.pill-tag {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.pill-admin  { background: var(--accent-soft); color: var(--accent); }
.pill-member { background: var(--bg-3); color: var(--text-secondary); }
.pill-pub    { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
.pill-priv   { background: var(--bg-3); color: var(--text-tertiary); }

.pill-toggle {
  cursor: pointer;
  font-family: inherit;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.pill-toggle:hover:not(:disabled) { border-color: var(--border-strong); }
.pill-toggle:disabled { opacity: 0.6; cursor: wait; }

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

@media (max-width: 900px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .trow, .trow-roms { grid-template-columns: 1fr 1fr; gap: 10px; }
  .trow > div:nth-child(n+3), .trow-head > div:nth-child(n+3) { display: none; }
}
</style>
