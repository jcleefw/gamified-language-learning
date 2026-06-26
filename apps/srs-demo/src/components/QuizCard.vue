<script setup lang="ts">
import { ref, watch } from 'vue';
import type {
  QuizQuestion,
  MCQQuestion,
  SentenceQuestion,
  SentenceTile,
  QuizResult,
  QuizItem,
} from '@gll/srs-engine-v2';

const props = defineProps<{
  question: QuizQuestion;
  index: number;
  total: number;
  activeItems: QuizItem[];
  queue: QuizItem[];
  masteredDeck: QuizItem[];
}>();
const emit = defineEmits<{ answered: [result: QuizResult]; exit: [] }>();

const cheatMode = import.meta.env.VITE_CHEAT_MODE === 'true';

const answered = ref(false);
const selectedLabel = ref<string | null>(null);

// Word-block (sentence) state
const selectedTiles = ref<SentenceTile[]>([]);
const remainingTiles = ref<SentenceTile[]>([]);
const sentenceCorrect = ref<boolean | null>(null);

// Drag state
let draggedTile: SentenceTile | null = null;
let dragSource: 'bank' | 'answer' | null = null;
let dragFromIndex = -1;

function answerMCQ(choice: MCQQuestion['choices'][number]) {
  if (answered.value || props.question.kind !== 'mcq') return;
  answered.value = true;
  selectedLabel.value = choice.label;
  emit('answered', {
    wordId: props.question.wordId,
    correct: choice.isCorrect,
  });
}

function addTile(tile: SentenceTile, index?: number) {
  remainingTiles.value = remainingTiles.value.filter((t) => t !== tile);
  if (index !== undefined) {
    selectedTiles.value.splice(index, 0, tile);
  } else {
    selectedTiles.value.push(tile);
  }
}

function removeTile(tile: SentenceTile) {
  selectedTiles.value = selectedTiles.value.filter((t) => t !== tile);
  remainingTiles.value.push(tile);
}

function reorderAnswerTile(fromIndex: number, toIndex: number) {
  const tiles = [...selectedTiles.value];
  const [moved] = tiles.splice(fromIndex, 1);
  tiles.splice(toIndex, 0, moved);
  selectedTiles.value = tiles;
}

function submitSentence() {
  if (answered.value || props.question.kind !== 'word-block') return;
  if (remainingTiles.value.length > 0) return;
  const userOrder = selectedTiles.value.map((t) => t.wordId);
  sentenceCorrect.value = JSON.stringify(userOrder) === JSON.stringify((props.question as SentenceQuestion).answer);
  answered.value = true;
}

function confirmSentence() {
  if (!answered.value || props.question.kind !== 'word-block' || sentenceCorrect.value === null) return;
  emit('answered', {
    sentenceId: (props.question as SentenceQuestion).sentenceId,
    correct: sentenceCorrect.value,
  });
}

// Drag handlers — bank tiles
function onBankDragStart(tile: SentenceTile) {
  draggedTile = tile;
  dragSource = 'bank';
  dragFromIndex = -1;
}

function onAnswerDragStart(tile: SentenceTile, index: number) {
  draggedTile = tile;
  dragSource = 'answer';
  dragFromIndex = index;
}

function onAnswerDrop(event: DragEvent, toIndex: number) {
  event.preventDefault();
  if (!draggedTile) return;
  if (dragSource === 'bank') {
    addTile(draggedTile, toIndex);
  } else if (dragSource === 'answer' && dragFromIndex !== -1) {
    reorderAnswerTile(dragFromIndex, toIndex);
  }
  draggedTile = null;
  dragSource = null;
  dragFromIndex = -1;
}

function onAnswerAreaDrop(event: DragEvent) {
  event.preventDefault();
  if (!draggedTile) return;
  if (dragSource === 'bank') {
    addTile(draggedTile);
  }
  draggedTile = null;
  dragSource = null;
  dragFromIndex = -1;
}

function onBankDrop(event: DragEvent) {
  event.preventDefault();
  if (!draggedTile || dragSource !== 'answer') return;
  removeTile(draggedTile);
  draggedTile = null;
  dragSource = null;
  dragFromIndex = -1;
}

