// Kiểm tra hợp đồng frontend ↔ backend (qua backend giả). Chạy: npm run test:mock
import assert from 'node:assert/strict'
import { api, hooks, session, ApiError } from '../src/api/index.js'
import { config, reset, expireAccessToken } from '../src/api/mock.js'

config.latency = 0
const fresh = async () => {
  reset()
  session.token = null
  session.reauthToken = null
  try {
    await api.register('a@b.vn', 'demo1234', 'Alex Johnson')
  } catch {}
  await api.login('a@b.vn', 'demo1234')
}
const play = async (over = {}) => {
  const next = await api.nextItem()
  const { attempt_id } = await api.startActivity(next.activityId)
  const res = await api.submit(attempt_id, {
    item_id: next.item.id, attempt_id, answer: next.item.localKey,
    response_time: 2000, hint_used: false, client_timestamp: new Date().toISOString(), ...over
  })
  return { next, attempt_id, res }
}

// 1. Chưa đăng nhập: không khôi phục được phiên
reset(); session.token = null
await assert.rejects(() => api.restore(), { code: 'SESSION_REVOKED' })

// 2. Luồng cốt lõi: start cấp attempt_id → submit → reward PENDING → poll → CONFIRMED, XP chỉ tăng sau khi xác nhận
await fresh()
const xp0 = (await api.profile()).xp
let { next, attempt_id, res } = await play()
assert.equal(res.reward.status, 'PENDING')
assert.equal(res.reward.amount, 10 * next.item.difficulty, 'XP đúng = 10 × độ khó')
assert.equal((await api.profile()).xp, xp0, 'chưa cộng khi còn PENDING')
const done = await api.reward(res.reward.id)
assert.equal(done.status, 'CONFIRMED')
assert.equal((await api.profile()).xp, xp0 + done.amount)

// 3. Idempotent: nộp lại cùng attempt_id trả kết quả cũ, không cộng lần 2
const again = await api.submit(attempt_id, { answer: next.item.localKey, response_time: 2000, hint_used: false })
assert.equal(again.reward.id, res.reward.id)
assert.equal((await api.profile()).xp, xp0 + done.amount)

// 4. Tín hiệu nghi ngờ và hint
await fresh()
let r = await play({ response_time: 100 })
assert.equal((await api.reward(r.res.reward.id)).status, 'SUSPICIOUS')
assert.ok(r.res.reward.amount < 10 * r.next.item.difficulty)
r = await play({ hint_used: true })
assert.equal(r.res.reward.amount, Math.round((10 * r.next.item.difficulty) / 2))

// 5. Đúng 3 câu liên tiếp → tăng 1 bậc, kèm lý do từ backend
await fresh()
const start = (await api.nextItem()).decision.difficulty
for (let i = 0; i < 3; i++) await play()
const after = (await api.nextItem()).decision
assert.equal(after.difficulty, start + 1)
assert.match(after.reason, /3 câu liên tiếp/)

// 6. "Quá dễ/quá khó": không thưởng XP, giới hạn 2 lần/giờ (429)
await fresh()
const before = (await api.profile()).xp
await api.override('too_easy', 'o1')
await api.override('too_hard', 'o2')
await assert.rejects(() => api.override('too_easy', 'o3'), { code: 'OVERRIDE_RATE_LIMITED', status: 429 })
assert.equal((await api.profile()).xp, before)

// 7. TOKEN_EXPIRED → tự refresh rồi thử lại; SESSION_REVOKED → gọi hook về đăng nhập
await fresh()
expireAccessToken()
assert.ok((await api.profile()).xp >= 0, 'tự refresh khi token hết hạn')
let revoked = 0
hooks.onSessionRevoked = () => revoked++
await api.logout()
await assert.rejects(() => api.profile(), (e) => e instanceof ApiError && e.code === 'SESSION_REVOKED')
assert.equal(revoked, 1)

// 8. Thanh toán: cần re-auth, idempotent theo biz_order_no, chỉ SUCCESS sau khi backend xác nhận
await fresh()
await assert.rejects(() => api.createOrder('year', 'b1'), { code: 'REAUTH_REQUIRED', status: 403 })
await assert.rejects(() => api.reauth('sai-mat-khau'), { code: 'INVALID_CREDENTIALS' })
await api.reauth('demo1234')
const o = await api.createOrder('year', 'b1')
await assert.rejects(() => api.createOrder('year', 'b1'), (e) => e.code === 'DUPLICATE_ORDER' && e.details.orderNo === o.orderNo)
const st = []
for (let i = 0; i < 3; i++) st.push((await api.orderStatus(o.orderNo)).status)
assert.deepEqual(st, ['PENDING', 'PENDING', 'SUCCESS'])
assert.equal((await api.profile()).xp, 120 + 500, 'thưởng mua hàng chỉ cộng sau SUCCESS')

console.log('OK: 8 nhóm kiểm tra hợp đồng đều đạt')
