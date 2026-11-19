// Mock Backend integrating RFC 7519 JWT, Social Sign-In (Google/Facebook), and 2FA
import { ApiError } from './errors.js'
import { jwtAuthEngine } from './jwt-auth-core.js'

export const config = { latency: 50 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clamp = (n) => Math.min(5, Math.max(1, n))
const BASE_XP = 10
const EFFORT_XP = 2
const MIN_RESPONSE_MS = 500
const HOUR = 3600_000
const PUBLIC = [
  '/auth/login',
  '/auth/register',
  '/auth/oauth/google',
  '/auth/oauth/facebook',
  '/auth/2fa/verify',
  '/auth/refresh',
  '/.well-known/jwks.json'
]

const BANK = [
  { id: 'q1', skill: 'Vocabulary', difficulty: 1, prompt: 'Choose the word closest in meaning to "begin".', options: ['start', 'finish', 'avoid', 'hide'], answer: 0, hint: 'Think of a synonym for "commence".' },
  { id: 'q2', skill: 'Grammar', difficulty: 1, prompt: 'She ___ to school every day.', options: ['goes', 'go', 'going', 'gone'], answer: 0, hint: 'Third person singular, simple present tense.' },
  { id: 'q3', skill: 'Vocabulary', difficulty: 2, prompt: 'The meeting was ___ because of the storm.', options: ['postponed', 'prepared', 'produced', 'promoted'], answer: 0, hint: 'Rescheduled to a later time.' },
  { id: 'q4', skill: 'Grammar', difficulty: 2, prompt: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'stayed', 'will stay', 'would stayed'], answer: 2, hint: 'First conditional structure.' },
  { id: 'q5', skill: 'Grammar', difficulty: 3, prompt: 'The report must be ___ by Friday.', options: ['submitted', 'submitting', 'submit', 'submits'], answer: 0, hint: 'Passive voice after "must be".' },
  { id: 'q6', skill: 'Vocabulary', difficulty: 3, prompt: 'Which word is closest in meaning to "reluctant"?', options: ['unwilling', 'eager', 'careless', 'generous'], answer: 0, hint: 'Hesitant or not willing to do something.' },
  { id: 'q7', skill: 'Grammar', difficulty: 4, prompt: 'Despite ___ hard, he failed the exam.', options: ['studying', 'study', 'studied', 'to study'], answer: 0, hint: 'Gerund follows the preposition "despite".' },
  { id: 'q8', skill: 'Vocabulary', difficulty: 4, prompt: 'The new policy will ___ all employees.', options: ['affect', 'effect', 'affection', 'affective'], answer: 0, hint: 'Verb form meaning "to influence".' },
  { id: 'q9', skill: 'Grammar', difficulty: 5, prompt: 'Hardly ___ the room when the phone rang.', options: ['had she entered', 'she had entered', 'she entered', 'did she enter'], answer: 0, hint: 'Inversion after negative adverbial "hardly".' },
  { id: 'q10', skill: 'Vocabulary', difficulty: 5, prompt: 'The decision was ___ and left no room for appeal.', options: ['definitive', 'definite', 'defined', 'definitional'], answer: 0, hint: 'Meaning final and conclusive.' }
]

const PLANS = [
  { id: 'month', name: 'Monthly Plan', price: 199000, cycle: 'per month', perks: ['Streak freeze', 'Level-based Leaderboards', 'Unlimited practice'], bonusXp: 0 },
  { id: 'year', name: 'Yearly Plan', price: 1790000, cycle: 'per year', perks: ['Streak freeze', 'Level-based Leaderboards', 'Special Pro Badge', 'Offline mode'], bonusXp: 500 }
]

let S
export function reset() {
  jwtAuthEngine.reset()
  S = {
    seq: 0,
    user: null,
    password: null,
    currentToken: null,
    currentRefreshToken: null,
    reauth: null,
    level: 2,
    correctRun: 0,
    wrongRun: 0,
    xp: 120,
    streak: 3,
    lastActive: null,
    todayCount: 0,
    questPaid: false,
    reason: 'Starting at a level tailored to your initial proficiency.',
    open: new Map(),
    items: new Map(),
    results: new Map(),
    rewards: new Map(),
    stats: {},
    asked: [],
    overrides: [],
    orders: new Map(),
    bizOrders: new Map()
  }
}
reset()

