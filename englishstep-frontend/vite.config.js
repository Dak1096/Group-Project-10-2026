import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Khi nối backend thật: proxy /api sang Spring Boot / Node.js
  server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } }
})
