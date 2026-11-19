// ============================================================================
// Automated Test Suite for JWT Specification (RFC 7519 / Jwt.md)
// Tests:
// - TC-01 to TC-10 (All 10 Core Test Cases from Section 10 of Jwt.md)
// - Business Rules BR-01 to BR-10
// - Account Registration & Social Sign-In (Google / Facebook)
// - Two-Factor Authentication (2FA) with OTP Verification
// ============================================================================
import assert from 'node:assert/strict'
import { JwtAuthEngine } from '../src/api/jwt-auth-core.js'
import { decodeJwt } from '../src/api/jwt-crypto.js'

console.log('=== STARTING JWT SPECIFICATION & AUTH TEST SUITE ===\n')

const auth = new JwtAuthEngine({
  AT_TTL_SECONDS: 900,
  RT_TTL_SECONDS: 604800
})

const DEVICE_A = 'dev_laptop_chrome_99'
const DEVICE_B = 'dev_mobile_iphone_15'

// 1. Account Registration
console.log('▶ [FEATURE] Testing New Account Registration...')
const regRes = await auth.register({
  name: 'Sarah Connor',
  email: 'sarah@example.com',
  password: 'Password123!',
  deviceId: DEVICE_A
})
assert.ok(regRes.access_token, 'Registration should issue access_token')
assert.ok(regRes.refresh_token, 'Registration should issue refresh_token')
assert.equal(regRes.user.name, 'Sarah Connor')
console.log('   ✔ Registration: Passed!\n')

// 2. Social Sign-In: Google & Facebook
console.log('▶ [FEATURE] Testing Google & Facebook Social Sign-In...')
const googleRes = await auth.loginSocial({
  provider: 'google',
  email: 'alex.google@example.com',
  name: 'Alex Google',
  deviceId: DEVICE_A
})
assert.ok(googleRes.access_token)
assert.equal(googleRes.user.email, 'alex.google@example.com')

const fbRes = await auth.loginSocial({
  provider: 'facebook',
  email: 'alex.facebook@example.com',
  name: 'Alex Facebook',
  deviceId: DEVICE_A
})
assert.ok(fbRes.access_token)
assert.equal(fbRes.user.email, 'alex.facebook@example.com')
console.log('   ✔ Social Sign-In (Google & Facebook): Passed!\n')

// 3. Two-Factor Authentication (2FA)
console.log('▶ [FEATURE] Testing Two-Factor Authentication (2FA) Workflow...')
// Admin account has 2FA enabled by default
const adminLogin = await auth.login({
  email: 'admin@englishstep.vn',
  password: 'adminPassword123!',
  deviceId: DEVICE_A
})
assert.equal(adminLogin.mfa_required, true, 'User with 2FA enabled must return mfa_required: true')
assert.ok(adminLogin.mfa_token, 'Must provide an mfa_token challenge')
assert.equal(adminLogin.temp_code_hint, '123456')

// Incorrect OTP code
await assert.rejects(
  () => auth.verifyTwoFactor({ mfaToken: adminLogin.mfa_token, code: '000000', deviceId: DEVICE_A }),
  (err) => err.code === '2FA_INVALID_CODE' && err.status === 401,
  'Must reject incorrect 2FA code'
)

// Correct OTP code
const mfaVerified = await auth.verifyTwoFactor({
  mfaToken: adminLogin.mfa_token,
  code: '123456',
  deviceId: DEVICE_A
})
assert.ok(mfaVerified.access_token, 'Must issue full access_token upon 2FA success')
assert.ok(mfaVerified.refresh_token, 'Must issue full refresh_token upon 2FA success')
console.log('   ✔ Two-Factor Authentication (2FA): Passed!\n')

// Test Unregistered User Blocking
console.log('▶ [SECURITY] Testing Unregistered User Blocking (No Account Exists)...')
await assert.rejects(
  () => auth.login({ email: 'unregistered.user@test.com', password: 'password123', deviceId: DEVICE_A }),
  (err) => err.code === 'USER_NOT_FOUND' && err.status === 404,
  'Unregistered user must be blocked with 404 USER_NOT_FOUND'
)
console.log('   ✔ Unregistered User Blocking: Passed (Users MUST create account first)!\n')

// Register account for TC-01
await auth.register({
  name: 'Alex Johnson',
  email: 'a@b.vn',
  password: 'demo1234',
  deviceId: DEVICE_A
})

