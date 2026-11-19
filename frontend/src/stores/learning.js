import { defineStore } from 'pinia'
import { api, NetworkError } from '../api'
import { useGamificationStore } from './gamification'
import { track } from '../track'

const QUEUE_KEY = 'll.queue.v1'
const OVERRIDE_KEY = 'll.override.v1'
const OVERRIDE_LIMIT = 2 // tối đa 2 lần/giờ
const HOUR = 3600_000
const DAY = 24 * HOUR // cửa sổ đồng bộ để vẫn tính streak (R-BE-06)

// Lưu nháp local. Bản production nên dùng IndexedDB; localStorage đủ cho phạm vi hiện tại.
const read = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d }
}
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* bộ nhớ đầy hoặc bị chặn: bỏ qua */ }
}

export const useLearningStore = defineStore('learning', {
  state: () => ({
    // idle | loading | answering | submitting | feedback | error
    phase: 'idle',
    current: null, // { attemptId, item, decision }
    shownAt: 0,
    hintUsed: false,
    chosen: null,
    result: null, // { correct, xp, status, source, tentative, correctIndex, offlineSaved }
    combo: 0, // chỉ để hiển thị, KHÔNG gửi lên adaptive
    error: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    queue: read(QUEUE_KEY, []),
    syncing: false,
    overrideTimes: read(OVERRIDE_KEY, []),
    overrideBusy: false
  }),
  getters: {
    overridesLeft(s) {
      const now = Date.now()
      return OVERRIDE_LIMIT - s.overrideTimes.filter((t) => now - t < HOUR).length
    },
    // Lý do gợi ý do backend cung cấp; khi fallback thì không hiển thị để tránh nói dối
    reason: (s) => (s.current && !s.current.decision.fallback ? s.current.decision.reason : ''),
    // Câu chờ đồng bộ quá 24 giờ có thể không được tính streak
    hasStaleQueue: (s) => s.queue.some((q) => Date.now() - Date.parse(q.client_timestamp) > DAY)
  },
  actions: {
    init() {
      const gam = useGamificationStore()
      // Dựng lại XP lạc quan cho các câu đang chờ đồng bộ sau khi tải lại trang
      for (const q of this.queue) gam.addOptimistic(q.attempt_id, q.optimisticXp)
      window.addEventListener('online', () => {
        this.online = true
        this.flushQueue()
      })
      window.addEventListener('offline', () => { this.online = false })
    },

    // 1) adaptive chọn hoạt động tiếp theo  2) start để backend cấp attempt_id (idempotent)
    async loadNext() {
      this.phase = 'loading'
      this.error = null
      try {
        const next = await api.nextItem()
        const { attempt_id } = await api.startActivity(next.activityId)
        this.current = { attemptId: attempt_id, item: next.item, decision: next.decision }
        this.hintUsed = false
        this.chosen = null
        this.result = null
        this.shownAt = performance.now()
        this.phase = 'answering'
        track('adaptive_decision_shown', { difficulty: next.decision.difficulty, fallback: next.decision.fallback })
      } catch (e) {
        this.error = e instanceof NetworkError ? 'offline' : e.code || 'UNKNOWN'
        this.phase = 'error'
      }
    },

    useHint() {
      this.hintUsed = true // hint_used ảnh hưởng XP và ước lượng năng lực (backend quyết định)
    },

    async submit(choice) {
      if (this.phase !== 'answering') return // chặn nộp trùng ngay từ lần bấm đầu
      this.phase = 'submitting'
      const cur = this.current
      const gam = useGamificationStore()
      this.chosen = choice

      const payload = {
        item_id: cur.item.id,
        attempt_id: cur.attemptId,
        answer: choice, // backend chấm điểm; frontend không gửi "correct" tự khai
        response_time: Math.round(performance.now() - this.shownAt),
        hint_used: this.hintUsed,
        client_timestamp: new Date().toISOString()
      }

      // Phản hồi tạm thời (nếu backend cho phép qua localKey) + XP lạc quan
      const key = cur.item.localKey
      let tentativeXp = 0
      if (key !== undefined) {
        const correct = choice === key
        tentativeXp = correct ? cur.item.xp.correct : cur.item.xp.effort
        gam.addOptimistic(cur.attemptId, tentativeXp)
        this.result = { correct, xp: tentativeXp, status: 'PENDING', tentative: true, correctIndex: key }
        this.combo = correct ? this.combo + 1 : 0
        this.phase = 'feedback'
      }
      track('answer_submit', { response_time: payload.response_time, hint_used: payload.hint_used })

      try {
        const res = await api.submit(cur.attemptId, payload)
        if (key === undefined) this.combo = res.correct ? this.combo + 1 : 0
        this.result = {
          correct: res.correct, xp: res.reward.amount, status: res.reward.status,
          source: res.reward.source, tentative: false, correctIndex: res.correct_answer
        }
        this.phase = 'feedback'
        // Phần thưởng PENDING → poll đến trạng thái cuối, rồi cập nhật lại phản hồi đang hiển thị
        gam.trackReward(cur.attemptId, res.reward, (r) => {
          if (this.current?.attemptId === cur.attemptId && this.result) {
            this.result = { ...this.result, xp: r.amount, status: r.status }
          }
        })
      } catch (e) {
        if (e instanceof NetworkError) {
          // Mất mạng: lưu nháp, đồng bộ sau bằng cùng attempt_id (idempotent), không phạt streak oan
          this.queue.push({ ...payload, optimisticXp: tentativeXp })
          write(QUEUE_KEY, this.queue)
          this.result = { ...(this.result ?? { correct: null, xp: 0 }), offlineSaved: true }
          this.phase = 'feedback'
        } else {
          gam.rollback(cur.attemptId)
          this.result = null
          this.error = e.code || 'UNKNOWN'
          this.phase = 'error'
        }
      }
    },

    // Đồng bộ hàng đợi theo thứ tự; dừng khi lại mất mạng.
    async flushQueue() {
      if (this.syncing || !this.queue.length) return
      this.syncing = true
      const gam = useGamificationStore()
      try {
        for (const q of [...this.queue]) {
          try {
            const res = await api.submit(q.attempt_id, q)
            gam.trackReward(q.attempt_id, res.reward)
          } catch (e) {
            if (e instanceof NetworkError || e.code === 'SESSION_REVOKED') break // chờ có mạng / đăng nhập lại
            gam.rollback(q.attempt_id) // backend từ chối: bỏ phần thưởng lạc quan
            track('sync_rejected', { code: e.code })
          }
          this.queue = this.queue.filter((x) => x.attempt_id !== q.attempt_id)
          write(QUEUE_KEY, this.queue)
        }
      } finally {
        this.syncing = false
      }
    },

    // "Quá dễ / quá khó": chống bấm liên tục, giới hạn tần suất, KHÔNG thưởng XP, không animation
    async override(kind) {
      if (this.phase !== 'answering' || this.overrideBusy || this.overridesLeft <= 0) return
      this.overrideBusy = true
      try {
        await api.override(kind, crypto.randomUUID())
        this.overrideTimes = [...this.overrideTimes.filter((t) => Date.now() - t < HOUR), Date.now()]
        write(OVERRIDE_KEY, this.overrideTimes)
        track('override_click', { kind })
        await this.loadNext()
      } catch (e) {
        if (e.code === 'OVERRIDE_RATE_LIMITED') {
          // backend đã chặn: đồng bộ bộ đếm cục bộ để nút tự khóa
          this.overrideTimes = Array(OVERRIDE_LIMIT).fill(Date.now())
          write(OVERRIDE_KEY, this.overrideTimes)
        } else {
          this.error = e instanceof NetworkError ? 'offline' : e.code || 'UNKNOWN'
          this.phase = 'error'
        }
      } finally {
        this.overrideBusy = false
      }
    }
  }
})
