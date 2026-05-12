<script setup lang="ts">
import type { WordState } from '@gll/srs-engine-v2'

export interface BatchSummary {
  wordId: string
  state: WordState
}

defineProps<{
  summary: BatchSummary[]
  batchScore: { correct: number; total: number }
}>()

const emit = defineEmits<{ next: [] }>()
</script>

<template>
  <div class="batch-results">
    <h2 class="score">{{ batchScore.correct }} / {{ batchScore.total }} correct</h2>

    <table>
      <thead>
        <tr>
          <th>Word</th>
          <th>Seen</th>
          <th>Correct</th>
          <th>Mastery</th>
          <th>Streak ✓/✗</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in summary" :key="row.wordId">
          <td class="word-id">{{ row.wordId.replace('th::', '') }}</td>
          <td>{{ row.state.seen }}</td>
          <td>{{ row.state.correct }}</td>
          <td>
            <span class="mastery-dots">
              <span
                v-for="i in 5"
                :key="i"
                class="dot"
                :class="{ filled: i <= row.state.mastery }"
              />
            </span>
            {{ row.state.mastery }}
          </td>
          <td>{{ row.state.correctStreak }} / {{ row.state.wrongStreak }}</td>
        </tr>
      </tbody>
    </table>

    <button class="btn-next" @click="emit('next')">Next Batch →</button>
  </div>
</template>

<style scoped>
.batch-results {
  max-width: 560px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.score {
  font-size: 1.6rem;
  margin-bottom: 24px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-bottom: 28px;
}
th, td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
th { color: #6b7280; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
.word-id { font-weight: 500; }
.mastery-dots { display: inline-flex; gap: 3px; vertical-align: middle; margin-right: 4px; }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  display: inline-block;
}
.dot.filled { background: #16a34a; }
.btn-next {
  padding: 12px 28px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.btn-next:hover { background: #1d4ed8; }
</style>
