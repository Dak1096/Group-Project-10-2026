<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { socialAuth } from '../api'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// --- 1. XỬ LÝ TOKEN TỪ OAUTH ---
onMounted(() => {
  const token = route.query.token;
  if (token) {
    localStorage.setItem('token', token);
    router.replace({ path: '/practice' }); 
  }
});

// --- 2. TRẠNG THÁI FORM ---
const mode = ref('signin') // 'signin' | 'signup'
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPw = ref(false)
const formError = ref(
  route.query.error === 'config' ? 'Social sign-in is not configured yet.'
    : route.query.error ? 'Social sign-in failed. Please try again.' : ''
)

// --- 3. SOCIAL & FORGOT PASSWORD STATE ---
const socialModal = ref(null) 
const socialEmail = ref('')
const socialName = ref('')
const showForgotModal = ref(false)
const forgotEmail = ref('')
const forgotMessage = ref('')
const isSending = ref(false)

// --- 4. CÁC HÀM XỬ LÝ LOGIC (GIỮ NGUYÊN TỪ BẢN CŨ) ---
function navigateAfterAuth() {
  const dest = String(route.query.next || '/practice')
  router.replace(dest)
}

async function handleSignIn() {
  formError.value = ''
  const res = await auth.login(email.value.trim(), password.value)
  if (res?.mfaRequired) return
  if (res?.success) navigateAfterAuth()
}

async function handleSignUp() {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Please enter your full name.'
    return
  }
  if (password.value !== confirmPassword.value) {
    formError.value = 'Passwords do not match.'
    return
  }
  if (password.value.length < 6) {
    formError.value = 'Password must be at least 6 characters long.'
    return
  }
  const ok = await auth.register(email.value.trim(), password.value, name.value.trim())
  if (ok) navigateAfterAuth()
}

async function handleVerify2Fa() {
  formError.value = ''
  if (!auth.mfaCode || auth.mfaCode.trim().length !== 6) {
    formError.value = 'Please enter a valid 6-digit verification code.'
    return
  }
  const ok = await auth.verify2Fa(auth.mfaCode.trim())
  if (ok) navigateAfterAuth()
}

function openSocialModal(provider) {
  formError.value = ''
  if (socialAuth.enabled) return auth.startSocialLogin(provider, String(route.query.next || '/practice'))
  socialModal.value = provider
  if (provider === 'google') {
    socialEmail.value = 'sarah.connor@gmail.com'
    socialName.value = 'Sarah Connor'
  } else {
    socialEmail.value = 'mark.fb@facebook.com'
    socialName.value = 'Mark Zuckerberg'
  }
}

async function confirmSocialLogin() {
  formError.value = ''
  const provider = socialModal.value
  socialModal.value = null
  let ok = false
  if (provider === 'google') {
    ok = await auth.loginWithGoogle(socialEmail.value.trim(), socialName.value.trim())
  } else {
    ok = await auth.loginWithFacebook(socialEmail.value.trim(), socialName.value.trim())
  }
  if (ok) navigateAfterAuth()
}

function switchToSignup() {
  mode.value = 'signup'
  formError.value = ''
}

