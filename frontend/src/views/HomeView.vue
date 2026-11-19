<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const brand = 'EnglishStep'

const goals = [
  { label: 'IELTS', color: '#e8453c', icon: 'I' },
  { label: 'TOEIC', color: '#3b82f6', icon: 'T' },
  { label: 'Vocabulary', color: '#f4c95d', icon: 'V' },
  { label: 'Pronunciation', color: '#10d98c', icon: 'P' },
  { label: 'Grammar', color: '#a855f7', icon: 'G' },
  { label: 'Speaking', color: '#f97316', icon: 'S' },
  { label: 'Listening', color: '#06b6d4', icon: 'L' },
]

const features = [
  {
    tag: 'ADAPTIVE PRACTICE',
    title: 'Practice focused on your weak spots',
    text: 'The system tracks vocabulary and grammar you often get wrong, then selects the next exercises to review exactly those areas.',
    mock: 'quiz',
  },
  {
    tag: 'PRONUNCIATION',
    title: 'Perfect every single sound',
    text: 'Read a sentence aloud, see which sounds are incorrect, and practice again right within the same lesson.',
    mock: 'speech',
  },
  {
    tag: 'SPEAKING PRACTICE',
    title: 'Learn for real life',
    text: 'Get instant feedback that builds lasting confidence. Speaking practice helps you beat speaking anxiety with personalised pronunciation feedback after every sentence you say.',
    mock: 'path',
  },
  {
    tag: 'SELF-LED LEARNING',
    title: 'Learn your way',
    text: 'Whatever your reason for learning English, we’ve got you covered. Pick any goal, from IELTS to everyday conversation, with short, focused lessons. You’re in control.',
    mock: 'goal',
  },
]

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const track = ref(null)
const scrollGoals = (dir) => {
  track.value?.scrollBy({ left: dir * 320, behavior: 'smooth' })
}

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="font-['Figtree',sans-serif] bg-[#171a23] text-[#e8eaf2] min-h-screen">
    
    <!-- HERO SECTION -->
    <section class="min-h-[560px] bg-gradient-to-br from-[#3f5fd9] to-[#6a4bc9] px-4 md:px-10 pb-[70px]">
      <!-- Navbar -->
      <header class="flex justify-between items-center py-[22px] max-w-[1100px] mx-auto">
        <a class="flex items-center gap-[10px] cursor-pointer" @click="goToLogin">
          <span class="w-8 h-[30px] rounded-[10px_10px_10px_4px] bg-gradient-to-b from-white via-white to-[#9cc4ff] block"></span>
          <span class="text-[26px] font-extrabold tracking-[-0.5px] text-white">{{ brand }}</span>
        </a>
        <div class="flex gap-[14px]">
          <button @click="goToLogin" class="hidden md:inline-flex items-center justify-center px-6 py-[10px] rounded-full font-bold text-[15px] border-2 border-[#3b3f55] bg-[#111] text-[#7fa4ff] hover:-translate-y-[1px] hover:brightness-110 transition">
            Learn for free
          </button>
          <button @click="goToLogin" class="inline-flex items-center justify-center px-6 py-[10px] rounded-full font-bold text-[15px] border-2 border-[#5d6bc4] text-white hover:-translate-y-[1px] hover:bg-white/10 transition">
            Log in
          </button>
        </div>
      </header>

      <!-- Hero Body -->
      <div class="max-w-[1100px] mx-auto mt-[30px] grid md:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div class="z-10">
          <h1 class="text-[36px] md:text-[52px] leading-[1.12] font-bold mb-6 text-white">Language skills for the conversations that count</h1>
          <p class="text-[18px] leading-relaxed max-w-[460px] mb-[30px] text-[#e8eaf2]">
            {{ brand }} understands what you already know, where you get stuck, and your goals, so you're ready to speak English with confidence.
          </p>
          <button @click="goToLogin" class="inline-flex items-center justify-center bg-[#3ddc97] text-[#0b2e22] w-full max-w-[290px] px-6 py-[18px] rounded-full text-[18px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-[1px] hover:brightness-110 transition">
            Learn for free
          </button>
        </div>

        <!-- Hero Art (Map & Bubbles) -->
        <div class="relative h-[300px] md:h-[340px] max-w-[420px] mx-auto w-full">
          <div class="absolute inset-[40px_0_0_20px] bg-[#4a9cf0] opacity-70 rounded-[60%_40%_55%_45%/50%_60%_40%_50%]"></div>
          
          <div class="absolute rounded-full bg-[#cfe9f6] grid place-items-center font-extrabold text-[40px] text-[#2c3e73] w-[112px] h-[112px] left-0 top-[90px] shadow-sm">A</div>
          <div class="absolute rounded-full bg-[#d4ebfa] grid place-items-center font-extrabold text-[40px] text-[#2c3e73] w-[76px] h-[76px] left-[262px] top-[12px] shadow-sm">B</div>
          <div class="absolute rounded-full bg-[#d4ebfa] grid place-items-center font-extrabold text-[40px] text-[#2c3e73] w-[136px] h-[136px] right-0 top-[130px] shadow-sm">C</div>
          <div class="absolute rounded-full bg-[#f6dd8e] grid place-items-center font-extrabold text-[40px] text-[#2c3e73] w-[124px] h-[124px] left-[130px] bottom-0 shadow-sm">D</div>
          
          <div class="absolute bg-white text-[#1d2340] font-bold px-4 py-2 rounded-[18px] text-[18px] left-[90px] top-[50px] shadow-md">Good morning!</div>
          <div class="absolute bg-white text-[#1d2340] font-bold px-4 py-2 rounded-[18px] text-[18px] left-[290px] top-[-26px] shadow-md">Hello!</div>
          <div class="absolute bg-white text-[#1d2340] font-bold px-4 py-2 rounded-[18px] text-[18px] left-[185px] top-[150px] shadow-md">How are you?</div>
          <div class="absolute bg-white text-[#1d2340] font-bold px-4 py-2 rounded-[18px] text-[18px] right-0 top-[96px] shadow-md">Nice to meet you!</div>
        </div>
      </div>
    </section>

    <!-- DARK SECTION -->
    <section class="px-6 py-[56px] pb-[100px] bg-[#171a23]">
      <h2 class="text-center text-[22px] mb-[28px] font-bold text-white">I want to learn</h2>

      <!-- Carousel -->
      <div class="flex items-center gap-[10px] max-w-[1100px] mx-auto">
        <button class="text-[#9aa1b8] text-[48px] leading-none px-2 hover:text-white transition cursor-pointer" @click="scrollGoals(-1)">‹</button>
        <ul ref="track" class="flex gap-[30px] overflow-x-auto snap-x snap-mandatory flex-1 py-[6px] scrollbar-hide">
          <li v-for="g in goals" :key="g.label" class="flex-none w-[130px] snap-start flex flex-col items-center gap-[10px] cursor-pointer text-[#9aa1b8] font-bold hover:text-white transition">
            <span class="w-14 h-14 rounded-full grid place-items-center text-white font-extrabold text-[22px]" :style="{ background: g.color }">{{ g.icon }}</span>
            <span>{{ g.label }}</span>
          </li>
        </ul>
        <button class="text-[#9aa1b8] text-[48px] leading-none px-2 hover:text-white transition cursor-pointer" @click="scrollGoals(1)">›</button>
      </div>

      <h2 class="text-center text-[30px] md:text-[38px] font-bold mt-[70px] md:mt-[110px] mb-[40px] md:mb-[70px] text-white">Why learn with {{ brand }}?</h2>

      <!-- Features -->
      <div class="max-w-[1100px] mx-auto space-y-[90px]">
        <article v-for="(f, i) in features" :key="f.tag" class="grid md:grid-cols-2 gap-10 md:gap-[80px] items-center" :class="{ 'md:[&>.mock-wrap]:order-2': i % 2 === 1 }">
          
          <!-- Mock UI -->
          <div class="mock-wrap bg-[#f4f6fb] rounded h-[330px] relative overflow-hidden text-[#1d2340] shadow-inner">
            
            <!-- Mock 1: Quiz -->
            <div v-if="f.mock === 'quiz'" class="relative w-full h-full">
              <div class="absolute left-[36px] top-[50px] w-[290px] bg-[#eef4fd] border-[3px] border-[#d7e3f4] rounded-[16px] p-[16px_20px] shadow-lg -rotate-[4deg] z-10">
                <div class="text-center font-bold mb-3">Notifications</div>
                <div class="flex gap-3 items-center text-[15px]">
                  <span class="w-11 h-11 rounded-full bg-[#3a2d26] text-white grid place-items-center font-bold flex-none">K</span>
                  <span>Next lesson: 10 vocabulary words you often forget</span>
                </div>
              </div>
              <div class="absolute right-[28px] top-[150px] w-[300px] bg-[#f4f6fb] border-[3px] border-[#d7e3f4] rounded-[16px] p-[16px_20px] shadow-lg rotate-[3deg] z-20">
                <p class="m-0 mb-2 text-[13px] text-[#6b7390] font-semibold">Choose the correct word</p>
                <p class="m-0 mb-[14px] text-[20px] font-semibold">She made a ____ to study every day.</p>
                <div class="flex flex-wrap gap-2">
                  <span class="border-2 border-[#d7e3f4] rounded-full px-3 py-1 text-[14px] font-semibold">decision</span>
                  <span class="border-2 border-[#10d98c] bg-[#e6fbf2] rounded-full px-3 py-1 text-[14px] font-semibold">commitment</span>
                  <span class="border-2 border-[#d7e3f4] rounded-full px-3 py-1 text-[14px] font-semibold">mistake</span>
                </div>
              </div>
            </div>

            <!-- Mock 2: Speech -->
            <div v-else-if="f.mock === 'speech'" class="relative w-full h-full">
              <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] bg-[#f4f6fb] border-[3px] border-[#d7e3f4] rounded-[16px] p-[16px_20px] shadow-lg">
                <p class="m-0 mb-2 text-[13px] text-[#6b7390] font-semibold">Say it aloud</p>
                <p class="m-0 mb-[14px] text-[20px] font-semibold">Th<span class="text-[#e8453c] not-italic font-normal">i</span>rty th<span class="text-[#0fae6f] not-italic font-normal">ou</span>sand</p>
                <div class="flex items-center gap-1 h-9">
                  <i v-for="n in 18" :key="n" class="w-[5px] rounded-[3px] bg-[#4c4be6] block" :style="{ height: 8 + ((n * 7) % 24) + 'px' }"></i>
                </div>
              </div>
            </div>

            <!-- Mock 3: Speaking Path -->
            <div v-else-if="f.mock === 'path'" class="relative w-full h-full">
              <div class="absolute left-[5%] top-[22px] w-[56%] bg-[#f4f6fb] border-[3px] border-[#d7e3f4] rounded-[16px] p-[16px_20px] shadow-lg -rotate-[3deg] z-10">
                <p class="m-0 mb-2 font-bold text-[14px]">A1 Beginner ⌄</p>
                <div class="relative h-[10px] rounded-md bg-[#dde4f2] mb-[14px]">
                  <i class="absolute inset-y-0 left-0 w-[32%] rounded-md bg-[#2fc986]"></i>
                  <span class="absolute left-[32%] -top-[3px] -translate-x-1/2 text-[9px] font-bold text-white bg-[#2fc986] rounded-md px-1">32%</span>
                </div>
                <p class="m-0 text-[22px] font-extrabold">Chapter 1</p>
                <p class="m-0 mt-[2px] mb-3 text-[12px] font-semibold">1/4 lessons completed</p>
                <ul class="space-y-1">
                  <li class="flex items-center gap-2.5 py-1 text-[14px] font-bold">
                    <span class="w-[30px] h-[30px] rounded-full grid place-items-center border-[3px] border-[#2fc986] text-[#0fae6f] text-[12px] flex-none">✓</span>Hello!
                  </li>
                  <li class="flex items-center gap-2.5 py-1 text-[14px] font-bold bg-[#e6eefb] rounded-lg pl-1.5 -ml-1.5">
                    <span class="w-[30px] h-[30px] rounded-full grid place-items-center border-[3px] border-[#c9d3e6] text-[12px] flex-none">2</span>Saying your name
                  </li>
                  <li class="flex items-center gap-2.5 py-1 text-[14px] font-bold text-[#8a93ab]">
                    <span class="w-[30px] h-[30px] rounded-full grid place-items-center border-[3px] border-[#c9d3e6] text-[12px] flex-none">3</span>How’s it going?
                  </li>
                </ul>
              </div>
              
              <div class="absolute right-[5%] top-[78px] w-[56%] bg-[#f4f6fb] border-[3px] border-[#2fc986] rounded-[16px] p-[16px_20px] shadow-lg rotate-[2deg] z-20">
                <p class="m-0 mb-1.5 text-[#0fae6f] font-extrabold text-[12px]">✓ PERFECT!</p>
                <p class="m-0 mb-2.5 text-[20px] font-extrabold">Where are you from?</p>
                <div class="flex gap-2 mb-2.5">
                  <span class="bg-[#3f5fd9] text-white rounded-full px-3 py-1 text-[12px] font-bold">▶ Original</span>
                  <span class="bg-[#3f5fd9] text-white rounded-full px-3 py-1 text-[12px] font-bold">▶ You</span>
                </div>
                <p class="m-0 text-[12px] leading-snug">Great job! Keep practicing. Another way to say it is “What country are you from?”</p>
              </div>
            </div>

            <!-- Mock 4: Daily Goal -->
            <div v-else class="relative w-full h-full">
              <div class="absolute left-[5%] top-[40px] w-[54%] bg-[#f4f6fb] border-[3px] border-[#d7e3f4] rounded-[16px] p-[16px_20px] shadow-lg -rotate-[2deg] z-10">
                <p class="m-0 mb-2 text-[13px] text-[#6b7390] font-semibold">True or false?</p>
                <p class="m-0 mb-[14px] text-[16px] font-semibold">We say “Good morning!” in the morning.</p>
                <div class="flex gap-2 mt-3">
                  <span class="flex-1 text-center border-2 border-[#d7e3f4] rounded-xl py-2 font-bold text-[14px]">True</span>
                  <span class="flex-1 text-center border-2 border-[#d7e3f4] rounded-xl py-2 font-bold text-[14px]">False</span>
                </div>
              </div>
              
              <div class="absolute right-[4%] top-[18px] w-[48%] bg-[#3f5fd9] border-[3px] border-[#5b78e8] rounded-[16px] p-[16px_20px] shadow-lg text-white text-center rotate-[2deg] z-20">
                <div class="w-[64px] h-[64px] mx-auto mb-2 rounded-full border-[5px] border-[#9db4ff] grid place-items-center text-[28px] text-[#ffd666]">★</div>
                <p class="m-0 mb-1.5 text-[20px] font-extrabold">You did it!</p>
                <p class="m-0 mb-3 text-[11px] leading-snug opacity-90">You just collected 20/20 points and completed your daily goal.</p>
                <div class="flex justify-between gap-[2px]">
                  <span v-for="(d, i) in days" :key="d" class="flex flex-col items-center gap-[3px] text-[9px]">
                    <b class="w-4 h-4 rounded-full grid place-items-center text-[10px] transition-colors" :class="i < 4 ? 'bg-white text-[#3f5fd9]' : 'bg-white/30'">{{ i < 4 ? '✓' : '' }}</b>
                    {{ d }}
                  </span>
                </div>
              </div>
            </div>

          </div>

          <!-- Feature Text -->
          <div class="feature-copy">
            <p class="text-[13px] font-bold tracking-[0.5px] text-[#9aa1b8] mb-3">{{ f.tag }}</p>
            <h3 class="text-[28px] font-bold mb-4 text-white">{{ f.title }}</h3>
            <p class="text-[#e8eaf2]/85 leading-relaxed text-[17px] max-w-[460px]">{{ f.text }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Hide scrollbar for carousel */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>