export function expireAccessToken() {
  if (S.currentToken) {
    jwtAuthEngine.forceExpireToken(S.currentToken)
  }
}

const pubReward = (r) => ({ id: r.id, amount: r.amount, status: r.status, source: r.source, at: r.at })
const addReward = (amount, source, finalStatus, status = 'PENDING') => {
  const r = { id: `rw_${++S.seq}`, amount, source, at: new Date().toISOString(), finalStatus, status, credited: false }
  S.rewards.set(r.id, r)
  return r
}
const credit = (r) => { if (!r.credited) { r.credited = true; S.xp += r.amount } }

// ---- Auth Handlers ----
async function register(b, headers) {
  const deviceId = headers['X-Device-Id'] || b?.device_id || 'dev_web_default'
  try {
    const res = await jwtAuthEngine.register({
      email: b?.email,
      password: b?.password,
      name: b?.name,
      deviceId
    })
    S.user = b.email
    S.password = b.password
    S.currentToken = res.access_token
    S.currentRefreshToken = res.refresh_token
    return {
      accessToken: res.access_token,
      access_token: res.access_token,
      refreshToken: res.refresh_token,
      refresh_token: res.refresh_token,
      tokenType: res.token_type,
      token_type: res.token_type,
      expiresIn: res.expires_in,
      expires_in: res.expires_in,
      user: res.user
    }
  } catch (e) {
    throw new ApiError(e.code || 'INVALID_REQUEST', e.status || 400, e.message)
  }
}

async function login(b, headers) {
  const deviceId = headers['X-Device-Id'] || b?.device_id || 'dev_web_default'
  try {
    const res = await jwtAuthEngine.login({
      email: b?.email,
      password: b?.password,
      deviceId
    })

    // If 2FA is required, return challenge without tokens
    if (res.mfa_required) {
      return res
    }

    S.user = b.email
    S.password = b.password
    S.currentToken = res.access_token
    S.currentRefreshToken = res.refresh_token

    return {
      accessToken: res.access_token,
      access_token: res.access_token,
      refreshToken: res.refresh_token,
      refresh_token: res.refresh_token,
      tokenType: res.token_type,
      token_type: res.token_type,
      expiresIn: res.expires_in,
      expires_in: res.expires_in,
      user: res.user
    }
  } catch (e) {
    throw new ApiError(e.code || 'INVALID_CREDENTIALS', e.status || 401, e.message)
  }
}

async function verify2Fa(b, headers) {
  const deviceId = headers['X-Device-Id'] || b?.device_id || 'dev_web_default'
  try {
    const res = await jwtAuthEngine.verifyTwoFactor({
      mfaToken: b.mfa_token,
      code: b.code,
      deviceId
    })
    S.user = res.user.email
    S.currentToken = res.access_token
    S.currentRefreshToken = res.refresh_token

    return {
      accessToken: res.access_token,
      access_token: res.access_token,
      refreshToken: res.refresh_token,
      refresh_token: res.refresh_token,
      tokenType: res.token_type,
      token_type: res.token_type,
      expiresIn: res.expires_in,
      expires_in: res.expires_in,
      user: res.user
    }
  } catch (e) {
    throw new ApiError(e.code || '2FA_INVALID', e.status || 401, e.message)
  }
}

async function loginSocial(provider, b, headers) {
  const deviceId = headers['X-Device-Id'] || b?.device_id || 'dev_web_default'
  try {
    const res = await jwtAuthEngine.loginSocial({
      provider,
      email: b?.email,
      name: b?.name,
      deviceId
    })
    S.user = res.user.email
    S.currentToken = res.access_token
    S.currentRefreshToken = res.refresh_token

    return {
      accessToken: res.access_token,
      access_token: res.access_token,
      refreshToken: res.refresh_token,
      refresh_token: res.refresh_token,
      tokenType: res.token_type,
      token_type: res.token_type,
      expiresIn: res.expires_in,
      expires_in: res.expires_in,
      user: res.user
    }
  } catch (e) {
    throw new ApiError(e.code || 'OAUTH_FAILED', e.status || 400, e.message)
  }
}

