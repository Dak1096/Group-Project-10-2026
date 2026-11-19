<script setup>
import { onMounted, ref } from 'vue'
import { useGamificationStore } from '../stores/gamification'
import { useAuthStore } from '../stores/auth'

const gam = useGamificationStore()
const auth = useAuthStore()

const toggling2Fa = ref(false)
const twoFactorMsg = ref('')

onMounted(() => {
  for (const load of [gam.load, gam.loadProgress, gam.loadQuests, gam.loadLeaderboard]) load().catch(() => {})
})

const STATUS = {
  CONFIRMED: 'Credited',
  PENDING: 'Confirming',
  SUSPICIOUS: 'Under review',
  ROLLED_BACK: 'Rolled back'
}
const fmt = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })

async function handleToggle2Fa() {
  toggling2Fa.value = true
  twoFactorMsg.value = ''
  try {
    const isEnabled = await auth.toggle2Fa()
    twoFactorMsg.value = isEnabled
      ? '✅ Two-Factor Authentication is now ENABLED. You will be prompted for a 6-digit code on next login.'
      : '⚠️ Two-Factor Authentication has been DISABLED.'
  } finally {
    toggling2Fa.value = false
  }
}
</script>

<template>
  <section class="profile-section">
    <h1>Learner Profile</h1>

    <div class="stats">
      <div class="stat"><span class="stat-num">{{ gam.xp }}</span><span class="stat-label">Total XP</span></div>
      <div class="stat"><span class="stat-num">{{ gam.streak }}</span><span class="stat-label">Day Streak</span></div>
    </div>
    <p class="muted">Daily streak resets at 00:00 UTC.</p>

    <!-- Two-Factor Authentication (2FA) Management Card -->
    <article class="card security-card">
      <div class="security-card-header">
        <div>
          <h2>Account Security & 2-Factor Authentication</h2>
          <p class="muted">Protect your account with an extra verification step during sign in.</p>
        </div>
        <span :class="['pill-tag', auth.user?.two_factor_enabled ? 'pill-enabled' : 'pill-disabled']">
          {{ auth.user?.two_factor_enabled ? '2FA Active' : '2FA Inactive' }}
        </span>
      </div>

      <div class="security-card-body">
        <p v-if="twoFactorMsg" class="feedback-banner">{{ twoFactorMsg }}</p>
        <p class="sec-desc">
          When 2FA is active, signing in requires both your password and a temporary 6-digit verification code.
        </p>
        <button
          type="button"
          :class="['btn', auth.user?.two_factor_enabled ? 'danger' : 'primary']"
          :disabled="toggling2Fa"
          @click="handleToggle2Fa"
        >
          {{ toggling2Fa ? 'Updating…' : (auth.user?.two_factor_enabled ? 'Disable 2-Factor Authentication' : 'Enable 2-Factor Authentication') }}
        </button>
      </div>
    </article>

    <h2>Today's Quests</h2>
    <p v-if="!gam.quests.length" class="muted">No quests available for today.</p>
    <article v-for="q in gam.quests" :key="q.id" class="card">
      <strong>{{ q.title }}</strong>
      <progress :max="q.target" :value="q.progress" :aria-label="`${q.progress} of ${q.target}`"></progress>
      <p class="muted">{{ q.progress }}/{{ q.target }} · Reward: +{{ q.reward.amount }} {{ q.reward.type }} from {{ q.reward.source }}</p>
    </article>

    <h2>Skills Assessment</h2>
    <ul class="plain">
      <li v-for="s in gam.skills" :key="s.name"><strong>{{ s.name }}</strong>: {{ s.band }}</li>
    </ul>

    <h2>Earned Badges</h2>
    <ul class="plain"><li v-for="b in gam.badges" :key="b.id">🏆 {{ b.name }}</li></ul>

    <h2>Leaderboard<template v-if="gam.leaderboard"> · {{ gam.leaderboard.group }}</template></h2>
    <ol v-if="gam.leaderboard" class="board">
      <li v-for="r in gam.leaderboard.entries" :key="r.rank" :class="{ me: r.isMe }">
        <span>#{{ r.rank }}</span><span>{{ r.name }}</span><span class="amt">{{ r.xp }} XP</span>
      </li>
    </ol>

    <h2>Reward History</h2>
    <p v-if="!gam.ledger.length" class="muted">No reward transactions yet. Complete a practice question to get started.</p>
    <ul class="ledger">
      <li v-for="r in gam.ledger" :key="r.id">
        <span class="amt">+{{ r.amount }} XP</span>
        <span>{{ r.source }}</span>
        <span class="muted">{{ fmt(r.at) }} · {{ STATUS[r.status] ?? r.status }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.security-card {
  margin: 1.5rem 0;
  border-left: 4px solid #4f46e5;
}

.security-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.security-card-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}

.pill-tag {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  text-transform: uppercase;
}
.pill-enabled {
  background: #dcfce7;
  color: #166534;
}
.pill-disabled {
  background: #f3f4f6;
  color: #6b7280;
}

.sec-desc {
  font-size: 0.85rem;
  color: #4b5563;
  margin: 0.75rem 0;
}

.feedback-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
</style>
