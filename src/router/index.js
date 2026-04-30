import { createRouter, createWebHistory } from 'vue-router'
import { api } from '../api/client.js'

const routes = [
  {
    path: '/',
    name: 'Gallery',
    component: () => import('../views/Gallery.vue'),
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('../views/Auth.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/my',
    name: 'MyRoms',
    component: () => import('../views/MyRoms.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rooms',
    name: 'Rooms',
    component: () => import('../views/Rooms.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/play/:id',
    name: 'Player',
    component: () => import('../views/Player.vue'),
    props: true,
    meta: { fullscreen: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

let cachedUser = undefined

async function getUser() {
  if (cachedUser !== undefined) return cachedUser
  try {
    const { user } = await api.me()
    cachedUser = user
  } catch { cachedUser = null }
  return cachedUser
}

// invalidate cache on route changes with login/logout intent
router.afterEach((to) => {
  if (to.name === 'Auth') cachedUser = undefined
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth || to.meta.requiresAdmin || to.meta.guestOnly) {
    const user = await getUser()
    if (to.meta.requiresAuth && !user) return { path: '/auth', query: { redirect: to.fullPath } }
    if (to.meta.requiresAdmin && user?.role !== 'admin') return { path: '/' }
    if (to.meta.guestOnly && user) return { path: '/' }
  }
  return true
})

export default router
