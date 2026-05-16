<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WordState, QuizItem } from '@gll/srs-engine-v2'

export interface BatchSummary {
  wordId: string
  state: WordState
  newlyMastered: boolean
}

const props = defineProps<{
  summary: BatchSummary[]
  batchScore: { correct: number; total: number }
  activeItems: QuizItem[]
  queue: QuizItem[]
  masteredDeck: QuizItem[]
  masteredGlobal: QuizItem[]
  maxMastery: number
  nextDeckId: string | null
}>()

const showPool = ref(false)

const deckComplete = computed(() => props.activeItems.length === 0 && props.queue.length === 0)

const emit = defineEmits<{ next: []; selectDeck: []; nextDeck: [deckId: string] }>()
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
        <tr v-for="row in summary" :key="row.wordId" :class="{ 'mastered-row': row.newlyMastered }">
          <td class="word-id">
            {{ row.wordId.replace('th::', '') }}
            <span v-if="row.newlyMastered" class="mastered-badge">Mastered ★</span>
          </td>
          <td>{{ row.state.seen }}</td>
          <td>{{ row.state.correct }}</td>
          <td>
            <span class="mastery-dots">
              <span
                v-for="i in maxMastery"
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

    <div v-if="deckComplete" class="deck-complete">
      <p class="deck-complete-msg">All words mastered! 🎉</p>
      <div class="deck-complete-actions">
        <button class="btn-secondary" @click="emit('selectDeck')">Back to decks</button>
        <button v-if="nextDeckId" class="btn-primary" @click="emit('nextDeck', nextDeckId)">Next deck →</button>
      </div>
    </div>
    <div v-else class="batch-actions">
      <button class="btn-secondary" @click="emit('selectDeck')">Back to decks</button>
      <button class="btn-next" @click="emit('next')">Next Batch →</button>
    </div>

    <details class="pool-debug" :open="showPool" @toggle="showPool = ($event.target as HTMLDetailsElement).open">
      <summary class="pool-debug-toggle">Pool state</summary>
      <div class="pool-section">
        <p class="pool-label">Active ({{ activeItems.length }})</p>
        <ul>
          <li v-for="item in activeItems" :key="item.id" class="pool-item">
            <span class="pool-native">{{ item.native }}</span>
            <span class="pool-id">{{ item.id }}</span>
          </li>
          <li v-if="activeItems.length === 0" class="pool-empty">—</li>
        </ul>
      </div>
      <div class="pool-section">
        <p class="pool-label">Queue ({{ queue.length }})</p>
        <ul>
          <li v-for="item in queue" :key="item.id" class="pool-item">
            <span class="pool-native">{{ item.native }}</span>
            <span class="pool-id">{{ item.id }}</span>
          </li>
          <li v-if="queue.length === 0" class="pool-empty">empty</li>
        </ul>
      </div>
      <div class="pool-section">
        <p class="pool-label">Mastered — this deck ({{ masteredDeck.length }})</p>
        <ul>
          <li v-for="item in masteredDeck" :key="item.id" class="pool-item">
            <span class="pool-native">{{ item.native }}</span>
            <span class="pool-id">{{ item.id }}</span>
          </li>
          <li v-if="masteredDeck.length === 0" class="pool-empty">none yet</li>
        </ul>
      </div>
      <div class="pool-section">
        <p class="pool-label">Mastered — all decks ({{ masteredGlobal.length }})</p>
        <ul>
          <li v-for="item in masteredGlobal" :key="item.id" class="pool-item">
            <span class="pool-native">{{ item.native }}</span>
            <span class="pool-id">{{ item.id }}</span>
          </li>
          <li v-if="masteredGlobal.length === 0" class="pool-empty">none yet</li>
        </ul>
      </div>
    </details>
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
.mastered-row { background: #f0fdf4; }
.mastered-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: #16a34a;
  color: white;
  border-radius: 99px;
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}
.deck-complete {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 28px;
  text-align: center;
}
.deck-complete-msg {
  font-size: 1.2rem;
  font-weight: 600;
  color: #15803d;
  margin: 0 0 16px;
}
.deck-complete-actions { display: flex; gap: 10px; justify-content: center; }
.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-primary { background: #2563eb; color: white; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover { background: #d1d5db; }
.batch-actions { display: flex; gap: 10px; margin-bottom: 28px; }
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
.pool-debug {
  margin-top: 32px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 0.82rem;
  color: #6b7280;
}
.pool-debug-toggle {
  padding: 10px 0;
  cursor: pointer;
  font-weight: 600;
  list-style: none;
  user-select: none;
}
.pool-debug-toggle::before { content: '▶ '; font-size: 0.65rem; }
details[open] .pool-debug-toggle::before { content: '▼ '; }
.pool-section { padding: 8px 0 12px; border-top: 1px solid #f3f4f6; }
.pool-label { margin: 0 0 6px; font-weight: 600; color: #374151; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
.pool-item { display: flex; justify-content: space-between; }
.pool-native { font-weight: 500; color: #111827; }
.pool-id { color: #9ca3af; font-size: 0.75rem; }
.pool-empty { color: #9ca3af; font-style: italic; }
</style>