async function refresh(b, headers) {
  const deviceId = headers['X-Device-Id'] || b?.device_id || 'dev_web_default'
  const rt = b?.refresh_token || b?.refreshToken || S.currentRefreshToken
  if (!rt) {
    throw new ApiError('SESSION_REVOKED', 401, 'No active session to refresh')
  }

  try {
    const res = await jwtAuthEngine.refresh({
      refreshToken: rt,
      deviceId
    })
    S.currentToken = res.access_token
    S.currentRefreshToken = res.refresh_token

    return {
      accessToken: res.access_token,
      access_token: res.access_token,
      refreshToken: res.refresh_token,
      refresh_token: res.refresh_token,
      tokenType: res.token_type,
      token_type: res.token_type,
      expiresIn: res.expires_in,
      expires_in: res.expires_in,
      user: { email: S.user }
    }
  } catch (e) {
    throw new ApiError(e.code || 'REFRESH_TOKEN_INVALID', e.status || 401, e.message)
  }
}

async function logout(b, headers) {
  const deviceId = headers['X-Device-Id'] || 'dev_web_default'
  const authHeader = headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/, '') || S.currentToken
  const rt = b?.refresh_token || S.currentRefreshToken

  await jwtAuthEngine.logout({
    accessToken: token,
    refreshToken: rt,
    deviceId
  })

  S.currentToken = null
  S.currentRefreshToken = null
  return { ok: true }
}

function reauth(b) {
  if (b?.password !== S.password && b?.password !== 'demo1234') {
    throw new ApiError('INVALID_CREDENTIALS', 401, 'Incorrect re-authentication password')
  }
  S.reauth = { token: `rt_sec_${++S.seq}`, exp: Date.now() + 300_000 }
  return { reauthToken: S.reauth.token, expiresIn: 300 }
}

// ---- Learning / Adaptive ----
function nextItem() {
  let pool = BANK.filter((i) => i.difficulty === S.level && !S.asked.slice(-2).includes(i.id))
  if (!pool.length) pool = BANK.filter((i) => i.difficulty === S.level)
  const it = pool[Math.floor(Math.random() * pool.length)]
  S.asked.push(it.id)
  S.items.set(it.id, it)
  return {
    activityId: it.id,
    item: {
      id: it.id, skill: it.skill, prompt: it.prompt, options: it.options, difficulty: it.difficulty, hint: it.hint,
      localKey: it.answer,
      xp: { correct: BASE_XP * it.difficulty, effort: EFFORT_XP }
    },
    decision: { difficulty: S.level, reason: S.reason, fallback: false }
  }
}

function start(activityId) {
  if (!S.items.has(activityId)) throw new ApiError('ACTIVITY_NOT_FOUND', 404)
  if (!S.open.has(activityId)) S.open.set(activityId, `att_${++S.seq}`)
  return { attempt_id: S.open.get(activityId), activity_id: activityId }
}

function submit(attemptId, b) {
  const cached = S.results.get(attemptId)
  if (cached) return { ...cached, reward: pubReward(S.rewards.get(cached.reward.id)) }
  const activityId = [...S.open].find(([, a]) => a === attemptId)?.[0]
  if (!activityId) throw new ApiError('ATTEMPT_NOT_FOUND', 404)
  const it = S.items.get(activityId)
  S.open.delete(activityId)

  const correct = b.answer === it.answer
  const suspicious = b.response_time < MIN_RESPONSE_MS
  let amount = correct ? BASE_XP * it.difficulty : EFFORT_XP
  if (correct && b.hint_used) amount = Math.round(amount / 2)
  if (suspicious) amount = Math.round(amount * 0.2)

  if (!suspicious) {
    const st = (S.stats[it.skill] ??= { n: 0, c: 0 })
    st.n++
    if (correct) st.c++
    S.todayCount++
    if (correct && !b.hint_used) { S.correctRun++; S.wrongRun = 0 }
    else if (!correct) { S.wrongRun++; S.correctRun = 0 }
    const prev = S.level
    if (S.correctRun >= 3 && S.level < 5) {
      S.level++
      S.correctRun = 0
      S.reason = `You answered 3 consecutive correct answers (3 câu liên tiếp) at level ${prev}, increasing difficulty by one tier.`
    } else if (S.wrongRun >= 2 && S.level > 1) {
      S.level--
      S.wrongRun = 0
      S.reason = `Level ${prev} was challenging, lowering one tier to reinforce fundamentals.`
    }
  }
  const today = new Date().toDateString()
  if (S.lastActive !== today) { S.lastActive = today; S.streak++ }

  if (!S.questPaid && S.todayCount >= questTarget()) {
    S.questPaid = true
    credit(addReward(30, "Today's Daily Quest Completed", 'CONFIRMED', 'CONFIRMED'))
  }

  const reward = addReward(amount, `Question Level ${it.difficulty}/5 · ${it.skill}`, suspicious ? 'SUSPICIOUS' : 'CONFIRMED')
  const res = { attempt_id: attemptId, correct, correct_answer: it.answer, reward: pubReward(reward) }
  S.results.set(attemptId, res)
  return res
}

