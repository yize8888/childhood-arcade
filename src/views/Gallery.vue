<template>
  <div class="gallery-page container">
    <header class="page-head">
      <div>
        <h1 class="page-title">游戏库</h1>
        <p class="page-sub">{{ total }} 个游戏可以试玩，找一个开始吧</p>
      </div>
      <div class="page-head-actions">
        <div class="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="query" placeholder="搜索游戏" aria-label="搜索" />
        </div>
        <router-link v-if="isAuthed" to="/my" class="btn btn-primary">上传 ROM</router-link>
        <router-link v-else to="/auth?mode=register" class="btn btn-primary">注册</router-link>
      </div>
    </header>

    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        全部 <span class="n">{{ total }}</span>
      </button>
      <button
        v-if="isAuthed"
        class="tab tab-fav"
        :class="{ active: activeTab === 'favorites' }"
        :disabled="favoriteCount === 0"
        @click="activeTab = 'favorites'"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3 5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z"/></svg>
        收藏 <span class="n">{{ favoriteCount }}</span>
      </button>
      <button
        v-for="[key, group] in Object.entries(tabGroups)"
        :key="key"
        class="tab"
        :class="{ active: activeTab === key }"
        :disabled="tabCount(key) === 0"
        @click="activeTab = key"
      >
        {{ group.label }} <span class="n">{{ tabCount(key) }}</span>
      </button>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 8" :key="i" class="tile-skel">
        <div class="skeleton skel-art"></div>
        <div class="skel-text">
          <div class="skeleton" style="height: 13px; width: 75%;"></div>
          <div class="skeleton" style="height: 11px; width: 45%;"></div>
        </div>
      </div>
    </div>
    <div v-else-if="!filtered.length" class="empty-state">
      <h3>{{ query ? '没有匹配结果' : '游戏库为空' }}</h3>
      <p v-if="!query">{{ isAuthed ? '上传你的第一个 ROM' : '登录后可以上传自己的 ROM' }}</p>
      <p v-else>换个关键词试试</p>
      <router-link v-if="!query && isAuthed" to="/my" class="btn btn-primary">去上传</router-link>
      <router-link v-if="!query && !isAuthed" to="/auth" class="btn btn-primary">登录 / 注册</router-link>
      <button v-if="query" class="btn" @click="query = ''">清除搜索</button>
    </div>
    <div v-else class="grid">
      <article
        v-for="rom in filtered"
        :key="rom.id"
        class="tile"
        tabindex="0"
        @click="play(rom)"
        @keydown.enter="play(rom)"
        :aria-label="rom.title"
      >
        <div class="tile-art" :style="{ background: artBg(rom.platform) }">
          <span class="art-letter">{{ rom.title.slice(0, 1).toUpperCase() }}</span>
          <button
            v-if="isAuthed"
            class="fav-btn"
            :class="{ on: rom.isFavorite }"
            :title="rom.isFavorite ? '取消收藏' : '收藏'"
            @click.stop="toggleFavorite(rom)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="rom.isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 17.3 5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z"/></svg>
          </button>
          <span v-if="rom.versionCount" class="ver-badge" :title="`${rom.versionCount + 1} 个版本`">
            {{ rom.versionCount + 1 }} 版本
          </span>
        </div>
        <div class="tile-body">
          <div class="tile-top">
            <h3 class="tile-title">{{ rom.title }}</h3>
            <span class="tile-plat">{{ platformLabel(rom.platform) }}</span>
          </div>
          <div class="tile-sub">
            <span>{{ platformDisplay(rom.platform) }}</span>
            <span v-if="rom.owner" class="owner">@{{ rom.owner.username }}</span>
          </div>
        </div>
      </article>
    </div>

    <VersionPickerDialog
      v-if="pickerRom"
      :rom="pickerRom"
      @close="pickerRom = null"
      @pick="onVersionPicked"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { useAuth } from '../composables/useAuth.js'
import { tabGroups, getPlatform } from '../constants/platforms.js'
import { useSettings } from '../composables/useSettings.js'
import VersionPickerDialog from '../components/VersionPickerDialog.vue'

const router = useRouter()
const { isAuthed } = useAuth()
const { settings } = useSettings()
const guestPlayEnabled = computed(() => settings.value?.guestPlayEnabled === true || settings.value?.guestPlayEnabled === '1')

const roms = ref([])
const loading = ref(true)
const query = ref('')
const activeTab = ref('all')

async function load() {
  loading.value = true
  try { roms.value = (await api.romsPublic()).roms }
  catch { roms.value = [] }
  finally { loading.value = false }
}
onMounted(load)

const total = computed(() => roms.value.length)
const favoriteCount = computed(() => roms.value.filter((r) => r.isFavorite).length)

