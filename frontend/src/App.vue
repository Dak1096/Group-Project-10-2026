<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useLearningStore } from './stores/learning'

// 1. Import thanh điều hướng NavBar
import NavBar from './components/NavBar.vue' 

const auth = useAuthStore()
const learn = useLearningStore()
const route = useRoute()
const router = useRouter()

auth.init()

onMounted(() => {
  // Khôi phục token ngay khi tải trang (bắt token từ URL Google/Facebook)
  if (!auth.ready) auth.restore()
  learn.init()
})

// Session expired or revoked -> redirect to /login
watch(() => auth.loggedIn, (ok) => {
  const publicPages = ['/', '/login'];
  if (!ok && !publicPages.includes(route.path)) {
    router.push({ path: '/login', query: { next: route.fullPath } })
  }
  if (ok) learn.flushQueue()
})

// Offline and sync status banner in clear English
const banner = computed(() => {
  if (!learn.online) return `You are currently offline. ${learn.queue.length} completed items saved locally will sync when reconnected. Your streak is protected.`
  if (learn.syncing) return 'Synchronizing results and rewards…'
  if (learn.hasStaleQueue) return 'Some pending items are older than 24 hours and might not count toward your daily streak.'
  if (learn.queue.length) return `${learn.queue.length} item(s) pending synchronization.`
  return ''
})
</script>

<template>
  <!-- 2. Gọi thanh NavBar ở đây -->
  <NavBar />

  <!-- Banner thông báo (Offline/Sync) -->
  <p v-if="banner" class="bg-yellow-100 text-yellow-800 text-center py-2 text-sm font-semibold border-b border-yellow-300 relative z-40" role="status">
    {{ banner }}
  </p>

  <!-- Nội dung chính (Nền tối để đồng bộ) -->
  <main class="bg-[#171a23] min-h-screen">
    <RouterView />
  </main>
</template>

<style scoped>
/* Không cần CSS ở đây */
</style>