async function handleForgotPassword() {
  if (!forgotEmail.value) return;
  isSending.value = true;
  forgotMessage.value = '';
  try {
    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail.value })
    });
    const data = await res.json();
    if (res.ok) forgotMessage.value = 'Email sent! Please check your inbox.';
    else forgotMessage.value = data.error || 'An error occurred.';
  } catch (error) {
    forgotMessage.value = 'Server connection error.';
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <!-- Đã xóa thẻ header thừa ở đây -->
  <div class="min-h-screen bg-[#171a23] text-[#e8eaf2] font-sans flex flex-col">
    <main class="flex-1 flex justify-center py-12 px-4 relative">
      
      <!-- 2FA SECTION -->
      <div v-if="auth.mfaRequired" class="w-full max-w-[360px]">
        <div class="text-center mb-6">
          <div class="text-5xl mb-2">🛡️</div>
          <h1 class="text-3xl font-bold mb-2">Two-Factor Auth</h1>
          <p class="text-[#9aa1b8] text-sm">Enter the 6-digit code to continue.</p>
        </div>
        <div class="bg-[#2a2e3b] border border-[#3a3f52] rounded-lg p-3 mb-6 flex justify-between items-center text-sm text-[#7fa4ff]">
          <span>Test Code: <strong>{{ auth.tempCodeHint || '123456' }}</strong></span>
          <button type="button" class="font-bold underline" @click="auth.mfaCode = auth.tempCodeHint || '123456'">Auto-Fill</button>
        </div>
        <form @submit.prevent="handleVerify2Fa" class="space-y-4">
          <input v-model="auth.mfaCode" type="text" maxlength="6" placeholder="123456" required class="w-full h-[46px] text-center text-2xl tracking-[0.5em] font-mono bg-[#2a2e3b] rounded-md border focus:border-[#7fa4ff] focus:outline-none" />
          <p v-if="auth.error || formError" class="text-red-400 text-sm text-center">{{ auth.error || formError }}</p>
          <button type="submit" class="w-full h-[46px] rounded-full bg-[#3ddc97] text-[#0b2e22] font-extrabold text-[16px]" :disabled="auth.busy">Verify & Start Game</button>
        </form>
      </div>

      <!-- FORM ĐĂNG NHẬP CHÍNH -->
      <div v-else class="w-full max-w-[360px]">
        
        <!-- Tab Sign In / Register -->
        <div class="flex border-b border-[#3a3f52] mb-6">
          <button @click="mode = 'signin'; formError = ''" :class="['flex-1 pb-3 font-bold text-lg transition-colors', mode === 'signin' ? 'text-[#3ddc97] border-b-2 border-[#3ddc97]' : 'text-gray-400 hover:text-white']">Log In</button>
          <button @click="mode = 'signup'; formError = ''" :class="['flex-1 pb-3 font-bold text-lg transition-colors', mode === 'signup' ? 'text-[#3ddc97] border-b-2 border-[#3ddc97]' : 'text-gray-400 hover:text-white']">Sign Up</button>
        </div>

        <h1 class="text-center text-3xl font-bold mb-6">{{ mode === 'signin' ? 'Welcome back!' : 'Create an account' }}</h1>

        <!-- Nút Social -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <button @click="openSocialModal('google')" class="flex items-center justify-center gap-2 h-[44px] border border-[#3a3f52] rounded-full hover:bg-white/5 transition-colors font-semibold text-sm">
            <svg class="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            Google
          </button>
          <button @click="openSocialModal('facebook')" class="flex items-center justify-center gap-2 h-[44px] border border-[#3a3f52] rounded-full hover:bg-white/5 transition-colors font-semibold text-sm">
            <svg class="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </button>
        </div>

        <div class="flex items-center gap-4 my-6 text-[#9aa1b8] text-xs font-bold">
          <div class="flex-1 h-px bg-[#3a3f52]"></div>
          <span>OR</span>
          <div class="flex-1 h-px bg-[#3a3f52]"></div>
        </div>

        <!-- Form -->
        <form @submit.prevent="mode === 'signin' ? handleSignIn() : handleSignUp()" class="space-y-4">
          
          <div v-if="mode === 'signup'">
            <label class="block text-sm font-bold text-[#9aa1b8] mb-2">Full Name</label>
            <input v-model="name" type="text" required placeholder="Alex Johnson" class="w-full h-[44px] px-4 bg-[#2a2e3b] rounded-md border border-transparent focus:border-[#7fa4ff] focus:outline-none transition-colors" />
          </div>

          <div>
            <label class="block text-sm font-bold text-[#7fa4ff] mb-2">Email</label>
            <input v-model="email" type="email" required placeholder="name@example.com" class="w-full h-[44px] px-4 bg-[#2a2e3b] rounded-md border border-transparent focus:border-[#7fa4ff] focus:outline-none transition-colors placeholder-[#6f768d]" />
          </div>

          <div>
            <label class="block text-sm font-bold text-[#9aa1b8] mb-2">Password</label>
            <div class="relative">
              <input v-model="password" :type="showPw ? 'text' : 'password'" required minlength="6" class="w-full h-[44px] px-4 bg-[#2a2e3b] rounded-md border border-transparent focus:border-[#7fa4ff] focus:outline-none transition-colors" />
              <button type="button" @click="showPw = !showPw" class="absolute right-3 top-1/2 -translate-y-1/2 text-[#7fa4ff] text-xs font-bold">{{ showPw ? 'Hide' : 'Show' }}</button>
            </div>
          </div>

          <div v-if="mode === 'signup'">
            <label class="block text-sm font-bold text-[#9aa1b8] mb-2">Confirm Password</label>
            <input v-model="confirmPassword" :type="showPw ? 'text' : 'password'" required class="w-full h-[44px] px-4 bg-[#2a2e3b] rounded-md border border-transparent focus:border-[#7fa4ff] focus:outline-none transition-colors" />
          </div>

          <div v-if="mode === 'signin'" class="text-right">
            <button type="button" @click="showForgotModal = true" class="text-[#7fa4ff] text-sm font-bold hover:underline">Forgot password?</button>
          </div>

          <div v-if="auth.error || formError" class="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-center text-red-300 text-sm">
            {{ auth.error || formError }}
          </div>

          <button type="submit" class="w-full h-[46px] rounded-full bg-[#3ddc97] text-[#0b2e22] font-extrabold text-[16px] hover:brightness-110 transition disabled:opacity-50" :disabled="auth.busy">
            {{ auth.busy ? 'Processing...' : (mode === 'signin' ? 'Log In' : 'Create Account') }}
          </button>
        </form>
      </div>
    </main>

    <!-- MODAL SOCIAL LOGIN GIẢ LẬP -->
    <div v-if="socialModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="socialModal = null">
      <div class="bg-[#1f2330] border border-[#3a3f52] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="text-xl font-bold mb-2">{{ socialModal === 'google' ? 'Google Sign In' : 'Facebook Sign In' }}</h3>
        <p class="text-xs text-gray-400 mb-4">This is a mock login. In production, this redirects to the provider.</p>
        <input v-model="socialName" type="text" placeholder="Name" class="w-full h-[40px] px-3 bg-[#2a2e3b] rounded-md border border-transparent mb-3 focus:border-[#7fa4ff] outline-none" />
        <input v-model="socialEmail" type="email" placeholder="Email" class="w-full h-[40px] px-3 bg-[#2a2e3b] rounded-md border border-transparent mb-4 focus:border-[#7fa4ff] outline-none" />
        <div class="flex justify-end gap-3">
          <button @click="socialModal = null" class="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white">Cancel</button>
          <button @click="confirmSocialLogin" class="px-4 py-2 text-sm font-bold bg-[#3ddc97] text-black rounded-md hover:brightness-110">Continue</button>
        </div>
      </div>
    </div>

    <!-- MODAL FORGOT PASSWORD -->
    <div v-if="showForgotModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="showForgotModal = false">
      <div class="bg-[#1f2330] border border-[#3a3f52] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="text-xl font-bold mb-2">Reset Password</h3>
        <p class="text-xs text-gray-400 mb-4">Enter your email to receive a reset link.</p>
        <input v-model="forgotEmail" type="email" placeholder="name@example.com" class="w-full h-[40px] px-3 bg-[#2a2e3b] rounded-md border border-transparent mb-2 focus:border-[#7fa4ff] outline-none" />
        
        <div v-if="forgotMessage" class="my-3 text-center">
          <p class="text-green-400 text-sm mb-2">{{ forgotMessage }}</p>
          <a href="https://mail.google.com" target="_blank" class="inline-block px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-md">Open Gmail</a>
        </div>

        <div class="flex justify-end gap-3 mt-4">
          <button @click="showForgotModal = false" class="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white">Cancel</button>
          <button @click="handleForgotPassword" class="px-4 py-2 text-sm font-bold bg-[#7fa4ff] text-black rounded-md hover:brightness-110" :disabled="isSending">
            {{ isSending ? 'Sending...' : 'Send Link' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap');
.font-sans {
  font-family: 'Figtree', sans-serif;
}
</style>