function tabCount(key) {
  const allowed = new Set(tabGroups[key]?.platforms || [])
  return roms.value.filter((r) => allowed.has(r.platform)).length
}

const filtered = computed(() => {
  let list = roms.value
  if (activeTab.value === 'favorites') {
    list = list.filter((r) => r.isFavorite)
  } else if (activeTab.value !== 'all') {
    const allowed = new Set(tabGroups[activeTab.value]?.platforms || [])
    list = list.filter((r) => allowed.has(r.platform))
  }
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter((r) => r.title.toLowerCase().includes(q))
  return list
})

async function toggleFavorite(rom) {
  const prev = !!rom.isFavorite
  rom.isFavorite = !prev
  try {
    if (prev) await api.romUnfavorite(rom.id)
    else      await api.romFavorite(rom.id)
  } catch (err) {
    rom.isFavorite = prev
    alert(err?.message || '操作失败')
  }
}

function platformLabel(p) { return getPlatform(p).shortLabel }
function platformDisplay(p) { return getPlatform(p).displayName }
function artBg(p) {
  const c = getPlatform(p).color
  return `linear-gradient(135deg, ${c}55 0%, ${c}22 100%)`
}

const pickerRom = ref(null)

function play(rom) {
  if (!isAuthed.value && !(guestPlayEnabled.value && rom.isPublic)) {
    router.push(`/auth?redirect=${encodeURIComponent('/play/' + rom.id)}`)
    return
  }
  if (rom.versionCount > 0) {
    pickerRom.value = rom
    return
  }
  router.push(`/play/${rom.id}`)
}

function onVersionPicked(v) {
  pickerRom.value = null
  router.push(`/play/${v.id}`)
}
</script>

<style scoped>
.gallery-page { padding-bottom: 60px; }

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  color: var(--text-tertiary);
  min-width: 220px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.search input {
  flex: 1; height: 100%;
  background: transparent; border: 0; outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  min-width: 0;
}
.search input::placeholder { color: var(--text-quaternary); }

/* ── Tabs ────────────────────────────────────────────── */
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
.tab:hover:not(:disabled) { color: var(--text-primary); }
.tab.active {
  color: var(--text-primary);
  font-weight: 600;
  border-bottom-color: var(--accent);
}
.tab:disabled { opacity: 0.4; cursor: not-allowed; }
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
  transition: background var(--t-fast), color var(--t-fast);
}
.tab.active .n { background: var(--accent-soft); color: var(--accent); }
.tab-fav svg { color: var(--sys-yellow); }

/* ── Grid ────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.tile-skel {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-1);
}
.skel-art { width: 56px; height: 56px; flex-shrink: 0; border-radius: var(--r-sm); }
.skel-text { flex: 1; display: flex; flex-direction: column; gap: 6px; justify-content: center; }

.tile {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  outline: none;
  transition: transform var(--t-fast) var(--ease-out),
              border-color var(--t-fast) var(--ease-out),
              box-shadow var(--t-fast) var(--ease-out);
}
.tile:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.tile:focus-visible {
  border-color: var(--accent);
  box-shadow: var(--shadow-focus);
}

.tile-art {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  text-transform: uppercase;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.art-letter { line-height: 1; position: relative; z-index: 1; }

.fav-btn {
  position: absolute;
  top: 3px; right: 3px;
  width: 22px; height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  opacity: 0;
  z-index: 2;
  transition: opacity var(--t-fast), background var(--t-fast), transform var(--t-fast) var(--ease-spring);
}
.tile:hover .fav-btn,
.tile:focus-within .fav-btn,
.fav-btn.on { opacity: 1; }
.fav-btn.on { color: var(--sys-yellow); background: rgba(0, 0, 0, 0.55); }
.fav-btn:hover { background: rgba(0, 0, 0, 0.65); transform: scale(1.08); }
.fav-btn:active { transform: scale(0.92); }

.ver-badge {
  position: absolute;
  bottom: 3px; right: 3px;
  padding: 2px 7px;
  border-radius: var(--r-pill);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  z-index: 2;
}

.tile-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tile-top {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.tile-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  letter-spacing: -0.01em;
  transition: color var(--t-fast);
}
.tile:hover .tile-title { color: var(--accent); }
.tile-plat {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--bg-3);
  color: var(--text-secondary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.tile-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  gap: 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tile-sub .owner { color: var(--text-secondary); }

@media (max-width: 768px) {
  .page-head { flex-direction: column; align-items: stretch; }
  .page-head-actions { flex-direction: row; gap: 8px; }
  .search { flex: 1; min-width: 0; }
}
@media (max-width: 480px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
