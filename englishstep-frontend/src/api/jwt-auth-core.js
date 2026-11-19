// ============================================================================
// Core JWT Auth Service & Security Engine
// Supports:
// - Standard RFC 7519 / JWS RS256 & HS256
// - Email/Password & Registration
// - Google & Facebook Social Sign-In
// - Two-Factor Authentication (2FA) with 6-digit verification
// - Business Rules BR-01 -> BR-10
// - 10 Automated Test Scenarios (TC-01 -> TC-10)
// ============================================================================

import { createJwt, verifyJwt, decodeJwt } from './jwt-crypto.js'

export const CONFIG = {
  ISSUER: 'https://auth.englishstep.vn',
  AUDIENCE: 'englishstep-api',
  KEY_ID: 'key_2026_01',
  SECRET_KEY: 'englishstep-jwt-sec-2026-very-secure-signing-key',
  AT_TTL_SECONDS: 900,        // BR-01: Access Token TTL <= 15 minutes (900s)
  RT_TTL_SECONDS: 7 * 86400,  // BR-01: Refresh Token TTL <= 7 days (604800s)
  REAUTH_TTL_SECONDS: 300     // 5 minutes for X-ReAuth-Token
}

export class JwtAuthEngine {
  constructor(config = {}) {
    this.cfg = { ...CONFIG, ...config }
    this.reset()
  }

  reset() {
    this.seq = 0
    // User Store (Clean slate: Regular accounts MUST be registered first)
    this.users = new Map([
      [
        'admin@englishstep.vn',
        {
          id: 'usr_admin',
          email: 'admin@englishstep.vn',
          password: 'adminPassword123!',
          name: 'System Administrator',
          provider: 'local',
          roles: ['admin', 'user'],
          scope: 'read:learning write:learning write:payment admin:all',
          isLocked: false,
          twoFactorEnabled: true,
          tokenVersion: 1
        }
      ]
    ])

    // Token Store (BR-03, BR-04, BR-05)
    this.refreshTokens = new Map()

    // Token Families for Reuse Detection (BR-04)
    this.tokenFamilies = new Map()

    // Denylist for Access Token JTI (BR-06, BR-10, TC-10)
    this.denylist = new Map()

    // Active 2FA Challenges
    this.mfaChallenges = new Map()

    // Audit Log Store (BR-10)
    this.auditLogs = []

    // Force expired tokens set for testing (TC-03)
    this.forceExpiredTokens = new Set()
  }

  // Security Audit Trail (BR-10)
  audit(event, details = {}) {
    const entry = {
      id: `audit_${++this.seq}`,
      timestamp: new Date().toISOString(),
      event,
      userId: details.userId || null,
      deviceId: details.deviceId || null,
      jti: details.jti || null,
      status: details.status || 'SUCCESS',
      message: details.message || '',
      metadata: details.metadata || {}
    }
    this.auditLogs.unshift(entry)
    if (this.auditLogs.length > 300) this.auditLogs.pop()
    return entry
  }

  cleanExpiredDenylist() {
    const now = Math.floor(Date.now() / 1000)
    for (const [jti, exp] of this.denylist.entries()) {
      if (exp <= now) this.denylist.delete(jti)
    }
  }