// Reset local state when question prop changes
watch(
  () => props.question,
  (q) => {
    answered.value = false;
    selectedLabel.value = null;
    sentenceCorrect.value = null;
    if (q.kind === 'word-block') {
      selectedTiles.value = [];
      remainingTiles.value = [...q.tiles];
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="quiz-card" :data-question-word-id="question.kind === 'mcq' ? question.wordId : ''">
    <div class="quiz-header">
      <div class="progress">{{ index + 1 }} / {{ total }}</div>
      <button class="btn-exit" @click="emit('exit')">Exit</button>
    </div>
    <p class="direction">{{ question.direction.replace(/-/g, ' → ') }}</p>
    <h2 class="prompt">{{ question.prompt }}</h2>

    <!-- MCQ -->
    <template v-if="question.kind === 'mcq'">
      <p v-if="cheatMode" class="cheat-hint">
        ✓ {{ question.choices.find((c) => c.isCorrect)?.label }} —
        {{ question.choices.find((c) => c.isCorrect)?.value }}
      </p>

      <ul class="choices">
        <li v-for="choice in question.choices" :key="choice.label">
          <button
            class="choice-btn"
            :class="{
              correct: answered && choice.isCorrect,
              wrong:
                answered && selectedLabel === choice.label && !choice.isCorrect,
              disabled: answered,
            }"
            :disabled="answered"
            @click="answerMCQ(choice)"
          >
            <span class="label">{{ choice.label }}</span>
            <span class="value">{{ choice.value }}</span>
          </button>
        </li>
      </ul>
    </template>

    <!-- Word-block (sentence) -->
    <template v-else-if="question.kind === 'word-block'">
      <p v-if="cheatMode" class="cheat-hint">
        ✓ {{ question.answer.join(' → ') }}
      </p>

      <!-- Answer area -->
      <div
        class="answer-area"
        :class="{ 'drag-over': false }"
        @dragover.prevent
        @drop="onAnswerAreaDrop"
      >
        <span v-if="selectedTiles.length === 0" class="answer-placeholder">
          Tap or drag words here…
        </span>
        <span
          v-for="(tile, i) in selectedTiles"
          :key="tile.wordId"
          class="tile-chip tile-chip--selected"
          :data-word-id="tile.wordId"
          draggable="true"
          @click="!answered && removeTile(tile)"
          @dragstart="onAnswerDragStart(tile, i)"
          @dragover.prevent
          @drop="onAnswerDrop($event, i)"
        >
          {{ question.direction === 'native-to-romanization' ? tile.romanization : tile.native }}
        </span>
      </div>

      <!-- Tile bank -->
      <div
        class="tile-bank"
        @dragover.prevent
        @drop="onBankDrop"
      >
        <span
          v-for="tile in remainingTiles"
          :key="tile.wordId"
          class="tile-chip"
          :data-word-id="tile.wordId"
          draggable="true"
          @click="!answered && addTile(tile)"
          @dragstart="onBankDragStart(tile)"
        >
          {{ question.direction === 'native-to-romanization' ? tile.romanization : tile.native }}
        </span>
        <span v-if="remainingTiles.length === 0 && !answered" class="bank-empty">
          All tiles placed
        </span>
      </div>

      <button
        v-if="!answered"
        class="btn-submit"
        :disabled="remainingTiles.length > 0"
        @click="submitSentence"
      >
        Submit
      </button>

      <template v-if="answered && sentenceCorrect !== null">
        <div class="sentence-feedback" :class="{ correct: sentenceCorrect, wrong: !sentenceCorrect }">
          {{ sentenceCorrect ? '✓ Correct!' : '✗ Incorrect' }}
        </div>
        <div v-if="!sentenceCorrect" class="correct-answer">
          <span class="correct-answer-label">Correct answer:</span>
          <span
            v-for="wordId in question.answer"
            :key="wordId"
            class="tile-chip tile-chip--correct"
          >
            {{ question.direction === 'native-to-romanization'
              ? question.tiles.find(t => t.wordId === wordId)?.romanization
              : question.tiles.find(t => t.wordId === wordId)?.native }}
          </span>
        </div>
        <button class="btn-submit" @click="confirmSentence">Next</button>
      </template>
    </template>

    <!-- Pool debug panel (cheat mode only) -->
    <template v-if="cheatMode">
      <div class="pool-panel">
        <div class="pool-col">
          <p class="pool-label">Active ({{ activeItems.length }})</p>
          <ul>
            <li v-for="item in activeItems" :key="item.id" class="pool-item">
              <span class="pool-native">{{ item.native }}</span>
              <span class="pool-id">{{ item.id }}</span>
            </li>
            <li v-if="activeItems.length === 0" class="pool-empty">—</li>
          </ul>
        </div>
        <div class="pool-col">
          <p class="pool-label">Queue ({{ queue.length }})</p>
          <ul>
            <li v-for="item in queue" :key="item.id" class="pool-item">
              <span class="pool-native">{{ item.native }}</span>
              <span class="pool-id">{{ item.id }}</span>
            </li>
            <li v-if="queue.length === 0" class="pool-empty">empty</li>
          </ul>
        </div>
        <div class="pool-col">
          <p class="pool-label">Mastered ({{ masteredDeck.length }})</p>
          <ul>
            <li v-for="item in masteredDeck" :key="item.id" class="pool-item">
              <span class="pool-native">{{ item.native }}</span>
              <span class="pool-id">{{ item.id }}</span>
            </li>
            <li v-if="masteredDeck.length === 0" class="pool-empty">
              none yet
            </li>
          </ul>
        </div>
      </div>

      <!-- Test data carrier: hidden from UI; e2e reads .pool-id here to get full IDs including namespace prefix -->
      <div class="pool-debug" style="display:none">
        <div class="pool-section">
          <p class="pool-label">Mastered — this deck</p>
          <ul>
            <li v-for="item in masteredDeck" :key="item.id">
              <span class="pool-id">{{ item.id }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quiz-card {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.progress {
  color: #6b7280;
  font-size: 0.85rem;
}
.btn-exit {
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #6b7280;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-exit:hover {
  border-color: #9ca3af;
  color: #374151;
}
.direction {
  color: #9ca3af;
  font-size: 0.8rem;
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.prompt {
  font-size: 2rem;
  margin: 0 0 32px;
  word-break: break-word;
}
.choices {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
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
  transition:
    background 0.15s,
    border-color 0.15s;
}
.choice-btn:not(.disabled):hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.choice-btn.correct {
  border-color: #16a34a;
  background: #f0fdf4;
  color: #15803d;
}
.choice-btn.wrong {
  border-color: #dc2626;
  background: #fef2f2;
  color: #b91c1c;
}
.choice-btn.disabled {
  cursor: default;
}
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
.value {
  flex: 1;
}

/* Word-block (sentence) styles */
.answer-area {
  min-height: 52px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  background: #f9fafb;
  transition: border-color 0.15s, background 0.15s;
}
.answer-area.drag-over {
  border-color: #2563eb;
  background: #eff6ff;
}
.answer-placeholder {
  color: #9ca3af;
  font-size: 0.9rem;
  font-style: italic;
}
.tile-bank {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  min-height: 44px;
  padding: 8px 0;
}
.tile-chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.tile-chip:hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.tile-chip:active {
  box-shadow: 0 0 0 2px #bfdbfe;
}
.tile-chip[draggable='true']:active {
  opacity: 0.6;
}
.tile-chip--selected {
  background: #eff6ff;
  border-color: #93c5fd;
}
.tile-chip--selected:hover {
  border-color: #dc2626;
  background: #fef2f2;
}
.bank-empty {
  color: #9ca3af;
  font-size: 0.85rem;
  font-style: italic;
  align-self: center;
}
.btn-submit {
  width: 100%;
  padding: 14px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 12px;
}
.btn-submit:hover:not(:disabled) {
  background: #1d4ed8;
}
.btn-submit:disabled {
  background: #93c5fd;
  cursor: default;
}
.sentence-feedback {
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.sentence-feedback.correct {
  color: #15803d;
  background: #f0fdf4;
}
.sentence-feedback.wrong {
  color: #b91c1c;
  background: #fef2f2;
}
.correct-answer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.correct-answer-label {
  font-size: 0.85rem;
  color: #6b7280;
  flex-basis: 100%;
}
.tile-chip--correct {
  background: #f0fdf4;
  border-color: #86efac;
  cursor: default;
}
.tile-chip--correct:hover {
  border-color: #86efac;
  background: #f0fdf4;
}

/* Pool debug panel */
.pool-panel {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  padding: 12px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  font-size: 0.78rem;
  color: #6b7280;
}
.pool-col {
  flex: 1;
}
.pool-label {
  margin: 0 0 6px;
  font-weight: 600;
  color: #374151;
}
.pool-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pool-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.pool-native {
  font-weight: 500;
  color: #111827;
}
.pool-id {
  color: #9ca3af;
  font-size: 0.7rem;
}
.pool-empty {
  color: #9ca3af;
  font-style: italic;
}
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
