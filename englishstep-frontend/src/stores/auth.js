import { defineStore } from 'pinia'
import { api, hooks, session } from '../api'
import { decodeJwt } from '../api/jwt-crypto.js'
import { getDeviceId, setDeviceId } from '../api/device.js'

const MESSAGES = {
  USER_NOT_FOUND: 'No account found with this email. Please click "Create Account" to sign up first.',
  INVALID_CREDENTIALS: 'Incorrect password. Please try again.',
  ACCOUNT_LOCKED: 'Your account is locked. Please contact support.',
  NETWORK: 'Network unavailable. Check your connection and try again.',
  TOKEN_EXPIRED: 'Access Token has expired.',
  TOKEN_INVALID: 'Invalid token or signature verification failed.',
  TOKEN_REVOKED: 'Token has been revoked.',
  SESSION_REVOKED: 'Your session has been terminated (token reuse or remote sign-out). Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token or device mismatch.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  '2FA_INVALID_CODE': 'Incorrect 6-digit code. Please try again (Hint: 123456).',
  '2FA_EXPIRED': 'Verification code has expired. Please log in again.'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ready: false,
    user: null,
    error: '',
    busy: false,
    token: null,
    refreshToken: null,
    decoded: null,
    deviceId: getDeviceId(),
    auditLogs: [],
    previousRotatedRt: null,
    // 2FA Challenge State
    mfaRequired: false,
    mfaToken: null,
    tempCodeHint: null
  }),

  getters: {
    loggedIn: (s) => !!s.user,
    tokenPayload: (s) => s.decoded?.payload || null,
    tokenHeader: (s) => s.decoded?.header || null,
    tokenSignature: (s) => s.decoded?.signature || '',
    tokenExpSeconds: (s) => s.decoded?.payload?.exp || 0,
    isExpired: (s) => {
      if (!s.decoded?.payload?.exp) return false
      return Math.floor(Date.now() / 1000) >= s.decoded.payload.exp
    }
  },

  actions: {
    init() {
      this.deviceId = getDeviceId()
      hooks.onSessionRevoked = () => {
        this.user = null
        this.token = null
        this.refreshToken = null
        this.decoded = null
        this.mfaRequired = false
        this.mfaToken = null
      }
    },

    updateTokenState() {
      this.token = session.token
      this.refreshToken = session.refreshToken
      this.decoded = session.token ? decodeJwt(session.token) : null
    },

    async restore() {
      try {
        const r = await api.restore()
        this.user = r.user ?? {}
        this.updateTokenState()
      } catch {
        this.user = null
        this.token = null
        this.refreshToken = null
        this.decoded = null
      } finally {
        this.ready = true
      }
    },

    async login(email, password) {
      this.busy = true
      this.error = ''
      this.mfaRequired = false
      try {
        const r = await api.login(email, password)
        if (r.mfa_required) {
          this.mfaRequired = true
          this.mfaToken = r.mfa_token
          this.tempCodeHint = r.temp_code_hint || '123456'
          return { mfaRequired: true }
        }
        this.user = r.user ?? {}
        this.previousRotatedRt = null
        this.updateTokenState()
        await this.fetchAuditLogs()
        return { success: true }
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Unable to sign in. Please try again.')
        return { success: false, error: this.error }
      } finally {
        this.busy = false
      }
    },

    async register(email, password, name) {
      this.busy = true
      this.error = ''
      try {
        const r = await api.register(email, password, name)
        this.user = r.user ?? {}
        this.previousRotatedRt = null
        this.updateTokenState()
        await this.fetchAuditLogs()
        return true
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Unable to create account.')
        return false
      } finally {
        this.busy = false
      }
    },

    async verify2Fa(code) {
      this.busy = true
      this.error = ''
      try {
        const r = await api.verify2Fa(this.mfaToken, code)
        this.user = r.user ?? {}
        this.mfaRequired = false
        this.mfaToken = null
        this.tempCodeHint = null
        this.updateTokenState()
        await this.fetchAuditLogs()
        return true
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Invalid 2FA code.')
        return false
      } finally {
        this.busy = false
      }
    },

    async loginWithGoogle() {
      this.busy = true
      this.error = ''
      try {
        const r = await api.loginGoogle('alex.google@example.com', 'Alex Google')
        this.user = r.user ?? {}
        this.updateTokenState()
        await this.fetchAuditLogs()
        return true
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Google sign-in failed.')
        return false
      } finally {
        this.busy = false
      }
    },

    async loginWithFacebook() {
      this.busy = true
      this.error = ''
      try {
        const r = await api.loginFacebook('alex.facebook@example.com', 'Alex Facebook')
        this.user = r.user ?? {}
        this.updateTokenState()
        await this.fetchAuditLogs()
        return true
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Facebook sign-in failed.')
        return false
      } finally {
        this.busy = false
      }
    },

    async toggle2Fa() {
      try {
        const res = await api.toggle2Fa()
        if (this.user) {
          this.user.two_factor_enabled = res.two_factor_enabled
        }
        await this.fetchAuditLogs()
        return res.two_factor_enabled
      } catch (e) {
        this.error = e.message
      }
    },

    async logout() {
      try {
        await api.logout()
      } catch {}
      this.user = null
      this.token = null
      this.refreshToken = null
      this.decoded = null
      this.previousRotatedRt = null
      this.mfaRequired = false
      this.mfaToken = null
    },

    async logoutAll() {
      try {
        await api.logoutAll()
      } catch {}
      this.user = null
      this.token = null
      this.refreshToken = null
      this.decoded = null
      this.previousRotatedRt = null
      this.mfaRequired = false
      this.mfaToken = null
    },

    // Refresh manually for testing rotation (TC-05)
    async manualRefresh() {
      this.busy = true
      this.error = ''
      const oldRt = session.refreshToken
      try {
        await api.restore()
        this.previousRotatedRt = oldRt
        this.updateTokenState()
        await this.fetchAuditLogs()
        return true
      } catch (e) {
        this.error = MESSAGES[e.code] ?? (e.message || 'Token refresh failed')
        return false
      } finally {
        this.busy = false
      }
    },

    async simulateReuseAttack() {
      if (!this.previousRotatedRt) {
        throw new Error('No previously rotated refresh token found. Perform at least 1 refresh first!')
      }
      this.busy = true
      this.error = ''
      try {
        session.refreshToken = this.previousRotatedRt
        await api.restore()
        return false
      } catch (e) {
        this.error = MESSAGES[e.code] ?? e.message
        await this.fetchAuditLogs()
        return e
      } finally {
        this.busy = false
      }
    },

    tamperCurrentToken() {
      if (!session.token) return
      const parts = session.token.split('.')
      if (parts.length === 3) {
        const tampered = parts[1].slice(0, -2) + (parts[1].endsWith('A') ? 'B' : 'A') + parts[1].slice(-1)
        session.token = `${parts[0]}.${tampered}.${parts[2]}`
        this.updateTokenState()
      }
    },

    changeDevice(newId) {
      setDeviceId(newId)
      this.deviceId = newId
    },

    async toggleAccountLock() {
      if (!this.user?.email) return
      try {
        const res = await api.toggleLockUser(this.user.email)
        await this.fetchAuditLogs()
        return res
      } catch (e) {
        this.error = e.message
      }
    },

    async fetchAuditLogs() {
      try {
        const res = await api.getAuditLogs()
        this.auditLogs = res.logs || []
      } catch {}
    }
  }
})