function reward(id) {
  const r = S.rewards.get(id)
  if (!r) throw new ApiError('REWARD_NOT_FOUND', 404)
  if (r.status === 'PENDING') { r.status = r.finalStatus; credit(r) }
  return pubReward(r)
}

function override(b) {
  const now = Date.now()
  S.overrides = S.overrides.filter((t) => now - t < HOUR)
  if (S.overrides.length >= 2) throw new ApiError('OVERRIDE_RATE_LIMITED', 429)
  S.overrides.push(now)
  S.level = clamp(S.level + (b.kind === 'too_easy' ? 1 : -1))
  S.correctRun = 0
  S.wrongRun = 0
  S.reason = b.kind === 'too_easy'
    ? `Adjusted per your "too easy" feedback, next question at level ${S.level}.`
    : `Adjusted per your "too hard" feedback, next question at level ${S.level}.`
  return { ok: true }
}

// ---- Gamification / Progress ----
const questTarget = () => (S.level >= 4 ? 5 : 3)
const feed = () => [...S.rewards.values()].reverse().slice(0, 20).map(pubReward)

function profile() {
  const badges = [{ id: 'start', name: 'Starter Badge' }]
  if (S.streak >= 3) badges.push({ id: 'streak3', name: '3-Day Streak' })
  return { xp: S.xp, streak: S.streak, badges, recentRewards: feed() }
}

function progress() {
  const band = (st) => (!st || st.n < 3 ? 'not enough data' : st.c / st.n >= 0.75 ? 'solid' : st.c / st.n >= 0.5 ? 'improving' : 'needs practice')
  return { skills: ['Vocabulary', 'Grammar'].map((name) => ({ name, band: band(S.stats[name]) })) }
}

function quests() {
  const target = questTarget()
  return [{
    id: 'daily', title: `Complete ${target} activities at suitable difficulty`, target,
    progress: Math.min(S.todayCount, target), difficulty: S.level, reward: { type: 'XP', amount: 30, source: "Today's Daily Quest" }
  }]
}

function leaderboard() {
  const others = [['Emma', 310], ['Liam', 260], ['Noah', 205], ['Sophia', 150], ['Olivia', 90]]
  const rows = [...others.map(([name, xp]) => ({ name, xp })), { name: 'You', xp: S.xp, isMe: true }]
    .sort((a, b) => b.xp - a.xp).map((r, i) => ({ rank: i + 1, ...r }))
  return { scope: 'level_group', group: 'Intermediate Tier', entries: rows }
}

// ---- Payment ----
function createOrder(b, headers) {
  const ok = S.reauth && headers['X-ReAuth-Token'] === S.reauth.token && Date.now() < S.reauth.exp
  if (!ok) throw new ApiError('REAUTH_REQUIRED', 403)
  const dup = S.bizOrders.get(b.biz_order_no)
  if (dup) throw new ApiError('DUPLICATE_ORDER', 409, 'Order already exists', { orderNo: dup })
  const plan = PLANS.find((p) => p.id === b.plan)
  if (!plan) throw new ApiError('PLAN_NOT_FOUND', 404)
  const orderNo = `ORD${++S.seq}`
  S.orders.set(orderNo, { orderNo, status: 'PENDING', plan: plan.id, amount: plan.price, polls: 0, credited: false })
  S.bizOrders.set(b.biz_order_no, orderNo)
  return { orderNo, status: 'PENDING' }
}

function orderStatus(orderNo) {
  const o = S.orders.get(orderNo)
  if (!o) throw new ApiError('ORDER_NOT_FOUND', 404)
  if (o.status === 'PENDING' && ++o.polls >= 3) {
    o.status = 'SUCCESS'
    o.nextBillingDate = new Date(Date.now() + (o.plan === 'year' ? 365 : 30) * 86400_000).toISOString()
  }
  const plan = PLANS.find((p) => p.id === o.plan)
  if (o.status === 'SUCCESS' && !o.credited && plan.bonusXp) {
    o.credited = true
    credit(addReward(plan.bonusXp, `Gift for ${plan.name}`, 'CONFIRMED', 'CONFIRMED'))
  }
  return { orderNo, status: o.status, plan: o.plan, amount: o.amount, nextBillingDate: o.nextBillingDate }
}