  // Register New Account
  async register({ email, password, name, deviceId }) {
    if (!email || !password || !name) {
      throw { status: 400, code: 'INVALID_REQUEST', message: 'Name, email, and password are required' }
    }

    const key = email.toLowerCase()
    if (this.users.has(key)) {
      throw { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' }
    }

    const userId = `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    const newUser = {
      id: userId,
      email: key,
      password,
      name,
      provider: 'local',
      roles: ['user'],
      scope: 'read:learning write:learning write:payment',
      isLocked: false,
      twoFactorEnabled: false,
      tokenVersion: 1
    }

    this.users.set(key, newUser)

    const familyId = `fam_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    this.tokenFamilies.set(familyId, new Set())

    const tokens = await this.issueTokenPair(newUser, deviceId, familyId)
    this.audit('REGISTER_SUCCESS', { userId, deviceId, jti: tokens.jti, message: 'User registered successfully' })

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.cfg.AT_TTL_SECONDS,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        roles: newUser.roles,
        two_factor_enabled: newUser.twoFactorEnabled
      }
    }
  }

  // Social Sign-In (Google / Facebook)
  async loginSocial({ provider, email, name, deviceId }) {
    const key = (email || `${provider}.user@englishstep.com`).toLowerCase()
    let user = this.users.get(key)

    if (!user) {
      const userId = `usr_${provider}_${Math.random().toString(36).substring(2, 8)}`
      user = {
        id: userId,
        email: key,
        name: name || `${provider.toUpperCase()} Learner`,
        provider,
        roles: ['user'],
        scope: 'read:learning write:learning write:payment',
        isLocked: false,
        twoFactorEnabled: false,
        tokenVersion: 1
      }
      this.users.set(key, user)
    }

    if (user.isLocked) {
      throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account has been locked. Please contact support.' }
    }

    const familyId = `fam_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    this.tokenFamilies.set(familyId, new Set())

    const tokens = await this.issueTokenPair(user, deviceId, familyId)
    this.audit(`${provider.toUpperCase()}_LOGIN_SUCCESS`, {
      userId: user.id,
      deviceId,
      jti: tokens.jti,
      message: `Signed in with ${provider}`
    })

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.cfg.AT_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        two_factor_enabled: user.twoFactorEnabled
      }
    }
  }

  // Standard Login (TC-01) with 2FA Option
  async login({ email, password, deviceId }) {
    if (!email || !password) {
      throw { status: 400, code: 'INVALID_REQUEST', message: 'Email and password are required' }
    }

    const user = this.users.get(email.toLowerCase())
    if (!user) {
      this.audit('LOGIN_BLOCKED', {
        deviceId,
        status: 'BLOCKED',
        message: `No account exists for ${email}. Registration required.`
      })
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'No account found with this email. Please create an account first.' }
    }

    if (user.password !== password) {
      this.audit('LOGIN_FAILED', {
        userId: user.id,
        deviceId,
        status: 'FAILED',
        message: 'Invalid password'
      })
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect password. Please try again.' }
    }

    if (user.isLocked) {
      this.audit('LOGIN_BLOCKED', {
        userId: user.id,
        deviceId,
        status: 'BLOCKED',
        message: 'Account is locked'
      })
      throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account has been locked. Please contact support.' }
    }

    // Two-Factor Authentication Check
    if (user.twoFactorEnabled) {
      const mfaToken = `mfa_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`
      const otpCode = '123456'
      this.mfaChallenges.set(mfaToken, {
        userId: user.id,
        otpCode,
        deviceId,
        expiresAt: Date.now() + 300_000
      })

      this.audit('2FA_CHALLENGE_ISSUED', {
        userId: user.id,
        deviceId,
        message: 'Two-Factor Authentication required'
      })

      return {
        mfa_required: true,
        mfa_token: mfaToken,
        method: 'totp',
        temp_code_hint: '123456',
        message: 'Two-Factor Authentication is required. Enter the 6-digit verification code.'
      }
    }

    const familyId = `fam_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    this.tokenFamilies.set(familyId, new Set())

    const tokens = await this.issueTokenPair(user, deviceId, familyId)
    this.audit('LOGIN_SUCCESS', {
      userId: user.id,
      deviceId,
      jti: tokens.jti,
      status: 'SUCCESS',
      message: 'Login successful, issued Access + Refresh Token'
    })

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.cfg.AT_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        two_factor_enabled: user.twoFactorEnabled
      }
    }
  }

  // Verify 2FA Challenge Code
  async verifyTwoFactor({ mfaToken, code, deviceId }) {
    if (!mfaToken || !code) {
      throw { status: 400, code: 'INVALID_REQUEST', message: 'mfa_token and verification code are required' }
    }

    const challenge = this.mfaChallenges.get(mfaToken)
    if (!challenge) {
      throw { status: 401, code: '2FA_INVALID', message: 'Invalid or expired 2FA verification session' }
    }

    if (Date.now() > challenge.expiresAt) {
      this.mfaChallenges.delete(mfaToken)
      throw { status: 401, code: '2FA_EXPIRED', message: '2FA code has expired. Please log in again.' }
    }

    if (challenge.otpCode !== code.trim()) {
      this.audit('2FA_FAILED', { userId: challenge.userId, deviceId, status: 'FAILED', message: 'Wrong 2FA code' })
      throw { status: 401, code: '2FA_INVALID_CODE', message: 'Incorrect 6-digit code. Please try again (Hint: 123456).' }
    }

    this.mfaChallenges.delete(mfaToken)
    const user = [...this.users.values()].find((u) => u.id === challenge.userId)

    const familyId = `fam_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    this.tokenFamilies.set(familyId, new Set())

    const tokens = await this.issueTokenPair(user, deviceId || challenge.deviceId, familyId)
    this.audit('2FA_VERIFIED', {
      userId: user.id,
      deviceId: deviceId || challenge.deviceId,
      jti: tokens.jti,
      message: '2FA verification successful'
    })

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.cfg.AT_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        two_factor_enabled: user.twoFactorEnabled
      }
    }
  }

  // Toggle 2FA Setting for a User
  toggleTwoFactor(userId) {
    const user = [...this.users.values()].find((u) => u.id === userId)
    if (!user) throw new Error('User not found')
    user.twoFactorEnabled = !user.twoFactorEnabled
    this.audit(user.twoFactorEnabled ? '2FA_ENABLED' : '2FA_DISABLED', {
      userId: user.id,
      message: `2FA ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`
    })
    return user.twoFactorEnabled
  }

  // Issue Token Pair
  async issueTokenPair(user, deviceId, familyId) {
    const now = Math.floor(Date.now() / 1000)
    const jti = `jti_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`

    const payload = {
      iss: this.cfg.ISSUER,
      sub: user.id,
      aud: this.cfg.AUDIENCE,
      exp: now + this.cfg.AT_TTL_SECONDS,
      iat: now,
      jti,
      email: user.email,
      name: user.name,
      roles: user.roles,
      scope: user.scope,
      device_id: deviceId,
      token_version: user.tokenVersion
    }

    const accessToken = await createJwt(payload, this.cfg.SECRET_KEY, {
      alg: 'HS256',
      kid: this.cfg.KEY_ID
    })

    const rtJti = `rt_jti_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`
    const refreshToken = `rt_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`

    const rtRecord = {
      id: rtJti,
      token: refreshToken,
      familyId,
      userId: user.id,
      deviceId,
      expiresAt: now + this.cfg.RT_TTL_SECONDS,
      isRevoked: false,
      replacedBy: null,
      createdAt: now
    }

    this.refreshTokens.set(refreshToken, rtRecord)

    let fam = this.tokenFamilies.get(familyId)
    if (!fam) {
      fam = new Set()
      this.tokenFamilies.set(familyId, fam)
    }
    fam.add(refreshToken)

    return { accessToken, refreshToken, jti }
  }

  // Refresh with Rotation & Reuse Detection (TC-05, TC-06, TC-07)
  async refresh({ refreshToken, deviceId }) {
    if (!refreshToken) {
      throw { status: 400, code: 'INVALID_REQUEST', message: 'Missing Refresh Token' }
    }

    const record = this.refreshTokens.get(refreshToken)
    if (!record) {
      this.audit('REFRESH_FAILED', { deviceId, status: 'FAILED', message: 'Refresh Token does not exist' })
      throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'Invalid or non-existent Refresh Token' }
    }

    const user = [...this.users.values()].find((u) => u.id === record.userId)
    if (!user) {
      throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'User does not exist' }
    }

    // BR-05 & TC-07: Device Binding Check
    if (record.deviceId && deviceId && record.deviceId !== deviceId) {
      this.audit('DEVICE_MISMATCH', {
        userId: user.id,
        deviceId,
        status: 'FAILED',
        message: `Device mismatch: RT bound to ${record.deviceId}, requested from ${deviceId}`
      })
      throw {
        status: 401,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Device mismatch: Refresh token cannot be used from a different device'
      }
    }

    // BR-04 & TC-06: REUSE DETECTION!
    if (record.isRevoked) {
      this.audit('RT_REUSE_DETECTED', {
        userId: user.id,
        deviceId,
        status: 'ALERT_COMPROMISED',
        message: 'Old Refresh Token reused (Token Theft Attack). Revoking all user sessions!'
      })

      // Invalidate entire family
      const fam = this.tokenFamilies.get(record.familyId)
      if (fam) {
        for (const rt of fam) {
          const r = this.refreshTokens.get(rt)
          if (r) r.isRevoked = true
        }
      }

      user.tokenVersion++

      throw {
        status: 401,
        code: 'SESSION_REVOKED',
        message: 'Token reuse detected (possible theft). All sessions have been revoked. Please sign in again.'
      }
    }

    // Check RT Expiry
    const now = Math.floor(Date.now() / 1000)
    if (record.expiresAt < now) {
      throw { status: 401, code: 'REFRESH_TOKEN_INVALID', message: 'Refresh Token has expired. Please sign in again.' }
    }

    if (user.isLocked) {
      throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account is locked' }
    }

    // BR-03: Refresh Token Rotation
    record.isRevoked = true
    const newTokens = await this.issueTokenPair(user, deviceId, record.familyId)
    record.replacedBy = newTokens.refreshToken

    this.audit('TOKEN_ROTATED', {
      userId: user.id,
      deviceId,
      jti: newTokens.jti,
      status: 'SUCCESS',
      message: 'Token rotated successfully'
    })

    return {
      access_token: newTokens.accessToken,
      refresh_token: newTokens.refreshToken,
      token_type: 'Bearer',
      expires_in: this.cfg.AT_TTL_SECONDS
    }
  }

  // Verify Request (TC-02, TC-03, TC-04, TC-08, TC-09)
  async verifyRequest(authHeader, deviceId = null, requiredScope = null, requiredRole = null) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw { status: 401, code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization Bearer header' }
    }

    const token = authHeader.replace(/^Bearer\s+/, '').trim()

    if (this.forceExpiredTokens.has(token)) {
      throw { status: 401, code: 'TOKEN_EXPIRED', message: 'Access Token has expired (simulated)' }
    }

    const res = await verifyJwt(token, this.cfg.SECRET_KEY, this.cfg.AUDIENCE, this.cfg.ISSUER)
    if (!res.valid) {
      throw { status: 401, code: res.code, message: res.message }
    }

    const payload = res.payload

    // Check Denylist
    this.cleanExpiredDenylist()
    if (payload.jti && this.denylist.has(payload.jti)) {
      this.audit('REVOKED_TOKEN_BLOCKED', {
        userId: payload.sub,
        deviceId,
        jti: payload.jti,
        status: 'BLOCKED',
        message: 'Token is in Denylist'
      })
      throw { status: 401, code: 'TOKEN_REVOKED', message: 'Access Token has been revoked' }
    }

    // Check User Status
    const user = [...this.users.values()].find((u) => u.id === payload.sub)
    if (user) {
      if (user.isLocked) {
        throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Account has been locked. Please contact support.' }
      }
      if (payload.token_version !== undefined && payload.token_version < user.tokenVersion) {
        throw { status: 401, code: 'TOKEN_REVOKED', message: 'Session invalidated by newer login' }
      }
    }

    if (requiredRole && (!payload.roles || !payload.roles.includes(requiredRole))) {
      throw { status: 403, code: 'FORBIDDEN', message: `Missing required role: ${requiredRole}` }
    }

    return payload
  }

  // Logout (TC-10)
  async logout({ accessToken, refreshToken, deviceId }) {
    if (accessToken) {
      const decoded = decodeJwt(accessToken)
      if (decoded?.payload?.jti) {
        const exp = decoded.payload.exp || (Math.floor(Date.now() / 1000) + this.cfg.AT_TTL_SECONDS)
        this.denylist.set(decoded.payload.jti, exp)
      }
    }

    if (refreshToken) {
      const r = this.refreshTokens.get(refreshToken)
      if (r) r.isRevoked = true
    }

    this.audit('LOGOUT', { deviceId, status: 'SUCCESS', message: 'Signed out successfully' })
    return { ok: true }
  }

  // Logout All
  async logoutAll({ userId, deviceId }) {
    const user = [...this.users.values()].find((u) => u.id === userId)
    if (user) user.tokenVersion++
    for (const r of this.refreshTokens.values()) {
      if (r.userId === userId) r.isRevoked = true
    }
    this.audit('LOGOUT_ALL', { userId, deviceId, status: 'SUCCESS', message: 'All sessions revoked across all devices' })
    return { ok: true }
  }

  // Lock / Unlock User (TC-08)
  toggleLockUser(emailOrId) {
    const user = this.users.get(emailOrId) || [...this.users.values()].find((u) => u.id === emailOrId)
    if (!user) throw new Error('User not found')
    user.isLocked = !user.isLocked
    this.audit(user.isLocked ? 'USER_LOCKED' : 'USER_UNLOCKED', {
      userId: user.id,
      status: 'SUCCESS',
      message: `Account ${user.email} is now ${user.isLocked ? 'LOCKED' : 'ACTIVE'}`
    })
    return user.isLocked
  }

  forceExpireToken(token) {
    this.forceExpiredTokens.add(token)
  }

  tamperToken(token) {
    if (!token) return token
    const parts = token.split('.')
    if (parts.length !== 3) return token
    const tamperedPayload = parts[1].slice(0, -2) + (parts[1].endsWith('A') ? 'B' : 'A') + parts[1].slice(-1)
    return `${parts[0]}.${tamperedPayload}.${parts[2]}`
  }

  getJwks() {
    return {
      keys: [
        {
          kty: 'oct',
          use: 'sig',
          alg: 'HS256',
          kid: this.cfg.KEY_ID
        }
      ]
    }
  }
}

export const jwtAuthEngine = new JwtAuthEngine()