// TC-01: Valid credentials sign-in -> receive valid AT + RT, TTL <= 15m (BR-01, BR-08)
console.log('▶ [TC-01] Testing Sign-In & Token Issuance (BR-01, BR-08)...')
const loginRes = await auth.login({
  email: 'a@b.vn',
  password: 'demo1234',
  deviceId: DEVICE_A
})

assert.ok(loginRes.access_token, 'Must contain access_token')
assert.ok(loginRes.refresh_token, 'Must contain refresh_token')
assert.equal(loginRes.token_type, 'Bearer')
assert.equal(loginRes.expires_in, 900, 'TTL must be 900s (15 minutes per BR-01)')

// Decode and verify JWT structure (RFC 7519)
const decoded = decodeJwt(loginRes.access_token)
assert.ok(decoded.header, 'Header must exist')
assert.equal(decoded.header.alg, 'HS256', 'Algorithm must be valid (BR-07)')
assert.equal(decoded.header.typ, 'JWT')
assert.ok(decoded.header.kid, 'Must have kid for key rotation')

// Verify claims
const p = decoded.payload
assert.ok(p.sub.startsWith('usr_'), 'sub must be user ID')
assert.equal(p.iss, 'https://auth.englishstep.vn', 'iss must match issuer')
assert.equal(p.aud, 'englishstep-api', 'aud must match audience')
assert.ok(p.jti, 'Must have unique jti per token')
assert.equal(p.device_id, DEVICE_A, 'device_id must be bound to token')
assert.ok(p.exp - p.iat <= 900, 'TTL must be <= 15 minutes (BR-01)')
assert.equal(p.password, undefined, 'BR-08: Payload must never contain passwords!')
console.log('   ✔ TC-01 & BR-01, BR-08: Passed!\n')

// TC-02: Call protected API with valid AT -> 200 OK
console.log('▶ [TC-02] Testing Protected API with Valid Access Token...')
const verifiedPayload = await auth.verifyRequest(`Bearer ${loginRes.access_token}`, DEVICE_A)
assert.ok(verifiedPayload.sub.startsWith('usr_'))
assert.equal(verifiedPayload.email, 'a@b.vn')
console.log('   ✔ TC-02: Passed (Signature intact, claims verified)!\n')

// TC-04: Call API without Authorization header -> 401 UNAUTHORIZED
console.log('▶ [TC-04] Testing Request without Authorization Header...')
await assert.rejects(
  () => auth.verifyRequest(''),
  (err) => err.code === 'UNAUTHORIZED' && err.status === 401,
  'Must reject with 401 UNAUTHORIZED when header is missing'
)
console.log('   ✔ TC-04: Passed!\n')

// TC-03: Call API with expired AT -> 401 TOKEN_EXPIRED
console.log('▶ [TC-03] Testing Request with Expired Access Token...')
auth.forceExpireToken(loginRes.access_token)
await assert.rejects(
  () => auth.verifyRequest(`Bearer ${loginRes.access_token}`, DEVICE_A),
  (err) => err.code === 'TOKEN_EXPIRED' && err.status === 401,
  'Must reject with 401 TOKEN_EXPIRED when token expires'
)
console.log('   ✔ TC-03: Passed!\n')

// TC-05: Refresh with valid RT -> receive new AT/RT pair, old RT invalidated (BR-03)
console.log('▶ [TC-05] Testing Refresh Token Rotation (BR-03)...')
const rotated = await auth.refresh({
  refreshToken: loginRes.refresh_token,
  deviceId: DEVICE_A
})
assert.ok(rotated.access_token)
assert.ok(rotated.refresh_token)
assert.notEqual(rotated.refresh_token, loginRes.refresh_token, 'New RT must differ from old RT')

const oldRtRecord = auth.refreshTokens.get(loginRes.refresh_token)
assert.equal(oldRtRecord.isRevoked, true, 'Old RT must be revoked immediately (BR-03)')
console.log('   ✔ TC-05 & BR-03: Passed!\n')

// TC-06: Reuse old RT -> 401 + revoke entire family (BR-04 Reuse Detection)
console.log('▶ [TC-06] Testing Rotated RT Reuse Attack (BR-04 Reuse Detection)...')
await assert.rejects(
  () => auth.refresh({ refreshToken: loginRes.refresh_token, deviceId: DEVICE_A }),
  (err) => err.code === 'SESSION_REVOKED' && err.status === 401,
  'Must revoke entire session with SESSION_REVOKED upon token reuse'
)

