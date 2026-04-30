import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import './assets/global.css'

// Suppress benign ResizeObserver loop error
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) e.stopImmediatePropagation()
})

const app = createApp(App)
app.use(router)
app.mount('#app')
