<template>
  <div class="rooms-page container">
    <header class="page-head">
      <div>
        <h1 class="page-title">对战大厅</h1>
        <p class="page-sub">和朋友一起开房联机，支持全平台主机和街机 · 游客可直接围观公开房间</p>
      </div>
      <div class="page-head-actions">
        <button class="btn" @click="showJoin = true">输入房间码</button>
        <button v-if="isAuthed" class="btn btn-primary" @click="showCreate = true">新建房间</button>
        <router-link v-else to="/auth" class="btn btn-primary">登录后创建</router-link>
      </div>
    </header>

    <section v-if="isAuthed && myOpenRooms.length" class="section">
      <h2 class="section-title">我主持的</h2>
      <div class="list">
        <article
          v-for="r in myOpenRooms"
          :key="r.id"
          class="row is-mine"
          @click="resume(r)"
        >
          <div class="row-main">
            <div class="row-title">
              <span class="name">{{ r.name }}</span>
              <span class="badge badge-warn">主持</span>
              <span v-if="r.hasPassword" class="badge">需密码</span>
              <span class="badge" :class="r.isPublic ? 'badge-success' : ''">
                {{ r.isPublic ? '公开' : '私密' }}
              </span>
            </div>
            <div class="row-meta">
              <span class="meta-item">
                <span class="pc-dot" :style="{ background: platformColor(r.romPlatform) }"></span>
                {{ platformLabel(r.romPlatform) }} · {{ r.romTitle }}
              </span>
              <code class="meta-code">{{ r.code }}</code>
            </div>
          </div>
          <div class="row-actions" @click.stop>
            <button class="btn btn-sm btn-primary" @click="resume(r)">进入</button>
            <button class="btn btn-sm" @click="editRoom = r">编辑</button>
            <button class="btn btn-sm btn-danger" @click="closeRoom(r)">关闭</button>
          </div>
        </article>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">公开房间</h2>

      <div v-if="loading" class="state">
        <span class="spinner"></span> 加载中…
      </div>
      <div v-else-if="!publicRooms.length" class="empty-state">
        <h3>还没有公开房间</h3>
        <p>第一个创建房间的就是你啦</p>
      </div>
      <div v-else class="list">
        <article
          v-for="r in publicRooms"
          :key="r.id"
          class="row"
          :class="{ offline: r.hostOnline === false }"
          @click="pickRoom(r)"
        >
          <div class="row-main">
            <div class="row-title">
              <span class="name">{{ r.name }}</span>
              <span
                class="badge"
                :class="r.hostOnline === false ? '' : 'badge-success'"
              >
                <span class="dot" :class="{ on: r.hostOnline, off: r.hostOnline === false }"></span>
                {{ r.hostOnline === false ? '离线' : '在线' }}
              </span>
              <span v-if="r.hasPassword" class="badge">需密码</span>
            </div>
            <div class="row-meta">
              <span class="meta-item">
                <span class="pc-dot" :style="{ background: platformColor(r.romPlatform) }"></span>
                {{ platformLabel(r.romPlatform) }} · {{ r.romTitle }}
              </span>
              <span class="meta-item">@{{ r.hostUsername }}</span>
              <code class="meta-code">{{ r.code }}</code>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn-sm btn-primary" :disabled="r.hostOnline === false">
              {{ isAuthed ? '加入' : '围观' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <CreateRoomDialog v-if="showCreate" @close="showCreate = false" @created="onCreated" />
    <JoinRoomDialog v-if="showJoin || pendingRoom" :room="pendingRoom" @close="showJoin = false; pendingRoom = null" @joined="onJoined" />
    <EditRoomDialog v-if="editRoom" :room="editRoom" @close="editRoom = null" @updated="onEdited" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { useAuth } from '../composables/useAuth.js'
import { getPlatform } from '../constants/platforms.js'
import CreateRoomDialog from '../components/CreateRoomDialog.vue'
import JoinRoomDialog from '../components/JoinRoomDialog.vue'
import EditRoomDialog from '../components/EditRoomDialog.vue'

const router = useRouter()
const { isAuthed } = useAuth()

const publicRooms = ref([])
const myRooms = ref([])
const loading = ref(true)
const showCreate = ref(false)
const showJoin = ref(false)
const pendingRoom = ref(null)
const editRoom = ref(null)

const myOpenRooms = computed(() => myRooms.value.filter((r) => !r.closedAt))

async function load() {
  loading.value = true
  try {
    publicRooms.value = (await api.roomsPublic()).rooms
    if (isAuthed.value) {
      myRooms.value = (await api.roomsMine().catch(() => ({ rooms: [] }))).rooms
    }
  } catch { publicRooms.value = [] }
  finally { loading.value = false }
}
onMounted(load)

function pickRoom(r) {
  if (r.hostOnline === false) return
  if (r.hasPassword) pendingRoom.value = r
  else router.push(`/play/${r.romId}?room=${r.code}`)
}
function resume(r) { router.push(`/play/${r.romId}?room=${r.code}`) }
async function closeRoom(r) {
  if (!confirm(`关闭房间 "${r.name}"？已连接的玩家会被踢出。`)) return
  try {
    await api.roomClose(r.code)
    myRooms.value = myRooms.value.filter((x) => x.code !== r.code)
    publicRooms.value = publicRooms.value.filter((x) => x.code !== r.code)
  } catch (err) { alert(err?.message || '关闭失败') }
}
function onCreated(room) {
  showCreate.value = false
  myRooms.value = [room, ...myRooms.value]
  if (room.isPublic) publicRooms.value = [room, ...publicRooms.value]
  router.push(`/play/${room.romId}?room=${room.code}`)
}
function onJoined(room) {
  showJoin.value = false
  pendingRoom.value = null
  router.push(`/play/${room.romId}?room=${room.code}`)
}
function onEdited(room) {
  editRoom.value = null
  const i = myRooms.value.findIndex((r) => r.id === room.id)
  if (i !== -1) myRooms.value[i] = { ...myRooms.value[i], ...room }
  const j = publicRooms.value.findIndex((r) => r.id === room.id)
  if (j !== -1) {
    if (room.isPublic) publicRooms.value[j] = { ...publicRooms.value[j], ...room }
    else publicRooms.value.splice(j, 1)
  } else if (room.isPublic) publicRooms.value = [room, ...publicRooms.value]
}

function platformColor(p) { return getPlatform(p).color }
function platformLabel(p) { return getPlatform(p).shortLabel }
</script>

<style scoped>
.rooms-page { padding-bottom: 60px; }

.section { margin-bottom: 32px; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.list { display: flex; flex-direction: column; gap: 0; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-bottom-width: 0;
  cursor: pointer;
  transition: background var(--t-fast);
}
.row:first-child { border-radius: var(--r-md) var(--r-md) 0 0; }
.row:last-child { border-radius: 0 0 var(--r-md) var(--r-md); border-bottom-width: 1px; }
.row:only-child { border-radius: var(--r-md); }
.row:hover { background: var(--bg-3); }
.row.offline { opacity: 0.6; }
.row.is-mine { border-left: 3px solid var(--accent); }

.row-main { flex: 1; min-width: 0; }
.row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
.dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.dot.on  { background: var(--success); }
.dot.off { background: var(--text-quaternary); }

.row-meta {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
}
.meta-item { display: inline-flex; align-items: center; gap: 6px; }
.pc-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.meta-code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-2);
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.row-actions { display: flex; gap: 6px; flex-shrink: 0; }

.state {
  padding: 24px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}
.spinner {
  display: inline-block;
  width: 14px; height: 14px;
  margin-right: 6px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
  vertical-align: -3px;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .page-head { flex-direction: column; align-items: stretch; }
  .page-head-actions { flex-direction: row; gap: 8px; }
  .row { flex-direction: column; align-items: stretch; }
  .row-actions { justify-content: flex-start; }
}
</style>
