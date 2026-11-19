<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import DifficultyMeter from '../components/DifficultyMeter.vue'
import { useLearningStore } from '../stores/learning'
import { useGamificationStore } from '../stores/gamification'

const learn = useLearningStore()
const gam = useGamificationStore()

onMounted(() => {
  if (learn.phase === 'idle') learn.loadNext()
  if (!gam.loaded) gam.load().catch(() => {})
})

const cur = computed(() => learn.current)
const answering = computed(() => learn.phase === 'answering')

function optionClass(i) {
  if (learn.phase !== 'feedback' || !learn.result) return ''
  if (learn.result.correctIndex === i) return 'is-correct'
  if (learn.chosen === i) return learn.result.correct === false ? 'is-wrong' : 'is-chosen'
  return ''
}

// Adaptive feedback in English
const feedback = computed(() => {
  const r = learn.result
  if (learn.phase !== 'feedback' || !r) return null
  if (r.offlineSaved && r.correct == null) {
    return { tone: 'info', title: 'Saved offline', text: 'This item will be evaluated and XP credited once your connection is restored. Your streak is intact.' }
  }
  const note = r.offlineSaved ? ' · awaiting sync' : r.tentative ? ' · confirming' : ''
  if (r.status === 'ROLLED_BACK') {
    return { tone: 'warn', title: 'Reward rolled back', text: 'The system has reconciled the XP ledger for this activity.' }
  }
  if (r.status === 'SUSPICIOUS') {
    return { tone: 'warn', title: 'Answered too quickly', text: `You received ${r.xp} XP; this response was excluded from difficulty calibration.` }
  }
  if (r.correct) return { tone: 'good', title: 'Correct!', text: `+${r.xp} XP${r.source ? ' · ' + r.source : ''}${note}` }
  return { tone: 'neutral', title: 'Incorrect', text: `+${r.xp} XP for effort${note}. Every mistake helps calibrate exercises to your optimal skill level.` }
})

const ERRORS = {
  offline: () => `Offline mode. ${learn.queue.length} completed item(s) stored locally.`,
  CONTENT_LOCKED: () => 'This activity requires an active learning plan.',
  ACCOUNT_LOCKED: () => 'Your account is locked. Please contact support.'
}
const errorText = computed(() => (ERRORS[learn.error] ?? (() => 'Failed to load question. Please check your connection and retry.'))())
</script>

<template>
  <section class="practice">
    <div class="stats">
      <div class="stat">
        <span class="stat-num" :key="gam.displayXp" :class="{ bump: learn.phase === 'feedback' }">{{ gam.displayXp }}</span>
        <span class="stat-label">XP<template v-if="gam.pendingXp"> ({{ gam.pendingXp }} pending)</template></span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ gam.streak }}</span>
        <span class="stat-label">day streak</span>
      </div>
      <div v-if="learn.combo >= 2" class="stat">
        <span class="stat-num">{{ learn.combo }}</span>
        <span class="stat-label">correct in a row</span>
      </div>
    </div>

    <div v-if="learn.phase === 'loading' || learn.phase === 'idle'" class="card skeleton" aria-busy="true">Loading question…</div>

    <div v-else-if="learn.phase === 'error'" class="card">
      <p>{{ errorText }}</p>
      <RouterLink v-if="learn.error === 'CONTENT_LOCKED'" class="btn primary" to="/payment">View Learning Plans</RouterLink>
      <button v-else type="button" class="btn" @click="learn.loadNext()">Try Again</button>
    </div>

    <template v-else-if="cur">
      <div class="card">
        <div class="card-head">
          <span class="skill">{{ cur.item.skill }}</span>
          <DifficultyMeter :level="cur.item.difficulty" />
        </div>
        <p v-if="learn.reason" class="reason">Why this question: {{ learn.reason }}</p>

        <h1 class="prompt">{{ cur.item.prompt }}</h1>

        <ul class="options">
          <li v-for="(opt, i) in cur.item.options" :key="i">
            <button type="button" class="option" :class="optionClass(i)" :disabled="!answering" @click="learn.submit(i)">
              <span class="letter">{{ 'ABCD'[i] }}</span>{{ opt }}
            </button>
          </li>
        </ul>

        <p v-if="answering && cur.item.hint && !learn.hintUsed">
          <button type="button" class="link" @click="learn.useHint()">Need a hint? (Earns 50% XP if correct)</button>
        </p>
        <p v-if="learn.hintUsed && answering" class="hint">{{ cur.item.hint }}</p>

        <p v-if="learn.phase === 'submitting'" class="muted" role="status">Evaluating your answer…</p>

        <div v-if="feedback" class="feedback" :class="feedback.tone" role="status">
          <strong>{{ feedback.title }}</strong>
          <span>{{ feedback.text }}</span>
        </div>
        <button v-if="learn.phase === 'feedback'" type="button" class="btn primary" @click="learn.loadNext()">Next Question</button>
      </div>

      <div class="override" v-if="answering">
        <span>How does this feel?</span>
        <button type="button" class="btn small" :disabled="learn.overrideBusy || learn.overridesLeft <= 0" @click="learn.override('too_easy')">Too Easy</button>
        <button type="button" class="btn small" :disabled="learn.overrideBusy || learn.overridesLeft <= 0" @click="learn.override('too_hard')">Too Hard</button>
        <span class="muted">{{ learn.overridesLeft }} adjustments remaining this hour</span>
      </div>
    </template>
  </section>
</template>
