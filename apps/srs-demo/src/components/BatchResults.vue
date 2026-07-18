<script setup lang="ts">
import { ref, computed } from 'vue';
import type { WordState, QuizItem } from '@gll/srs-engine-v2/learn';
import PoolDebugPanel from './PoolDebugPanel.vue';

export interface BatchSummary {
  wordId: string;
  native: string;
  state: WordState;
  newlyMastered: boolean;
}

const props = defineProps<{
  summary: BatchSummary[];
  batchScore: { correct: number; total: number };
  activeItems: QuizItem[];
  queue: QuizItem[];
  masteredDeck: QuizItem[];
  masteredGlobal: QuizItem[];
  maxMastery: number;
  nextDeckId: string | null;
  shelvedItems?: QuizItem[];
}>();

const showPool = ref(false);

const deckComplete = computed(
  () => props.activeItems.length === 0 && props.queue.length === 0,
);

const emit = defineEmits<{
  next: [];
  selectDeck: [];
  nextDeck: [deckId: string];
}>();
</script>

<template>
  <div class="batch-results">
    <h2 class="score">
      {{ batchScore.correct }} / {{ batchScore.total }} correct
    </h2>

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
        <tr
          v-for="row in summary"
          :key="row.wordId"
          :class="{ 'mastered-row': row.newlyMastered }"
        >
          <td class="word-id">
            {{ row.native }}
            <span v-if="row.newlyMastered" class="mastered-badge"
              >Mastered ★</span
            >
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
        <button class="btn-secondary" @click="emit('selectDeck')">
          Back to decks
        </button>
        <button
          v-if="nextDeckId"
          class="btn-primary"
          @click="emit('nextDeck', nextDeckId)"
        >
          Next deck →
        </button>
      </div>
    </div>
    <div v-else class="batch-actions">
      <button class="btn-secondary" @click="emit('selectDeck')">
        Back to decks
      </button>
      <button class="btn-next" @click="emit('next')">Next Batch →</button>
    </div>

    <PoolDebugPanel
      :active-items="activeItems"
      :queue="queue"
      :mastered-deck="masteredDeck"
      :mastered-global="masteredGlobal"
      :shelved-items="shelvedItems"
    />
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
th,
td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
th {
  color: #6b7280;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
}
.word-id {
  font-weight: 500;
}
.mastery-dots {
  display: inline-flex;
  gap: 3px;
  vertical-align: middle;
  margin-right: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  display: inline-block;
}
.dot.filled {
  background: #16a34a;
}
.mastered-row {
  background: #f0fdf4;
}
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
.deck-complete-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-primary {
  background: #2563eb;
  color: white;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}
.btn-secondary:hover {
  background: #d1d5db;
}
.batch-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
}
.btn-next {
  padding: 12px 28px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.btn-next:hover {
  background: #1d4ed8;
}
</style>
