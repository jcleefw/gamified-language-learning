<script setup lang="ts">
import { ref, watch } from 'vue';
import type {
  QuizQuestion,
  MCQQuestion,
  SentenceQuestion,
  SentenceTile,
  QuizResult,
  QuizItem,
} from '@gll/srs-engine/learn';
import PoolDebugPanel from './PoolDebugPanel.vue';
import AudioPlayer from './AudioPlayer.vue';
import { env } from '../env';
import type { DeckAudio } from '../composables/useAudio';

const props = defineProps<{
  question: QuizQuestion;
  index: number;
  total: number;
  activeItems: QuizItem[];
  queue: QuizItem[];
  masteredDeck: QuizItem[];
  shelvedItems?: QuizItem[];
  // When true, an MCQ holds on a right/wrong reveal and advances only on an
  // explicit Next (mirrors the sentence path). Default false keeps Learning's
  // emit-on-click behaviour byte-identical. Review passes true.
  feedbackDwell?: boolean;
  // Audio for word-block sentence segment, only populated when deck has audio + VTT.
  // MCQ questions always receive undefined. App.vue does the lookup to keep the engine audio-free.
  // The segment is played by cue id from the served VTT track.
  audio?: DeckAudio & { sentenceId: string };
}>();
const emit = defineEmits<{ answered: [result: QuizResult]; exit: [] }>();

const cheatMode = env.cheatMode;

const sentenceAudioPlayer = ref<InstanceType<typeof AudioPlayer> | null>(null);

function playSentenceAudio() {
  console.log('[AUDIO] click: playSentenceAudio', {
    hasAudio: !!props.audio,
    hasPlayer: !!sentenceAudioPlayer.value,
    sentenceId: props.audio?.sentenceId,
    audioUrl: props.audio?.audioUrl,
    vttUrl: props.audio?.vttUrl,
  });
  if (!props.audio || !sentenceAudioPlayer.value) return;
  sentenceAudioPlayer.value.playCue(props.audio.sentenceId);
}

const answered = ref(false);
const selectedLabel = ref<string | null>(null);
// Chosen MCQ correctness, held for the reveal + deferred emit (feedbackDwell only).
const mcqCorrect = ref<boolean | null>(null);

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
  mcqCorrect.value = choice.isCorrect;
  // Dwell mode holds on the reveal; the emit is deferred to confirmMCQ (Next).
  if (!props.feedbackDwell) {
    emit('answered', {
      wordId: props.question.wordId,
      correct: choice.isCorrect,
    });
  }
}

function confirmMCQ() {
  if (
    !answered.value ||
    props.question.kind !== 'mcq' ||
    mcqCorrect.value === null
  )
    return;
  emit('answered', {
    wordId: (props.question as MCQQuestion).wordId,
    correct: mcqCorrect.value,
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
  sentenceCorrect.value =
    JSON.stringify(userOrder) ===
    JSON.stringify((props.question as SentenceQuestion).answer);
  answered.value = true;
}

function confirmSentence() {
  if (
    !answered.value ||
    props.question.kind !== 'word-block' ||
    sentenceCorrect.value === null
  )
    return;
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
    mcqCorrect.value = null;
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
  <div
    class="quiz-card"
    :data-question-word-id="question.kind === 'mcq' ? question.wordId : ''"
  >
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

      <!-- Feedback moment (review only): hold on the reveal, advance on Next. The
           correct choice is already highlighted green and the wrong pick red above. -->
      <template v-if="feedbackDwell && answered && mcqCorrect !== null">
        <div
          class="sentence-feedback"
          :class="{ correct: mcqCorrect, wrong: !mcqCorrect }"
        >
          {{ mcqCorrect ? '✓ Correct!' : '✗ Incorrect' }}
        </div>
        <button class="btn-submit" @click="confirmMCQ">Next</button>
      </template>
    </template>

    <!-- Word-block (sentence) -->
    <template v-else-if="question.kind === 'word-block'">
      <p v-if="cheatMode" class="cheat-hint">
        ✓
        {{
          (question as SentenceQuestion).answer
            .map(
              (wordId: string) =>
                (question as SentenceQuestion).tiles.find(
                  (t) => t.wordId === wordId,
                )?.[
                  question.direction === 'native-to-romanization'
                    ? 'romanization'
                    : 'native'
                ],
            )
            .join(' → ')
        }}
      </p>

      <!-- EP43-DS01 ST03: word-block segment playback. Present only when
           App.vue resolved audio for this sentence (silent degrade — ADR §6). -->
      <div v-if="audio" class="sentence-audio">
        <AudioPlayer ref="sentenceAudioPlayer" :src="audio.audioUrl" :vtt-url="audio.vttUrl" />
        <button class="btn-play-sentence" type="button" @click="playSentenceAudio">
          ▶ Play sentence
        </button>
      </div>

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
          {{
            question.direction === 'native-to-romanization'
              ? tile.romanization
              : tile.native
          }}
        </span>
      </div>

      <!-- Tile bank -->
      <div class="tile-bank" @dragover.prevent @drop="onBankDrop">
        <span
          v-for="tile in remainingTiles"
          :key="tile.wordId"
          class="tile-chip"
          :data-word-id="tile.wordId"
          draggable="true"
          @click="!answered && addTile(tile)"
          @dragstart="onBankDragStart(tile)"
        >
          {{
            question.direction === 'native-to-romanization'
              ? tile.romanization
              : tile.native
          }}
        </span>
        <span
          v-if="remainingTiles.length === 0 && !answered"
          class="bank-empty"
        >
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
        <div
          class="sentence-feedback"
          :class="{ correct: sentenceCorrect, wrong: !sentenceCorrect }"
        >
          {{ sentenceCorrect ? '✓ Correct!' : '✗ Incorrect' }}
        </div>
        <div v-if="!sentenceCorrect" class="correct-answer">
          <span class="correct-answer-label">Correct answer:</span>
          <span
            v-for="wordId in question.answer"
            :key="wordId"
            class="tile-chip tile-chip--correct"
          >
            {{
              question.direction === 'native-to-romanization'
                ? question.tiles.find((t) => t.wordId === wordId)?.romanization
                : question.tiles.find((t) => t.wordId === wordId)?.native
            }}
          </span>
        </div>
        <button class="btn-submit" @click="confirmSentence">Next</button>
      </template>
    </template>

    <!-- Pool debug panel (cheat mode only) -->
    <PoolDebugPanel
      v-if="cheatMode"
      :active-items="activeItems"
      :queue="queue"
      :mastered-deck="masteredDeck"
      :shelved-items="shelvedItems"
    />
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
  transition:
    border-color 0.15s,
    background 0.15s;
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
  transition:
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
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
.sentence-audio {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.btn-play-sentence {
  padding: 8px 12px;
  border: 1px solid #2563eb;
  border-radius: 6px;
  background: white;
  color: #2563eb;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.btn-play-sentence:hover {
  background: #eff6ff;
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