const newRtRecord = auth.refreshTokens.get(rotated.refresh_token)
assert.equal(newRtRecord.isRevoked, true, 'Entire token family must be revoked following reuse attack')
console.log('   ✔ TC-06 & BR-04: Passed (Family Revocation triggered)!\n')

// Fresh login for remaining tests
const freshSession = await auth.login({
  email: 'a@b.vn',
  password: 'demo1234',
  deviceId: DEVICE_A
})

// TC-07: RT used on another device -> 401 REFRESH_TOKEN_INVALID (BR-05 Device Binding)
console.log('▶ [TC-07] Testing Device Binding device_id (BR-05)...')
await assert.rejects(
  () => auth.refresh({ refreshToken: freshSession.refresh_token, deviceId: DEVICE_B }),
  (err) => err.code === 'REFRESH_TOKEN_INVALID' && err.status === 401,
  'Must reject with REFRESH_TOKEN_INVALID when device does not match'
)
console.log('   ✔ TC-07 & BR-05: Passed!\n')

// TC-08: User locked mid-session -> next request rejected with 403 ACCOUNT_LOCKED (BR-06)
console.log('▶ [TC-08] Testing Account Locked Mid-Session (BR-06)...')
auth.toggleLockUser('a@b.vn')
await assert.rejects(
  () => auth.verifyRequest(`Bearer ${freshSession.access_token}`, DEVICE_A),
  (err) => err.code === 'ACCOUNT_LOCKED' && err.status === 403,
  'Must return 403 ACCOUNT_LOCKED when user is locked'
)
auth.toggleLockUser('a@b.vn')
console.log('   ✔ TC-08 & BR-06: Passed!\n')

// TC-09: Tampered token payload -> 401 TOKEN_INVALID (BR-07)
console.log('▶ [TC-09] Testing Tampered Payload Detection...')
const tamperedToken = auth.tamperToken(freshSession.access_token)
await assert.rejects(
  () => auth.verifyRequest(`Bearer ${tamperedToken}`, DEVICE_A),
  (err) => err.code === 'TOKEN_INVALID' && err.status === 401,
  'Must reject with 401 TOKEN_INVALID when signature fails'
)
console.log('   ✔ TC-09 & BR-07: Passed!\n')

// TC-10: Logout -> RT deleted, AT placed into Denylist (401 TOKEN_REVOKED)
console.log('▶ [TC-10] Testing Sign Out & Denylist Revocation (TC-10, BR-06, BR-10)...')
await auth.logout({
  accessToken: freshSession.access_token,
  refreshToken: freshSession.refresh_token,
  deviceId: DEVICE_A
})

const decodedFresh = decodeJwt(freshSession.access_token)
assert.ok(auth.denylist.has(decodedFresh.payload.jti), 'JTI must be present in Denylist')

await assert.rejects(
  () => auth.verifyRequest(`Bearer ${freshSession.access_token}`, DEVICE_A),
  (err) => err.code === 'TOKEN_REVOKED' && err.status === 401,
  'Token in Denylist must reject with 401 TOKEN_REVOKED'
)
console.log('   ✔ TC-10 & Denylist: Passed!\n')

// BR-10: Audit Trail Verification
console.log('▶ [BR-10] Testing Security Audit Trail...')
assert.ok(auth.auditLogs.length >= 10, 'Must have recorded audit log entries')
const events = auth.auditLogs.map((l) => l.event)
assert.ok(events.includes('REGISTER_SUCCESS'))
assert.ok(events.includes('GOOGLE_LOGIN_SUCCESS'))
assert.ok(events.includes('2FA_CHALLENGE_ISSUED'))
assert.ok(events.includes('2FA_VERIFIED'))
assert.ok(events.includes('TOKEN_ROTATED'))
assert.ok(events.includes('RT_REUSE_DETECTED'))
assert.ok(events.includes('DEVICE_MISMATCH'))
assert.ok(events.includes('LOGOUT'))
console.log('   ✔ BR-10: Passed (Full security audit trail verified)!\n')

console.log('====================================================')
console.log('🏆 ALL TESTS, 2FA, SOCIAL LOGINS, AND 10/10 SCENARIOS PASSED!')
console.log('====================================================')
