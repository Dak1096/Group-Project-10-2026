<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const brand = 'EnglishStep'

const topLinks = [
  { label: 'Home', path: '/', active: true },
  { label: 'News', path: '#' },
  { label: 'Help', path: '#' },
  { label: 'Guide', path: '#' },
]

const menu = [
  {
    label: 'Learn',
    children: [
      { label: 'Vocabulary', desc: 'Words by level, IELTS and TOEIC targets', path: '/courses' },
      { label: 'Grammar', desc: 'Short lessons with examples', path: '/courses' },
      { label: 'Pronunciation', desc: 'Practice sounds one by one', path: '/courses' },
    ],
  },
  {
    label: 'Practice',
    children: [
      { label: 'Daily quiz', desc: 'A quick set picked for you', path: '/practice' },
      { label: 'Mock exam', desc: 'Random exam, graded at the end', path: '/exam' },
    ],
  },
  {
    label: 'Exam prep',
    children: [
      { label: 'IELTS', desc: 'Band 5.0 to 8.0 paths', path: '/exam?course=ielts' },
      { label: 'TOEIC', desc: 'Score 450 to 900 paths', path: '/exam?course=toeic' },
    ],
  },
  { label: 'Progress', path: '/practice' },
  { label: 'Leaderboard', path: '#' },
]

const notifications = [
  { text: 'Your daily quiz is ready', time: '5 min ago' },
  { text: 'You kept your 7-day streak', time: '2 h ago' },
]

const userMenu = [
  { label: 'Profile', path: '/profile' },
  { label: 'Settings', path: '#' },
  { label: 'Log out', action: 'logout' },
]

const openKey = ref(null)
const mobileOpen = ref(false)
const root = ref(null)

const toggle = (key) => {
  openKey.value = openKey.value === key ? null : key
}
const close = () => {
  openKey.value = null
  mobileOpen.value = false
}

const handleNavigate = (path, action) => {
  close()
  
  if (action === 'logout') {
    if (typeof auth.logout === 'function') auth.logout()
    localStorage.clear()
    sessionStorage.clear()
    // Ép tải lại trang để xóa sạch state
    window.location.href = '/login'
  } else if (path && path !== '#') {
    router.push(path)
  }
}

