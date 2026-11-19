import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'
import LoginView from './views/LoginView.vue'
import PracticeView from './views/PracticeView.vue'
import ProfileView from './views/ProfileView.vue'
import PaymentView from './views/PaymentView.vue'
import JwtConsoleView from './views/JwtConsoleView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/practice' },
    { path: '/login', component: LoginView },
    { path: '/practice', component: PracticeView },
    { path: '/profile', component: ProfileView },
    { path: '/payment', component: PaymentView },
    { path: '/jwt-console', component: JwtConsoleView }
  ]
})

// Hầu hết endpoint cần JWT: chưa có phiên thì khôi phục bằng cookie refresh, không được thì về /login
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.restore()
  if (!auth.loggedIn && to.path !== '/login') return { path: '/login', query: { next: to.fullPath } }
  if (auth.loggedIn && to.path === '/login') return '/practice'
})

export default router
