import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000'

export default defineConfig({
  base: '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api':    { target: API_TARGET, changeOrigin: true, ws: true },   // WS for /api/rooms/:code/ws
    },
  },
})