const onDocClick = (e) => {
  if (root.value && !root.value.contains(e.target)) openKey.value = null
}
const onKey = (e) => {
  if (e.key === 'Escape') openKey.value = null
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="sticky top-0 z-[100] font-sans bg-[#171a23] text-[#e8eaf2]">
    <!-- Top Bar -->
    <div class="bg-[#26337d] flex justify-end gap-6 px-8 py-2 text-sm font-bold">
      <a
        v-for="l in topLinks"
        :key="l.label"
        @click.prevent="handleNavigate(l.path)"
        :class="['cursor-pointer hover:text-[#3ddc97] transition-colors', l.active ? 'text-[#3ddc97]' : '']"
      >{{ l.label }}</a>
    </div>

    <!-- Main Nav -->
    <nav class="flex items-center gap-7 px-8 min-h-[64px] border-b border-[#2f3447] relative">
      <!-- Logo -->
      <a class="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight cursor-pointer" @click="handleNavigate('/')">
        <span class="w-7 h-6.5 rounded-[9px_9px_9px_3px] bg-gradient-to-b from-[#e8eaf2] via-[#e8eaf2] to-[#8fb0ff] block"></span>
        <span>{{ brand }}</span>
      </a>

      <!-- Mobile Burger -->
      <button
        class="md:hidden text-2xl ml-auto"
        @click="mobileOpen = !mobileOpen"
      >☰</button>

      <!-- Menu Items -->
      <ul :class="['flex items-center gap-1 flex-1 md:flex', mobileOpen ? 'flex flex-col absolute top-full left-0 w-full bg-[#171a23] border-b border-[#2f3447] p-4 z-50' : 'hidden']">
        <li v-for="item in menu" :key="item.label" class="relative">
          <!-- Has Children -->
          <template v-if="item.children">
            <button
              @click.stop="toggle(item.label)"
              class="flex items-center gap-1 px-3 py-2.5 rounded-lg font-bold text-[15px] hover:bg-white/10 transition"
              :class="{ 'bg-white/10': openKey === item.label }"
            >
              {{ item.label }}<span class="text-[16px] leading-none transition-transform" :class="{ 'rotate-180': openKey === item.label }">⌄</span>
            </button>
            <!-- Dropdown Panel -->
            <div
              v-show="openKey === item.label"
              class="absolute left-0 top-[calc(100%+8px)] min-w-[280px] bg-[#1f2330] border border-[#2f3447] rounded-xl p-2 shadow-2xl z-50"
            >
              <a
                v-for="c in item.children"
                :key="c.label"
                @click.prevent="handleNavigate(c.path)"
                class="flex flex-col gap-0.5 p-2.5 rounded-lg cursor-pointer hover:bg-white/5"
              >
                <strong class="text-[15px]">{{ c.label }}</strong>
                <small class="text-[#9aa1b8] text-[13px]">{{ c.desc }}</small>
              </a>
            </div>
          </template>
          <!-- No Children -->
          <a v-else @click.prevent="handleNavigate(item.path)" class="block px-3 py-2.5 rounded-lg font-bold text-[15px] hover:bg-white/10 cursor-pointer">
            {{ item.label }}
          </a>
        </li>
      </ul>

      <!-- Tools (Right Side) -->
      <div class="flex items-center gap-4 ml-auto md:ml-0">
        
        <!-- NÚT LOG IN (Hiện khi CHƯA đăng nhập) -->
        <a v-if="!auth.loggedIn" @click.prevent="handleNavigate('/login')" class="px-5 py-2 bg-[#3ddc97] text-[#0b2e22] font-bold text-sm rounded-full hover:brightness-110 transition cursor-pointer">
          Log In
        </a>

        <!-- KHU VỰC DÀNH CHO NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP -->
        <template v-if="auth.loggedIn">
          <!-- Notifications -->
          <div class="relative">
            <button @click.stop="toggle('bell')" class="relative p-1.5 text-2xl hover:bg-white/10 rounded-lg">
              🔔
              <span class="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-[#3f5fd9] text-white text-[12px] font-bold grid place-items-center">{{ notifications.length }}</span>
            </button>
            <div v-show="openKey === 'bell'" class="absolute right-0 top-[calc(100%+8px)] w-[280px] bg-[#1f2330] border border-[#2f3447] rounded-xl p-2 shadow-2xl z-50">
              <a v-for="n in notifications" :key="n.text" href="#" class="flex flex-col gap-0.5 p-2.5 rounded-lg hover:bg-white/5">
                <strong class="text-[14px]">{{ n.text }}</strong>
                <small class="text-[#9aa1b8] text-[12px]">{{ n.time }}</small>
              </a>
            </div>
          </div>

          <!-- Avatar -->
          <div class="relative">
            <button @click.stop="toggle('user')" class="w-10 h-10 rounded-full bg-[#3f5fd9] text-white font-extrabold text-[18px] grid place-items-center hover:brightness-110 transition">
              J
            </button>
            <div v-show="openKey === 'user'" class="absolute right-0 top-[calc(100%+8px)] w-[180px] bg-[#1f2330] border border-[#2f3447] rounded-xl p-2 shadow-2xl z-50">
              <a
                v-for="u in userMenu"
                :key="u.label"
                @click.prevent="handleNavigate(u.path, u.action)"
                class="block p-2.5 rounded-lg text-[15px] font-bold cursor-pointer hover:bg-white/5"
              >{{ u.label }}</a>
            </div>
          </div>
        </template>

      </div>
    </nav>
  </div>
</template>