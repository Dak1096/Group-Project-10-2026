<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useLearningStore } from './stores/learning'

const auth = useAuthStore()
const learn = useLearningStore()
const route = useRoute()
const router = useRouter()

auth.init()
onMounted(() => learn.init())

// Session expired or revoked -> redirect to /login
watch(() => auth.loggedIn, (ok) => {
  if (!ok && route.path !== '/login') router.push({ path: '/login', query: { next: route.fullPath } })
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
  <header class="top">
    <span class="brand">EnglishStep</span>
    <nav v-if="auth.loggedIn" aria-label="Main Navigation">
      <RouterLink to="/practice">Practice</RouterLink>
      <RouterLink to="/profile">Profile</RouterLink>
      <RouterLink to="/payment">Plans</RouterLink>
      <RouterLink to="/jwt-console" class="jwt-nav-link">🛡 JWT Security</RouterLink>
      <button
        type="button"
        class="link"
        :disabled="learn.queue.length > 0"
        :title="learn.queue.length ? 'Please sync pending items before signing out' : ''"
        @click="auth.logout()"
      >Sign Out</button>
    </nav>
  </header>
  <p v-if="banner" class="banner" role="status">{{ banner }}</p>
  <main><RouterView /></main>
</template>

<style scoped>
.jwt-nav-link {
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  transition: all 0.2s;
}
.jwt-nav-link:hover {
  background: #e0e7ff;
}
</style>
