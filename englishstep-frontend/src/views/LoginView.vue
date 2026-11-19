<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// View mode: 'signin' | 'signup'
const mode = ref('signin')

// Form Fields
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const mfaCode = ref('')
const formError = ref('')

// Social Auth Modal State
const socialModal = ref(null) // 'google' | 'facebook' | null
const socialEmail = ref('')
const socialName = ref('')

function navigateAfterAuth() {
  const dest = String(route.query.next || '/practice')
  router.replace(dest)
}

async function handleSignIn() {
  formError.value = ''
  const res = await auth.login(email.value.trim(), password.value)
  if (res?.mfaRequired) {
    return
  }
  if (res?.success) {
    navigateAfterAuth()
  }
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
  if (ok) {
    navigateAfterAuth()
  }
}

async function handleVerify2Fa() {
  formError.value = ''
  if (!mfaCode.value || mfaCode.value.trim().length !== 6) {
    formError.value = 'Please enter a valid 6-digit verification code.'
    return
  }

  const ok = await auth.verify2Fa(mfaCode.value.trim())
  if (ok) {
    navigateAfterAuth()
  }
}

function openSocialModal(provider) {
  formError.value = ''
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

function switchToSignupWithEmail() {
  mode.value = 'signup'
  formError.value = ''
}

function cancel2Fa() {
  auth.mfaRequired = false
  auth.mfaToken = null
  mfaCode.value = ''
  formError.value = ''
}
</script>

<template>
  <div class="auth-container">
    <!-- Social OAuth Dialog Modal -->
    <div v-if="socialModal" class="modal-backdrop" @click.self="socialModal = null">
      <div class="modal-card">
        <div class="modal-header">
          <div v-if="socialModal === 'google'" class="social-logo google-logo">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          </div>
          <div v-else class="social-logo facebook-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <h3>{{ socialModal === 'google' ? 'Sign in with Google' : 'Sign in with Facebook' }}</h3>
          <p class="modal-sub">
            Direct Single Sign-On: Authenticate with your existing {{ socialModal === 'google' ? 'Google' : 'Facebook' }} account without creating a password beforehand.
          </p>
        </div>

        <div class="social-account-card">
          <label class="modal-field">
            Account Name
            <input v-model="socialName" type="text" required />
          </label>
          <label class="modal-field">
            {{ socialModal === 'google' ? 'Google Email' : 'Facebook Email' }}
            <input v-model="socialEmail" type="email" required />
          </label>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn secondary" @click="socialModal = null">Cancel</button>
          <button type="button" class="btn primary" @click="confirmSocialLogin">
            Continue as {{ socialName.split(' ')[0] || 'User' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 2FA Verification Mode -->
    <section v-if="auth.mfaRequired" class="card auth-card">
      <div class="auth-header">
        <div class="mfa-shield-icon">🛡️</div>
        <h1>Two-Factor Authentication</h1>
        <p class="subtitle">Please enter the 6-digit verification code to complete sign in.</p>
      </div>

      <div class="demo-otp-banner">
        <span>Test 2FA Code: <strong>{{ auth.tempCodeHint || '123456' }}</strong></span>
        <button type="button" class="btn-text-action" @click="mfaCode = auth.tempCodeHint || '123456'">Auto-Fill</button>
      </div>

      <form @submit.prevent="handleVerify2Fa" class="auth-form">
        <label>
          Verification Code
          <input
            v-model="mfaCode"
            type="text"
            maxlength="6"
            placeholder="123456"
            class="otp-input"
            autocomplete="one-time-code"
            autofocus
            required
          />
        </label>

        <p v-if="auth.error || formError" class="error-msg" role="alert">
          {{ auth.error || formError }}
        </p>

        <button type="submit" class="btn primary btn-block" :disabled="auth.busy">
          {{ auth.busy ? 'Verifying…' : 'Verify & Sign In' }}
        </button>

        <button type="button" class="btn-secondary-link" @click="cancel2Fa">
          ← Cancel and return to Sign In
        </button>
      </form>
    </section>

    <!-- Normal Sign In / Sign Up Mode -->
    <section v-else class="card auth-card">
      <!-- Tab Header -->
      <div class="tab-header">
        <button
          type="button"
          :class="['tab-btn', { active: mode === 'signin' }]"
          @click="mode = 'signin'; formError = ''"
        >
          Sign In
        </button>
        <button
          type="button"
          :class="['tab-btn', { active: mode === 'signup' }]"
          @click="mode = 'signup'; formError = ''"
        >
          Create Account
        </button>
      </div>

      <div class="auth-header">
        <h1>{{ mode === 'signin' ? 'Welcome back' : 'Create an account' }}</h1>
        <p class="subtitle">
          {{ mode === 'signin' ? 'Enter your credentials to access your account' : 'Register your details to start adaptive English learning' }}
        </p>
      </div>

      <!-- Social Logins (Google & Facebook: No prior account creation needed) -->
      <div class="social-login-grid">
        <button type="button" class="social-btn google-btn" :disabled="auth.busy" @click="openSocialModal('google')">
          <svg class="social-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google
        </button>

        <button type="button" class="social-btn facebook-btn" :disabled="auth.busy" @click="openSocialModal('facebook')">
          <svg class="social-icon" viewBox="0 0 24 24" width="20" height="20" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </button>
      </div>

      <div class="divider">
        <span>or with email</span>
      </div>

      <!-- Sign In Form (Blocked if account does not exist) -->
      <form v-if="mode === 'signin'" @submit.prevent="handleSignIn" class="auth-form">
        <label>
          Email address
          <input v-model="email" type="email" autocomplete="username" placeholder="name@example.com" required />
        </label>

        <label>
          Password
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
        </label>

        <div v-if="auth.error || formError" class="error-box" role="alert">
          <p class="error-msg">{{ auth.error || formError }}</p>
          <button
            v-if="auth.error && auth.error.includes('Create Account')"
            type="button"
            class="btn-cta-link"
            @click="switchToSignupWithEmail"
          >
            → Click here to Register Now
          </button>
        </div>

        <button type="submit" class="btn primary btn-block" :disabled="auth.busy">
          {{ auth.busy ? 'Signing in…' : 'Sign In' }}
        </button>

        <p class="switch-prompt">
          Don't have an account yet?
          <button type="button" class="link-btn" @click="switchToSignupWithEmail">Create one now</button>
        </p>
      </form>

      <!-- Sign Up Form -->
      <form v-else @submit.prevent="handleSignUp" class="auth-form">
        <label>
          Full Name
          <input v-model="name" type="text" placeholder="Alex Johnson" required />
        </label>

        <label>
          Email address
          <input v-model="email" type="email" autocomplete="username" placeholder="name@example.com" required />
        </label>

        <label>
          Password
          <input v-model="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required />
        </label>

        <label>
          Confirm Password
          <input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="••••••••" required />
        </label>

        <div v-if="auth.error || formError" class="error-box" role="alert">
          <p class="error-msg">{{ auth.error || formError }}</p>
        </div>

        <button type="submit" class="btn primary btn-block" :disabled="auth.busy">
          {{ auth.busy ? 'Creating account…' : 'Create Account' }}
        </button>

        <p class="switch-prompt">
          Already have an account?
          <button type="button" class="link-btn" @click="mode = 'signin'; formError = ''">Sign in here</button>
        </p>
      </form>
    </section>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 75vh;
  padding: 1.5rem 1rem;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  padding: 2rem 1.75rem;
}

/* Tab Header */
.tab-header {
  display: flex;
  border-bottom: 2px solid #f3f4f6;
  margin-bottom: 1.5rem;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 0.65rem 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.auth-header {
  text-align: center;
  margin-bottom: 1.25rem;
}

.auth-header h1 {
  font-size: 1.5rem;
  color: #111827;
  margin: 0 0 0.35rem;
}

.subtitle {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}

/* Social Buttons */
.social-login-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.social-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1.25rem 0;
  color: #9ca3af;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e5e7eb;
}

.divider span {
  padding: 0 0.75rem;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #374151;
  text-align: left;
}

.auth-form input {
  padding: 0.65rem 0.85rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.auth-form input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.btn-block {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.error-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  text-align: left;
}

.error-msg {
  color: #dc2626;
  font-size: 0.85rem;
  margin: 0;
  font-weight: 500;
}

.btn-cta-link {
  background: none;
  border: none;
  color: #4f46e5;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.35rem 0 0;
  cursor: pointer;
  display: block;
}

.switch-prompt {
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.link-btn {
  background: none;
  border: none;
  color: #4f46e5;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0.25rem;
}

/* 2FA Shield */
.mfa-shield-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.otp-input {
  text-align: center;
  font-size: 1.5rem !important;
  letter-spacing: 0.3em;
  font-family: monospace;
}

.demo-otp-banner {
  background: #eff6ff;
  border: 1px dashed #60a5fa;
  color: #1e40af;
  padding: 0.65rem;
  border-radius: 6px;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.btn-text-action {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.btn-secondary-link {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 0.5rem;
  padding: 0.35rem;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  padding: 1rem;
}

.modal-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 1.75rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  text-align: center;
}

.modal-header h3 {
  margin: 0.5rem 0 0.25rem;
  font-size: 1.25rem;
}

.modal-sub {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0.35rem 0 1.25rem;
  line-height: 1.4;
}

.social-account-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
}

.modal-field input {
  padding: 0.5rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
