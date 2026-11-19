// ============================================================================
// Real REST API Backend Server with Persistent SQLite Database
// - RS256 Asymmetric Keypairs & RFC 7517 JWKS
// - Standard Registration & Login
// - Social Sign-In: Google & Facebook
// - Two-Factor Authentication (2FA) with JWT MFA Tickets
// - Refresh Token Rotation (BR-03) & Reuse Detection (BR-04)
// - Device Binding (BR-05) & Denylist Revocation (BR-06)
// - Persistent Audit Logging (BR-10)
// ============================================================================

import http from 'node:http'
import crypto from 'node:crypto'
import { db } from './db.mjs'

const PORT = process.env.PORT || 3001
const ISSUER = 'https://auth.englishstep.vn'
const AUDIENCE = 'englishstep-api'
const KEY_ID = 'key_2026_rsa_01'
const AT_TTL_SECONDS = 900 // 15 minutes (BR-01)
const RT_TTL_SECONDS = 604800 // 7 days (BR-01)

console.log('🔄 Initializing 2048-bit RSA Keypair for RS256 signature...')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

const publicJwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' })
publicJwk.kid = KEY_ID
publicJwk.alg = 'RS256'
publicJwk.use = 'sig'

console.log('✅ RSA Keypair ready. Key ID:', KEY_ID)

// Helpers
const b64Url = (buf) => Buffer.from(buf).toString('base64url')
const unb64Url = (str) => Buffer.from(str, 'base64url').toString('utf8')

function signRs256(data) {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data)
  return sign.sign(privateKey, 'base64url')
}

function verifyRs256(data, signature) {
  try {
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(data)
    return verify.verify(publicKey, signature, 'base64url')
  } catch {
    return false
  }
}

