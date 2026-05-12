<script setup lang="ts">
import { ref } from 'vue'
import type { QuizQuestion, QuizResult } from '@gll/srs-engine-v2'

const props = defineProps<{ question: QuizQuestion; index: number; total: number }>()
const emit = defineEmits<{ answered: [result: QuizResult] }>()

const cheatMode = import.meta.env.VITE_CHEAT_MODE === 'true'

const answered = ref(false)
const selectedLabel = ref<string | null>(null)

function answer(choice: QuizQuestion['choices'][number]) {
  if (answered.value) return
  answered.value = true
  selectedLabel.value = choice.label
  emit('answered', { wordId: props.question.wordId, correct: choice.isCorrect })
}

// Reset local state when question prop changes
import { watch } from 'vue'
watch(() => props.question, () => {
  answered.value = false
  selectedLabel.value = null
})
</script>

<template>
  <div class="quiz-card">
    <div class="progress">{{ index + 1 }} / {{ total }}</div>
    <p class="direction">{{ question.direction.replace(/-/g, ' → ') }}</p>
    <h2 class="prompt">{{ question.prompt }}</h2>

    <p v-if="cheatMode" class="cheat-hint">
      ✓ {{ question.choices.find(c => c.isCorrect)?.label }} — {{ question.choices.find(c => c.isCorrect)?.value }}
    </p>

    <ul class="choices">
      <li v-for="choice in question.choices" :key="choice.label">
        <button
          class="choice-btn"
          :class="{
            correct: answered && choice.isCorrect,
            wrong: answered && selectedLabel === choice.label && !choice.isCorrect,
            disabled: answered,
          }"
          :disabled="answered"
          @click="answer(choice)"
        >
          <span class="label">{{ choice.label }}</span>
          <span class="value">{{ choice.value }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.quiz-card {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.progress { color: #6b7280; font-size: 0.85rem; margin-bottom: 4px; }
.direction { color: #9ca3af; font-size: 0.8rem; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
.prompt {
  font-size: 2rem;
  margin: 0 0 32px;
  word-break: break-word;
}
.choices { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.choice-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 1rem;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
.choice-btn:not(.disabled):hover { border-color: #2563eb; background: #f0f7ff; }
.choice-btn.correct { border-color: #16a34a; background: #f0fdf4; color: #15803d; }
.choice-btn.wrong { border-color: #dc2626; background: #fef2f2; color: #b91c1c; }
.choice-btn.disabled { cursor: default; }
.label {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #e5e7eb;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
}
.value { flex: 1; }
.cheat-hint {
  margin: -20px 0 20px;
  font-size: 0.8rem;
  color: #b45309;
  background: #fffbeb;
  border: 1px dashed #fcd34d;
  border-radius: 6px;
  padding: 6px 12px;
}
</style>
