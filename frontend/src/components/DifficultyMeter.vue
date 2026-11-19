<script setup>
// Visual representation of adaptive difficulty level
defineProps({ level: { type: Number, required: true } })
</script>

<template>
  <div class="meter" role="img" :aria-label="`Difficulty level ${level} of 5`">
    <span v-for="n in 5" :key="n" class="notch" :class="{ on: n <= level }" :style="{ height: 6 + n * 4 + 'px' }" />
    <span class="meter-label">Difficulty {{ level }}/5</span>
  </div>
</template>