// ---- Route Dispatcher ----
async function route(method, path, b, headers) {
  let m

  if (!PUBLIC.includes(path)) {
    const authHeader = headers.Authorization || headers.authorization
    const deviceId = headers['X-Device-Id'] || headers['x-device-id']

    if (!authHeader) {
      if (!S.currentRefreshToken) {
        throw new ApiError('SESSION_REVOKED', 401, 'Session has expired or been revoked')
      }
      throw new ApiError('UNAUTHORIZED', 401, 'Missing Authorization Bearer header')
    }

    try {
      await jwtAuthEngine.verifyRequest(authHeader, deviceId)
    } catch (e) {
      throw new ApiError(e.code || 'TOKEN_INVALID', e.status || 401, e.message)
    }
  }

  // Auth Routes
  if (method === 'POST' && path === '/auth/register') return await register(b, headers)
  if (method === 'POST' && path === '/auth/login') return await login(b, headers)
  if (method === 'POST' && path === '/auth/oauth/google') return await loginSocial('google', b, headers)
  if (method === 'POST' && path === '/auth/oauth/facebook') return await loginSocial('facebook', b, headers)
  if (method === 'POST' && path === '/auth/2fa/verify') return await verify2Fa(b, headers)
  if (method === 'POST' && path === '/auth/2fa/toggle') {
    const authHeader = headers.Authorization || headers.authorization
    const verified = await jwtAuthEngine.verifyRequest(authHeader)
    const enabled = jwtAuthEngine.toggleTwoFactor(verified.sub)
    return { two_factor_enabled: enabled }
  }
  if (method === 'POST' && path === '/auth/refresh') return await refresh(b, headers)
  if (method === 'POST' && path === '/auth/logout') return await logout(b, headers)
  if (method === 'POST' && path === '/auth/logout-all') return await jwtAuthEngine.logoutAll({ userId: S.user, deviceId: headers['X-Device-Id'] })
  if (method === 'POST' && path === '/auth/reauth') return reauth(b)
  if (method === 'GET' && path === '/auth/me') return { user: { email: S.user, roles: ['user'] } }
  if (method === 'GET' && path === '/.well-known/jwks.json') return jwtAuthEngine.getJwks()
  if (method === 'GET' && path === '/auth/audit-logs') return { logs: jwtAuthEngine.auditLogs }
  if (method === 'POST' && path === '/admin/toggle-lock') return { isLocked: jwtAuthEngine.toggleLockUser(b.email || S.user) }

  // Learning Endpoints
  if (method === 'GET' && path === '/adaptive/next-item') return nextItem()
  if (method === 'POST' && (m = path.match(/^\/learning\/activities\/([^/]+)\/start$/))) return start(m[1])
  if (method === 'POST' && (m = path.match(/^\/learning\/attempts\/([^/]+)\/submit$/))) return submit(m[1], b)
  if (method === 'POST' && path === '/adaptive/override') return override(b)
  if (method === 'GET' && path === '/learning/progress') return progress()

  // Gamification Endpoints
  if (method === 'GET' && path === '/gamification/profile') return profile()
  if (method === 'GET' && (m = path.match(/^\/gamification\/rewards\/([^/]+)$/))) return reward(m[1])
  if (method === 'GET' && path === '/gamification/quests/today') return quests()
  if (method === 'GET' && path === '/gamification/leaderboard') return leaderboard()

  // Payment Endpoints
  if (method === 'GET' && path === '/payment/plans') return PLANS
  if (method === 'POST' && path === '/payment/orders') return createOrder(b, headers)
  if (method === 'GET' && (m = path.match(/^\/payment\/orders\/([^/]+)\/status$/))) return orderStatus(m[1])

  throw new ApiError('NOT_FOUND', 404, `Endpoint ${method} ${path} not found`)
}

export async function handle(method, path, body, headers = {}) {
  if (config.latency) await sleep(config.latency)
  const result = await route(method, path, body, headers)
  return structuredClone(result)
}
