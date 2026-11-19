import { ApiError, NetworkError } from './errors.js'
import * as mock from './mock.js'
import { getDeviceId } from './device.js'

export { ApiError, NetworkError }

const env = import.meta.env ?? {}
const USE_MOCK = env.VITE_USE_MOCK !== 'false'
const BASE = env.VITE_API_BASE || '/api'

// Session Management per BR-01:
// Access Token kept in memory only.
// Refresh Token stored securely in session/cookie.
export const session = {
  token: null,
  refreshToken: null,
  reauthToken: null,
  reauthExp: 0
}

export const hooks = { onSessionRevoked: null }

function headersFor(path) {
  const h = {}
  if (session.token) {
    h.Authorization = `Bearer ${session.token}`
  }
  const deviceId = getDeviceId()
  if (deviceId) {
    h['X-Device-Id'] = deviceId
  }
  // X-ReAuth-Token for sensitive operations (payment, password change)
  const sensitive = path.startsWith('/payment/') || path.startsWith('/account/')
  if (sensitive && session.reauthToken && Date.now() < session.reauthExp) {
    h['X-ReAuth-Token'] = session.reauthToken
  }
  return h
}

async function http(method, path, body, headers) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new NetworkError()
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error || data
    throw new ApiError(e?.code ?? 'UNKNOWN', res.status, e?.message, e?.details, e?.traceId)
  }
  return data
}

const raw = (method, path, body) =>
  USE_MOCK ? mock.handle(method, path, body, headersFor(path)) : http(method, path, body, headersFor(path))

function revoke() {
  session.token = null
  session.refreshToken = null
  session.reauthToken = null
  hooks.onSessionRevoked?.()
}

// Single-flight refresh queue
let refreshing = null
function refresh() {
  const deviceId = getDeviceId()
  refreshing ??= raw('POST', '/auth/refresh', {
    refresh_token: session.refreshToken,
    device_id: deviceId
  })
    .then((r) => {
      session.token = r.accessToken || r.access_token
      session.refreshToken = r.refreshToken || r.refresh_token
      return r
    })
    .catch((e) => {
      if (e.code === 'SESSION_REVOKED' || e.code === 'REFRESH_TOKEN_INVALID') {
        revoke()
      }
      throw e
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function call(method, path, body, retried = false) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NetworkError()
  try {
    return await raw(method, path, body)
  } catch (e) {
    // 401 TOKEN_EXPIRED: Automatic single-flight refresh and retry
    if (e.code === 'TOKEN_EXPIRED' && !retried) {
      await refresh()
      return call(method, path, body, true)
    }
    if (e.code === 'SESSION_REVOKED' || e.code === 'TOKEN_REVOKED') {
      revoke()
    }
    throw e
  }
}

export const api = {
  // Authentication & Registration
  register: (email, password, name) =>
    call('POST', '/auth/register', {
      email,
      password,
      name,
      device_id: getDeviceId()
    }).then((r) => {
      if (r.access_token || r.accessToken) {
        session.token = r.accessToken || r.access_token
        session.refreshToken = r.refreshToken || r.refresh_token
      }
      return r
    }),

  login: (email, password) =>
    call('POST', '/auth/login', {
      email,
      password,
      device_id: getDeviceId()
    }).then((r) => {
      if (r.access_token || r.accessToken) {
        session.token = r.accessToken || r.access_token
        session.refreshToken = r.refreshToken || r.refresh_token
      }
      return r
    }),

  verify2Fa: (mfaToken, code) =>
    call('POST', '/auth/2fa/verify', {
      mfa_token: mfaToken,
      code,
      device_id: getDeviceId()
    }).then((r) => {
      session.token = r.accessToken || r.access_token
      session.refreshToken = r.refreshToken || r.refresh_token
      return r
    }),

  loginGoogle: (email = 'alex.google@example.com', name = 'Alex Google') =>
    call('POST', '/auth/oauth/google', {
      email,
      name,
      device_id: getDeviceId()
    }).then((r) => {
      session.token = r.accessToken || r.access_token
      session.refreshToken = r.refreshToken || r.refresh_token
      return r
    }),

  loginFacebook: (email = 'alex.facebook@example.com', name = 'Alex Facebook') =>
    call('POST', '/auth/oauth/facebook', {
      email,
      name,
      device_id: getDeviceId()
    }).then((r) => {
      session.token = r.accessToken || r.access_token
      session.refreshToken = r.refreshToken || r.refresh_token
      return r
    }),

  toggle2Fa: () => call('POST', '/auth/2fa/toggle', {}),

  restore: () => refresh(),

  logout: async () => {
    try {
      await call('POST', '/auth/logout', {
        refresh_token: session.refreshToken
      })
    } finally {
      session.token = null
      session.refreshToken = null
      session.reauthToken = null
    }
  },

  logoutAll: async () => {
    try {
      await call('POST', '/auth/logout-all', {})
    } finally {
      revoke()
    }
  },

  reauth: (password) =>
    call('POST', '/auth/reauth', { password }).then((r) => {
      session.reauthToken = r.reauthToken
      session.reauthExp = Date.now() + r.expiresIn * 1000
      return r
    }),

  // JWT Security & Inspection Endpoints
  getMe: () => call('GET', '/auth/me'),
  getJwks: () => call('GET', '/.well-known/jwks.json'),
  getAuditLogs: () => call('GET', '/auth/audit-logs'),
  toggleLockUser: (email) => call('POST', '/admin/toggle-lock', { email }),

  // Learning / Adaptive
  nextItem: () => call('GET', '/adaptive/next-item'),
  startActivity: (activityId) => call('POST', `/learning/activities/${activityId}/start`),
  submit: (attemptId, payload) => call('POST', `/learning/attempts/${attemptId}/submit`, payload),
  override: (kind, overrideId) => call('POST', '/adaptive/override', { kind, override_id: overrideId }),
  progress: () => call('GET', '/learning/progress'),

  // Gamification
  profile: () => call('GET', '/gamification/profile'),
  reward: (rewardId) => call('GET', `/gamification/rewards/${rewardId}`),
  quests: () => call('GET', '/gamification/quests/today'),
  leaderboard: () => call('GET', '/gamification/leaderboard'),

  // Payment
  plans: () => call('GET', '/payment/plans'),
  createOrder: (plan, bizOrderNo) => call('POST', '/payment/orders', { plan, biz_order_no: bizOrderNo }),
  orderStatus: (orderNo) => call('GET', `/payment/orders/${orderNo}/status`)
}
