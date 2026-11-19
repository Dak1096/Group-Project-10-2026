import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

// 1. Import trang chủ mới (HomeView) và các trang khác
import HomeView from './views/HomeView.vue' 
import LoginView from './views/LoginView.vue'
import PracticeView from './views/PracticeView.vue'
import ProfileView from './views/ProfileView.vue'
import PaymentView from './views/PaymentView.vue'
import JwtConsoleView from './views/JwtConsoleView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 2. Gán trang chủ vào đường dẫn '/' thay vì redirect sang /practice
    { path: '/', component: HomeView }, 
    { path: '/login', component: LoginView },
    { path: '/practice', component: PracticeView },
    { path: '/profile', component: ProfileView },
    { path: '/payment', component: PaymentView },
    { path: '/jwt-console', component: JwtConsoleView }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Bắt token từ URL (dành cho Google/Facebook)
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');

  if (tokenFromUrl) {
    localStorage.setItem('token', tokenFromUrl);
    if (to.path === '/login') {
      return '/practice';
    }
  }

  // Khôi phục phiên đăng nhập
  if (!auth.ready) await auth.restore()

  // 3. CẬP NHẬT LOGIC BẢO VỆ:
  // Chỉ chặn nếu người dùng chưa đăng nhập VÀ đang cố vào các trang yêu cầu bảo mật.
  // Cho phép truy cập Trang chủ ('/') và Trang đăng nhập ('/login').
  const publicPages = ['/', '/login'];
  
  if (!auth.loggedIn && !publicPages.includes(to.path)) {
    // Nếu chưa đăng nhập mà cố vào /practice, đá về /login
    return { path: '/login', query: { next: to.fullPath } }
  }
  
  // Nếu đã đăng nhập mà cố tình vào lại trang /login thì đẩy vào trong
  if (auth.loggedIn && to.path === '/login') {
    return '/practice'
  }
})

export default router