import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite' // 1. Import plugin Tailwind

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(), // 2. Kích hoạt plugin Tailwind
  ],
  // Khi nối backend thật: proxy /api sang Spring Boot / Node.js
  server: { 
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } 
  }
})