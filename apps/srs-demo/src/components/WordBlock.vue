<script setup lang="ts">
import { ref } from 'vue';
import type { SentenceQuestion, QuizResult } from '@gll/srs-engine-v2';

const props = defineProps<{
  question: SentenceQuestion;
  index: number;
  total: number;
}>();
const emit = defineEmits<{ answered: [result: QuizResult] }>();

const selected = ref<string[]>([]);
const submitted = ref(false);
const wasCorrect = ref(false);

function selectTile(wordId: string) {
  if (submitted.value) return;
  if (selected.value.includes(wordId)) {
    selected.value = selected.value.filter((id) => id !== wordId);
  } else {
    selected.value = [...selected.value, wordId];
  }
}

function submit() {
  if (submitted.value || selected.value.length !== props.question.answer.length) return;
  submitted.value = true;
  wasCorrect.value = JSON.stringify(selected.value) === JSON.stringify(props.question.answer);
  emit('answered', { sentenceId: props.question.sentenceId, correct: wasCorrect.value });
}

function tileState(wordId: string): 'default' | 'selected' | 'correct' | 'wrong' {
  if (!submitted.value) return selected.value.includes(wordId) ? 'selected' : 'default';
  if (wasCorrect.value) return selected.value.includes(wordId) ? 'correct' : 'default';
  return selected.value.includes(wordId) ? 'wrong' : 'default';
}
</script>

<template>
  <div class="word-block">
    <p class="prompt">{{ question.prompt }}</p>
    <p class="instruction">Tap tiles in order</p>

    <div class="answer-row">
      <span
        v-for="(wordId, i) in selected"
        :key="wordId + i"
        class="answer-slot"
      >
        {{ question.tiles.find((t) => t.wordId === wordId)?.native }}
      </span>
      <span v-if="selected.length === 0" class="answer-placeholder">—</span>
    </div>

    <div class="tiles">
      <button
        v-for="tile in question.tiles"
        :key="tile.wordId"
        class="tile-btn"
        :class="tileState(tile.wordId)"
        :disabled="submitted"
        @click="selectTile(tile.wordId)"
      >
        <span class="tile-native">{{ tile.native }}</span>
        <span class="tile-roman">{{ tile.romanization }}</span>
      </button>
    </div>

    <div v-if="submitted" class="feedback" :class="wasCorrect ? 'correct' : 'wrong'">
      {{ wasCorrect ? 'Correct!' : `Wrong — correct: ${question.answer.map((id) => question.tiles.find((t) => t.wordId === id)?.native).join(' ')}` }}
    </div>

    <button
      v-if="!submitted"
      class="submit-btn"
      :disabled="selected.length !== question.answer.length"
      @click="submit"
    >
      Check
    </button>
  </div>
</template>

<style scoped>
.word-block {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.prompt {
  font-size: 1.1rem;
  color: #374151;
  margin: 0 0 4px;
}
.instruction {
  font-size: 0.8rem;
  color: #9ca3af;
  margin: 0 0 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.answer-row {
  min-height: 44px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  margin-bottom: 20px;
}
.answer-slot {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 1rem;
  color: #1d4ed8;
}
.answer-placeholder {
  color: #d1d5db;
  font-size: 1rem;
}
.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.tile-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.tile-btn:not(:disabled):hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.tile-btn.selected {
  border-color: #2563eb;
  background: #eff6ff;
}
.tile-btn.correct {
  border-color: #16a34a;
  background: #f0fdf4;
}
.tile-btn.wrong {
  border-color: #dc2626;
  background: #fef2f2;
}
.tile-btn:disabled {
  cursor: default;
}
.tile-native {
  font-size: 1.1rem;
  font-weight: 500;
  color: #111827;
}
.tile-roman {
  font-size: 0.72rem;
  color: #6b7280;
  margin-top: 2px;
}
.feedback {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 16px;
}
.feedback.correct {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #86efac;
}
.feedback.wrong {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}
.submit-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.submit-btn:disabled {
  background: #93c5fd;
  cursor: default;
}
</style>
