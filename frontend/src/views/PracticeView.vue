<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// --- GAME STATE ---
const questions = ref([])
const currentIndex = ref(0)
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')

// Stats
const xp = ref(0)
const streak = ref(0)

// Current question state
const selectedOption = ref(null)
const isAnswered = ref(false)
const isCorrect = ref(false)
const explanation = ref('')
const correctAnswer = ref('')

// --- FETCH QUESTIONS FROM DATABASE ---
onMounted(async () => {
  try {
    // Default to IELTS course
    const res = await fetch('/api/questions?courseSlug=ielts')
    if (!res.ok) throw new Error('Failed to load questions from server')
    const data = await res.json()
    
    if (data.length === 0) {
      throw new Error('No questions found in the database. Please run seed.js to populate data.')
    }
    
    questions.value = data
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    isLoading.value = false
  }
})

// --- HANDLE ANSWER SELECTION ---
const handleSelect = async (optionKey) => {
  if (isAnswered.value || isSubmitting.value) return
  
  selectedOption.value = optionKey
  isSubmitting.value = true

  try {
    // Send to server for grading (No answer key leaked to client)
    const res = await fetch('/api/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: questions.value[currentIndex.value].id,
        selectedAnswer: optionKey
      })
    })

    const result = await res.json()
    
    if (res.ok) {
      isCorrect.value = result.isCorrect
      explanation.value = result.explanation
      correctAnswer.value = result.correctAnswer || ''
      
      if (isCorrect.value) {
        xp.value += 10
        streak.value += 1
      } else {
        streak.value = 0
      }
    } else {
      alert('Grading error: ' + result.error)
    }
  } catch (err) {
    alert('Could not connect to server')
  } finally {
    isSubmitting.value = false
    isAnswered.value = true
  }
}

// --- NEXT QUESTION ---
const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    selectedOption.value = null
    isAnswered.value = false
    isCorrect.value = false
    explanation.value = ''
    correctAnswer.value = ''
  } else {
    alert(`Congratulations! You completed the lesson with ${xp.value} XP.`)
    router.push('/profile')
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#171a23] text-[#e8eaf2] font-sans p-6 md:p-10 flex justify-center">
    
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64">
      <div class="w-12 h-12 border-4 border-[#3ddc97] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-[#3ddc97] text-lg font-bold">Loading question...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage" class="max-w-md w-full bg-red-900/30 border border-red-500/50 p-8 rounded-2xl text-center mt-10">
      <p class="text-red-300 text-lg mb-6">{{ errorMessage }}</p>
      <button @click="router.push('/')" class="px-6 py-2 bg-red-600 rounded-full font-bold hover:bg-red-500 transition">
        Back to Home
      </button>
    </div>

    <!-- Main Game Interface -->
    <div v-else class="w-full max-w-3xl">
      
      <!-- Stats Bar -->
      <div class="flex justify-between items-center mb-8">
        <div class="flex gap-4">
          <div class="bg-[#1f2533] border border-[#2d3748] px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <span class="text-2xl">⭐</span>
            <div>
              <p class="text-xs text-gray-400 uppercase tracking-wider">XP</p>
              <p class="font-bold text-[#3ddc97] text-xl">{{ xp }}</p>
            </div>
          </div>
          <div class="bg-[#1f2533] border border-[#2d3748] px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <span class="text-2xl">🔥</span>
            <div>
              <p class="text-xs text-gray-400 uppercase tracking-wider">Streak</p>
              <p class="font-bold text-yellow-400 text-xl">{{ streak }}</p>
            </div>
          </div>
        </div>
        
        <div class="bg-[#1f2533] border border-[#2d3748] px-6 py-3 rounded-xl shadow-lg">
          <p class="text-sm font-bold text-gray-300">Question {{ currentIndex + 1 }} / {{ questions.length }}</p>
        </div>
      </div>

      <!-- Question Card -->
      <div class="bg-[#1f2533] border border-[#2d3748] p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
        
        <!-- Background Effect -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-[#3ddc97] opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>

        <h2 class="text-2xl md:text-3xl font-bold mb-10 leading-relaxed relative z-10">
          {{ questions[currentIndex].text }}
        </h2>

        <div class="space-y-4 relative z-10">
          <button 
            v-for="(option, key) in { A: questions[currentIndex].optionA, B: questions[currentIndex].optionB, C: questions[currentIndex].optionC, D: questions[currentIndex].optionD }" 
            :key="key"
            @click="handleSelect(key)"
            :class="[
              'w-full text-left px-6 py-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-5 font-semibold text-lg',
              !isAnswered ? 'border-[#2d3748] bg-[#171a23] hover:border-[#3ddc97] hover:bg-[#3ddc97]/5' : '',
              isAnswered && selectedOption === key && isCorrect ? 'border-[#3ddc97] bg-[#3ddc97]/10 text-[#3ddc97]' : '',
              isAnswered && selectedOption === key && !isCorrect ? 'border-red-500 bg-red-900/20 text-red-400' : '',
              isAnswered && selectedOption !== key ? 'border-[#2d3748] opacity-40' : ''
            ]"
            :disabled="isAnswered || isSubmitting"
          >
            <span class="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-current font-bold text-lg">
              {{ key }}
            </span>
            {{ option }}
          </button>
        </div>

        <!-- Feedback Result -->
        <div v-if="isAnswered" class="mt-8 p-6 rounded-2xl border relative z-10" :class="isCorrect ? 'bg-green-900/20 border-green-500/30 text-green-300' : 'bg-red-900/20 border-red-500/30 text-red-300'">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-2xl">{{ isCorrect ? '🎉' : '😢' }}</span>
            <strong class="text-xl">{{ isCorrect ? 'Correct! +10 XP' : 'Incorrect!' }}</strong>
          </div>
          <p v-if="!isCorrect" class="mb-2">The correct answer is: <strong>{{ correctAnswer }}</strong></p>
          <p class="text-sm opacity-80 leading-relaxed">{{ explanation }}</p>
        </div>

        <!-- Next Button -->
        <div v-if="isAnswered" class="mt-8 flex justify-end relative z-10">
          <button 
            @click="nextQuestion" 
            class="px-10 py-4 bg-[#3ddc97] text-[#0b2e22] font-extrabold text-lg rounded-full hover:brightness-110 transition shadow-[0_4px_0_#0f9e5a] active:translate-y-1 active:shadow-none"
          >
            {{ currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish' }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>