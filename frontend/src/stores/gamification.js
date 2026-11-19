import { defineStore } from 'pinia'
import { api, NetworkError } from '../api'

const REWARD_POLLS = 6
const REWARD_MS = 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Frontend chỉ HIỂN THỊ XP/streak. Số dư thật luôn do backend tổng hợp từ reward ledger.
// `pending` là phần XP lạc quan đang chờ backend xác nhận.
export const useGamificationStore = defineStore('gamification', {
  state: () => ({
    xp: 0,
    streak: 0,
    badges: [],
    ledger: [], // mỗi phần thưởng kèm nguồn: không có XP "tự nhiên xuất hiện"
    skills: [],
    quests: [],
    leaderboard: null,
    loaded: false,
    pending: {} // attemptId -> số XP lạc quan
  }),
  getters: {
    pendingXp: (s) => Object.values(s.pending).reduce((a, b) => a + b, 0),
    displayXp() {
      return this.xp + this.pendingXp
    }
  },
  actions: {
    async load() {
      const p = await api.profile()
      this.xp = p.xp
      this.streak = p.streak
      this.badges = p.badges ?? []
      this.ledger = p.recentRewards ?? []
      this.loaded = true
    },
    async loadProgress() { this.skills = (await api.progress()).skills },
    async loadQuests() { this.quests = await api.quests() },
    async loadLeaderboard() { this.leaderboard = await api.leaderboard() },

    addOptimistic(attemptId, amount) { this.pending[attemptId] = amount },
    rollback(attemptId) { delete this.pending[attemptId] },

    upsertLedger(r) {
      const i = this.ledger.findIndex((x) => x.id === r.id)
      if (i >= 0) this.ledger[i] = r
      else this.ledger.unshift(r)
    },

    // Phần thưởng có thể ở trạng thái PENDING: poll GET /gamification/rewards/{id} đến khi có kết quả cuối
    // (CONFIRMED / SUSPICIOUS / ROLLED_BACK). Không cộng lạc quan quá mức: xong thì dùng số thật từ backend.
    async trackReward(attemptId, reward, onFinal) {
      let r = reward
      this.upsertLedger(r)
      for (let i = 0; i < REWARD_POLLS && r.status === 'PENDING'; i++) {
        await sleep(REWARD_MS)
        try {
          r = await api.reward(r.id)
          this.upsertLedger(r)
        } catch (e) {
          if (!(e instanceof NetworkError)) break
        }
      }
      delete this.pending[attemptId]
      await this.load().catch(() => {}) // lấy số dư mới (tổng hợp từ ledger)
      onFinal?.(r)
    }
  }
})