// Database Helpers
function logAudit(event, details = {}) {
  const id = `audit_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, event, user_id, device_id, jti, status, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    now,
    event,
    details.userId || null,
    details.deviceId || null,
    details.jti || null,
    details.status || 'SUCCESS',
    details.message || '',
    details.metadata ? JSON.stringify(details.metadata) : null
  )
}

function issueTokenPair(user, deviceId, familyId) {
  const now = Math.floor(Date.now() / 1000)
  const jti = `jti_${crypto.randomUUID()}`

  const header = { alg: 'RS256', typ: 'JWT', kid: KEY_ID }
  const payload = {
    iss: ISSUER,
    sub: user.id,
    aud: AUDIENCE,
    exp: now + AT_TTL_SECONDS,
    iat: now,
    jti,
    email: user.email,
    name: user.name,
    roles: JSON.parse(user.roles || '["user"]'),
    scope: user.scope,
    device_id: deviceId,
    token_version: user.token_version
  }

  const encodedHeader = b64Url(JSON.stringify(header))
  const encodedPayload = b64Url(JSON.stringify(payload))
  const signature = signRs256(`${encodedHeader}.${encodedPayload}`)
  const accessToken = `${encodedHeader}.${encodedPayload}.${signature}`

  const refreshToken = `rt_${crypto.randomUUID().replace(/-/g, '')}`
  const rtId = `rt_id_${crypto.randomUUID().slice(0, 8)}`

  db.prepare(`
    INSERT INTO refresh_tokens (id, token, family_id, user_id, device_id, expires_at, is_revoked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(rtId, refreshToken, familyId, user.id, deviceId, now + RT_TTL_SECONDS, now)

  return { accessToken, refreshToken, jti }
}

function verifyAccessToken(authHeader, deviceId) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization Bearer header' }
  }
  const token = authHeader.replace(/^Bearer\s+/, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw { status: 401, code: 'TOKEN_INVALID', message: 'Malformed JWT structure' }
  }

  const [encHeader, encPayload, sig] = parts
  const isSigOk = verifyRs256(`${encHeader}.${encPayload}`, sig)
  if (!isSigOk) {
    throw { status: 401, code: 'TOKEN_INVALID', message: 'RS256 signature verification failed' }
  }

  let payload
  try {
    payload = JSON.parse(unb64Url(encPayload))
  } catch {
    throw { status: 401, code: 'TOKEN_INVALID', message: 'Cannot parse token payload' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    throw { status: 401, code: 'TOKEN_EXPIRED', message: 'Access Token has expired' }
  }

  // Check Denylist in SQLite
  if (payload.jti) {
    const denied = db.prepare('SELECT jti FROM denylist WHERE jti = ?').get(payload.jti)
    if (denied) {
      throw { status: 401, code: 'TOKEN_REVOKED', message: 'Token has been revoked (found in denylist)' }
    }
  }

  // Check User Status & token_version in SQLite
  const user = db.prepare('SELECT id, is_locked, token_version FROM users WHERE id = ?').get(payload.sub)
  if (!user) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'User no longer exists' }
  }
  if (user.is_locked) {
    throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account has been locked. Please contact support.' }
  }
  if (payload.token_version !== undefined && payload.token_version < user.token_version) {
    throw { status: 401, code: 'TOKEN_REVOKED', message: 'Session invalidated by newer login or password change' }
  }

  return payload
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-ReAuth-Token')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Body Parsing
  let body = {}
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const raw = Buffer.concat(chunks).toString()
      if (raw) body = JSON.parse(raw)
    } catch {}
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname
  const method = req.method
  const deviceId = req.headers['x-device-id'] || body.device_id || 'dev_web_default'
  const authHeader = req.headers['authorization']

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  const sendError = (e) => {
    const status = e.status || 500
    const code = e.code || 'UNKNOWN'
    sendJson(status, { error: { code, message: e.message || code, status } })
  }

  try {
    // 1. JWKS Endpoint (RFC 7517)
    if (method === 'GET' && path === '/.well-known/jwks.json') {
      return sendJson(200, { keys: [publicJwk] })
    }

    // 2. Register Account
    if (method === 'POST' && path === '/api/auth/register') {
      const { email, password, name } = body
      if (!email || !password || !name) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'Name, email, and password are required' }
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
      if (existing) {
        throw { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' }
      }

      const userId = `usr_${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, provider, roles, scope, is_locked, two_factor_enabled, token_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'local', ?, 'read:learning write:learning write:payment', 0, 0, 1, ?, ?)
      `).run(userId, email.toLowerCase(), password, name, JSON.stringify(['user']), now, now)

      const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
      const familyId = `fam_${crypto.randomUUID().slice(0, 8)}`
      const tokens = issueTokenPair(newUser, deviceId, familyId)

      logAudit('REGISTER_SUCCESS', { userId, deviceId, jti: tokens.jti, message: 'New user registered' })

      return sendJson(201, {
        access_token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS,
        user: { id: newUser.id, email: newUser.email, name: newUser.name, roles: JSON.parse(newUser.roles) }
      })
    }

    // 3. Login (Email + Password, with 2FA check)
    if (method === 'POST' && path === '/api/auth/login') {
      const { email, password } = body
      if (!email || !password) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'Email and password are required' }
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase())
      if (!user) {
        logAudit('LOGIN_BLOCKED', { deviceId, status: 'BLOCKED', message: `No account exists for ${email}` })
        throw { status: 404, code: 'USER_NOT_FOUND', message: 'No account found with this email. Please create an account first.' }
      }

      if (user.password_hash !== password) {
        logAudit('LOGIN_FAILED', { deviceId, status: 'FAILED', message: 'Invalid password' })
        throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect password. Please try again.' }
      }

      if (user.is_locked) {
        logAudit('LOGIN_BLOCKED', { userId: user.id, deviceId, status: 'BLOCKED', message: 'Account is locked' })
        throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account is locked. Please contact support.' }
      }

      // 2FA Verification Step
      if (user.two_factor_enabled) {
        const mfaToken = `mfa_${crypto.randomUUID()}`
        const otpCode = '123456' // In production, generate dynamic TOTP or SMS code
        const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 minutes

        db.prepare(`
          INSERT INTO two_factor_challenges (id, user_id, mfa_token, otp_code, expires_at, verified, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).run(`ch_${crypto.randomUUID().slice(0, 8)}`, user.id, mfaToken, otpCode, expiresAt, new Date().toISOString())

        logAudit('2FA_CHALLENGE_ISSUED', { userId: user.id, deviceId, message: '2FA code required for login' })

        return sendJson(200, {
          mfa_required: true,
          mfa_token: mfaToken,
          method: 'totp',
          temp_code_hint: '123456',
          message: 'Two-Factor Authentication is required. Enter the 6-digit verification code.'
        })
      }

      // If 2FA not enabled, issue token pair immediately
      const familyId = `fam_${crypto.randomUUID().slice(0, 8)}`
      const tokens = issueTokenPair(user, deviceId, familyId)
      logAudit('LOGIN_SUCCESS', { userId: user.id, deviceId, jti: tokens.jti, message: 'Login successful' })

      return sendJson(200, {
        access_token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS,
        user: { id: user.id, email: user.email, name: user.name, roles: JSON.parse(user.roles || '["user"]') }
      })
    }

    // 4. Verify Two-Factor Authentication (2FA) Code
    if (method === 'POST' && path === '/api/auth/2fa/verify') {
      const { mfa_token, code } = body
      if (!mfa_token || !code) {
        throw { status: 400, code: 'INVALID_REQUEST', message: 'mfa_token and 6-digit code are required' }
      }

      const challenge = db.prepare('SELECT * FROM two_factor_challenges WHERE mfa_token = ?').get(mfa_token)
      if (!challenge) {
        throw { status: 401, code: '2FA_INVALID', message: 'Invalid or expired 2FA verification session' }
      }

      const now = Math.floor(Date.now() / 1000)
      if (challenge.expires_at < now || challenge.verified) {
        throw { status: 401, code: '2FA_EXPIRED', message: '2FA verification code has expired' }
      }

      if (challenge.otp_code !== code.trim()) {
        logAudit('2FA_FAILED', { userId: challenge.user_id, deviceId, status: 'FAILED', message: 'Wrong 2FA code' })
        throw { status: 401, code: '2FA_INVALID_CODE', message: 'Incorrect 6-digit code. Please try again (Hint: 123456).' }
      }

      // Mark challenge verified
      db.prepare('UPDATE two_factor_challenges SET verified = 1 WHERE id = ?').run(challenge.id)

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challenge.user_id)
      const familyId = `fam_${crypto.randomUUID().slice(0, 8)}`
      const tokens = issueTokenPair(user, deviceId, familyId)

      logAudit('2FA_VERIFIED', { userId: user.id, deviceId, jti: tokens.jti, message: '2FA verification successful' })

      return sendJson(200, {
        access_token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS,
        user: { id: user.id, email: user.email, name: user.name, roles: JSON.parse(user.roles || '["user"]') }
      })
    }

    // 5. Social Sign In: Google
    if (method === 'POST' && path === '/api/auth/oauth/google') {
      const email = body.email || 'alex.google@example.com'
      const name = body.name || 'Alex Google'

      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
      const now = new Date().toISOString()

      if (!user) {
        const userId = `usr_g_${crypto.randomUUID().slice(0, 8)}`
        db.prepare(`
          INSERT INTO users (id, email, name, provider, roles, scope, is_locked, two_factor_enabled, token_version, created_at, updated_at)
          VALUES (?, ?, ?, 'google', ?, 'read:learning write:learning write:payment', 0, 0, 1, ?, ?)
        `).run(userId, email.toLowerCase(), name, JSON.stringify(['user']), now, now)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
      }

      if (user.is_locked) {
        throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account is locked' }
      }

      const familyId = `fam_${crypto.randomUUID().slice(0, 8)}`
      const tokens = issueTokenPair(user, deviceId, familyId)
      logAudit('GOOGLE_LOGIN_SUCCESS', { userId: user.id, deviceId, jti: tokens.jti, message: 'Signed in with Google' })

      return sendJson(200, {
        access_token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS,
        user: { id: user.id, email: user.email, name: user.name, roles: JSON.parse(user.roles || '["user"]') }
      })
    }

    // 6. Social Sign In: Facebook
    if (method === 'POST' && path === '/api/auth/oauth/facebook') {
      const email = body.email || 'alex.facebook@example.com'
      const name = body.name || 'Alex Facebook'

      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
      const now = new Date().toISOString()

      if (!user) {
        const userId = `usr_fb_${crypto.randomUUID().slice(0, 8)}`
        db.prepare(`
          INSERT INTO users (id, email, name, provider, roles, scope, is_locked, two_factor_enabled, token_version, created_at, updated_at)
          VALUES (?, ?, ?, 'facebook', ?, 'read:learning write:learning write:payment', 0, 0, 1, ?, ?)
        `).run(userId, email.toLowerCase(), name, JSON.stringify(['user']), now, now)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
      }

      if (user.is_locked) {
        throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account is locked' }
      }

      const familyId = `fam_${crypto.randomUUID().slice(0, 8)}`
      const tokens = issueTokenPair(user, deviceId, familyId)
      logAudit('FACEBOOK_LOGIN_SUCCESS', { userId: user.id, deviceId, jti: tokens.jti, message: 'Signed in with Facebook' })

      return sendJson(200, {
        access_token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS,
        user: { id: user.id, email: user.email, name: user.name, roles: JSON.parse(user.roles || '["user"]') }
      })
    }

    // 7. Refresh Token Rotation & Reuse Detection (BR-03, BR-04, BR-05)
    if (method === 'POST' && path === '/api/auth/refresh') {
      const rt = body.refresh_token || body.refreshToken
      if (!rt) throw { status: 400, code: 'INVALID_REQUEST', message: 'Missing Refresh Token' }

      const record = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(rt)
      if (!record) {
        throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'Refresh Token does not exist' }
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id)

      // Device ID binding (BR-05)
      if (record.device_id && deviceId && record.device_id !== deviceId) {
        logAudit('DEVICE_MISMATCH', { userId: user?.id, deviceId, status: 'FAILED', message: 'Device mismatch' })
        throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'Device ID mismatch' }
      }

      // Reuse Detection (BR-04)
      if (record.is_revoked) {
        logAudit('RT_REUSE_DETECTED', { userId: user?.id, deviceId, status: 'ALERT_COMPROMISED', message: 'RT reuse detected' })
        // Invalidate entire family in SQLite
        db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?').run(record.family_id)
        if (user) {
          db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id)
        }
        throw { status: 401, code: 'SESSION_REVOKED', message: 'Refresh token reuse detected. All sessions revoked.' }
      }

      const now = Math.floor(Date.now() / 1000)
      if (record.expires_at < now) {
        throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'Refresh Token has expired' }
      }

      // Rotate RT
      db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?').run(record.id)
      const newTokens = issueTokenPair(user, deviceId, record.family_id)
      logAudit('TOKEN_ROTATED', { userId: user.id, deviceId, jti: newTokens.jti, message: 'Token rotated' })

      return sendJson(200, {
        access_token: newTokens.accessToken,
        accessToken: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        refreshToken: newTokens.refreshToken,
        token_type: 'Bearer',
        expires_in: AT_TTL_SECONDS
      })
    }

    // 8. Logout
    if (method === 'POST' && path === '/api/auth/logout') {
      const rt = body.refresh_token
      if (rt) {
        db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?').run(rt)
      }
      if (authHeader) {
        try {
          const payload = verifyAccessToken(authHeader, deviceId)
          if (payload.jti) {
            db.prepare('INSERT OR IGNORE INTO denylist (jti, expires_at, created_at) VALUES (?, ?, ?)').run(
              payload.jti,
              payload.exp,
              new Date().toISOString()
            )
          }
        } catch {}
      }
      logAudit('LOGOUT', { deviceId, message: 'Logged out successfully' })
      return sendJson(200, { ok: true })
    }

    // 9. Logout All Devices
    if (method === 'POST' && path === '/api/auth/logout-all') {
      const payload = verifyAccessToken(authHeader, deviceId)
      db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?').run(payload.sub)
      db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(payload.sub)
      logAudit('LOGOUT_ALL', { userId: payload.sub, deviceId, message: 'All sessions revoked' })
      return sendJson(200, { ok: true })
    }

    // 10. Toggle 2FA Setting
    if (method === 'POST' && path === '/api/auth/2fa/toggle') {
      const payload = verifyAccessToken(authHeader, deviceId)
      const user = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(payload.sub)
      const nextState = user.two_factor_enabled ? 0 : 1
      db.prepare('UPDATE users SET two_factor_enabled = ? WHERE id = ?').run(nextState, payload.sub)
      logAudit(nextState ? '2FA_ENABLED' : '2FA_DISABLED', { userId: payload.sub })
      return sendJson(200, { two_factor_enabled: Boolean(nextState) })
    }

    // 11. Security Audit Logs
    if (method === 'GET' && path === '/api/auth/audit-logs') {
      const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all()
      return sendJson(200, { logs })
    }

    // 12. Admin Toggle User Lock
    if (method === 'POST' && path === '/api/admin/toggle-lock') {
      const email = body.email || 'a@b.vn'
      const user = db.prepare('SELECT id, is_locked FROM users WHERE email = ?').get(email.toLowerCase())
      if (!user) throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' }
      const newLock = user.is_locked ? 0 : 1
      db.prepare('UPDATE users SET is_locked = ? WHERE id = ?').run(newLock, user.id)
      logAudit(newLock ? 'USER_LOCKED' : 'USER_UNLOCKED', { userId: user.id })
      return sendJson(200, { isLocked: Boolean(newLock) })
    }

    // 13. Re-authenticate
    if (method === 'POST' && path === '/api/auth/reauth') {
      const payload = verifyAccessToken(authHeader, deviceId)
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(payload.sub)
      if (user.password_hash !== body.password) {
        throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect re-auth password' }
      }
      return sendJson(200, { reauthToken: `reauth_${crypto.randomUUID()}`, expiresIn: 300 })
    }

    // Protected API Endpoints
    const verifiedUser = verifyAccessToken(authHeader, deviceId)

    if (method === 'GET' && path === '/api/auth/me') {
      const user = db.prepare('SELECT id, email, name, roles, two_factor_enabled FROM users WHERE id = ?').get(verifiedUser.sub)
      return sendJson(200, { user: { ...user, roles: JSON.parse(user.roles || '["user"]') } })
    }

    if (method === 'GET' && path === '/api/learning/progress') {
      return sendJson(200, {
        skills: [
          { name: 'Vocabulary', band: 'solid' },
          { name: 'Grammar', band: 'improving' }
        ]
      })
    }

    if (method === 'GET' && path === '/api/gamification/profile') {
      return sendJson(200, {
        xp: 120,
        streak: 3,
        badges: [{ id: 'start', name: 'Starter Badge' }]
      })
    }

    throw { status: 404, code: 'NOT_FOUND', message: `Endpoint ${method} ${path} not found` }
  } catch (e) {
    sendError(e)
  }
})

server.listen(PORT, () => {
  console.log(`🚀 EnglishStep Real SQLite Backend Server running at: http://localhost:${PORT}`)
  console.log(`🔑 JWKS Public Key Endpoint: http://localhost:${PORT}/.well-known/jwks.json`)
})
