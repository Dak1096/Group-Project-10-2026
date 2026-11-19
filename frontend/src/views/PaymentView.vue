<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { useGamificationStore } from '../stores/gamification'
import { track } from '../track'

const PENDING_KEY = 'll.pendingOrder.v1'
const MAX_POLLS = 10
const POLL_MS = 2000

const route = useRoute()
const gam = useGamificationStore()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// loading | choose | creating | verifying | success | failed | refunded | timeout | reauth | error
const state = ref('loading')
const plans = ref([])
const order = ref(null)
const chosenPlan = ref(null)
const password = ref('')
const reauthError = ref('')
const bizOrderNo = crypto.randomUUID()
let alive = true

const usdOrVnd = (n) => `$${(n / 25000).toFixed(2)}` // Clean USD display for English UI
const readPending = () => { try { return localStorage.getItem(PENDING_KEY) } catch { return null } }
const setPending = (v) => { try { v ? localStorage.setItem(PENDING_KEY, v) : localStorage.removeItem(PENDING_KEY) } catch {} }

onMounted(async () => {
  const pendingNo = route.query.orderNo || readPending()
  if (pendingNo) return poll(String(pendingNo))
  try {
    plans.value = await api.plans()
    state.value = 'choose'
  } catch {
    state.value = 'error'
  }
})
onBeforeUnmount(() => { alive = false })

async function poll(orderNo) {
  state.value = 'verifying'
  for (let i = 0; i < MAX_POLLS && alive; i++) {
    try {
      const o = await api.orderStatus(orderNo)
      order.value = o
      if (o.status === 'SUCCESS') {
        setPending(null)
        state.value = 'success'
        track('payment_success', { plan: o.plan })
        gam.load().catch(() => {})
        return
      }
      if (o.status === 'FAILED' || o.status === 'EXPIRED' || o.status === 'REFUNDED') {
        setPending(null)
        state.value = o.status === 'REFUNDED' ? 'refunded' : 'failed'
        return
      }
    } catch {}
    await sleep(POLL_MS)
  }
  if (alive) state.value = 'timeout'
}

async function pay(plan) {
  if (state.value !== 'choose' && state.value !== 'reauth') return
  chosenPlan.value = plan
  state.value = 'creating'
  try {
    const o = await api.createOrder(plan.id, bizOrderNo)
    setPending(o.orderNo)
    if (o.payUrl) return window.location.assign(o.payUrl)
    await poll(o.orderNo)
  } catch (e) {
    if (e.code === 'REAUTH_REQUIRED') state.value = 'reauth'
    else if (e.code === 'DUPLICATE_ORDER' && e.details?.orderNo) await poll(e.details.orderNo)
    else state.value = 'error'
  }
}

async function reauth() {
  reauthError.value = ''
  try {
    await api.reauth(password.value)
    password.value = ''
    await pay(chosenPlan.value)
  } catch (e) {
    reauthError.value = e.code === 'INVALID_CREDENTIALS' ? 'Incorrect password.' : 'Verification failed. Please try again.'
  }
}
</script>

<template>
  <section>
    <h1>Learning Plans</h1>

    <p v-if="state === 'loading'" class="muted">Loading plans…</p>

    <div v-else-if="state === 'choose' || state === 'creating'" class="plans">
      <p class="muted">Adaptive exercises, XP, and streaks are always free. Premium unlocks advanced perks below.</p>
      <article v-for="p in plans" :key="p.id" class="card">
        <h2>{{ p.name }}</h2>
        <p class="price">{{ usdOrVnd(p.price) }} <span class="muted">{{ p.cycle }}</span></p>
        <ul class="plain"><li v-for="perk in p.perks" :key="perk">{{ perk }}</li></ul>
        <p v-if="p.bonusXp" class="muted">+{{ p.bonusXp }} Bonus XP credited upon confirmed checkout.</p>
        <button type="button" class="btn primary" :disabled="state === 'creating'" @click="pay(p)">
          {{ state === 'creating' ? 'Processing…' : `Subscribe to ${p.name}` }}
        </button>
      </article>
    </div>

    <div v-else-if="state === 'verifying'" class="card" role="status" aria-busy="true">
      <strong>Verifying payment…</strong>
      <p class="muted">Please keep this window open. If closed, the system will verify order status automatically upon your next visit.</p>
    </div>

    <div v-else-if="state === 'success'" class="card" role="status">
      <strong>Payment Successful!</strong>
      <p v-if="order?.nextBillingDate">Next billing date: {{ new Date(order.nextBillingDate).toLocaleDateString('en-US') }}.</p>
    </div>

    <div v-else-if="state === 'failed'" class="card">
      <strong>Payment was unsuccessful</strong>
      <p class="muted">Your card was not charged. Please select a plan to try again.</p>
      <a class="btn" href="/payment">Return to Plans</a>
    </div>

    <div v-else-if="state === 'refunded'" class="card"><strong>This order has been refunded</strong></div>

    <div v-else-if="state === 'timeout'" class="card">
      <strong>Verification Pending</strong>
      <p class="muted">Your order has been recorded and will update as soon as the payment gateway confirms.</p>
      <button type="button" class="btn" @click="poll(readPending())">Re-check Status</button>
    </div>

    <div v-else-if="state === 'reauth'" class="card">
      <strong>Confirm Password to Checkout</strong>
      <p class="muted">For your security, please re-enter your password before creating this payment order.</p>
      <form @submit.prevent="reauth">
        <label>Password<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <p v-if="reauthError" class="error" role="alert">{{ reauthError }}</p>
        <button type="submit" class="btn primary">Confirm & Pay</button>
      </form>
    </div>

    <div v-else class="card"><p>Unable to load plan details. Please try again later.</p></div>
  </section>
</template>
