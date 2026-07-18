<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  assembleBatch,
  initBatchState,
  nextQuestion,
  submitBatchResult,
  finishBatch,
  isBatchDone,
  type RunState,
  type QuizItem,
  type QuizQuestion,
  type QuizResult,
  type BatchState,
  type WordQuizResult,
  type WordState,
} from '@gll/srs-engine/learn';
import type { AppDeckPayload, AppWordPayload } from '@gll/api-contract';
import {
  loadShelvedWords,
  unshelveWord,
  resetStagnationCountersForWords,
  updateStagnationCounters,
  getStagnantWords,
  getShelvingConfig,
  applyShelving,
} from '../composables/useShelving.js';
import { saveWordState } from '../composables/useStore.js';
import { evaluateShelving } from '@gll/srs-engine/shelving';
import QuizCard from './QuizCard.vue';
import AudioPlayer from './AudioPlayer.vue';

const props = defineProps<{
  deck: AppDeckPayload;
  runState: RunState;
  shelvedSet: Set<string>;
  maxMastery: number;
  wordPool: QuizItem[];
}>();

const emit = defineEmits<{
  back: [];
  startQuiz: [deckId: string];
  unshelveWord: [deckId: string, wordId: string];
  updateShelvedSet: [shelvedSet: Set<string>];
  updateWordStates: [wordStates: Map<string, WordState>];
}>();

// Index of highlighted sentence (from word click); null = none
const highlightedSentenceIndex = ref<number | null>(null);
const sentenceRefs = ref<HTMLElement[]>([]);

const audioPlayer = ref<InstanceType<typeof AudioPlayer> | null>(null);
const playingSentenceIndex = ref<number | null>(null);

function onSentenceClick(idx: number) {
  console.log('[AUDIO] click: onSentenceClick', {
    idx,
    sentenceId: props.deck.lines[idx]?.sentenceId,
    hasVttUrl: !!props.deck.vttUrl,
    hasPlayer: !!audioPlayer.value,
  });
  // Timing is the served VTT track: play the sentence's cue by id. No player
  // (no audioUrl) or no cue for the sentence ⟹ silent no-op (playback ADR §6).
  if (!props.deck.vttUrl || !audioPlayer.value) return;
  playingSentenceIndex.value = idx;
  audioPlayer.value.playCue(props.deck.lines[idx].sentenceId);
}

// Clear the "playing" affordance once the player pauses (segment end or manual
// pause) — a subtle, non-blocking indicator (ADR §4), not gating anything.
watch(
  () => audioPlayer.value?.playing,
  (isPlaying) => {
    if (!isPlaying) playingSentenceIndex.value = null;
  },
);

// Local shelved set — union of prop + freshly fetched for this deck
const localShelvedSet = ref<Set<string>>(new Set(props.shelvedSet));

// Sentence-by-sentence learning state
const sentenceLearningActive = ref(false);
const currentSentenceIndex = ref(0);
const miniQuizBatchState = ref<BatchState | null>(null);
const miniQuizCurrentQuestion = ref<QuizQuestion | null>(null);

onMounted(async () => {
  try {
    const words = await loadShelvedWords(props.deck.id);
    const ids = new Set(words.map((w) => w.wordId));
    localShelvedSet.value = ids;
  } catch {
    // Non-fatal: fall back to prop
  }
});

// Map: wordId → list of sentence indices it appears in
const sentenceWordMap = computed(() => {
  const map = new Map<string, number[]>();
  props.deck.lines.forEach((line, idx) => {
    for (const wordId of line.wordIds) {
      if (!map.has(wordId)) map.set(wordId, []);
      map.get(wordId)!.push(idx);
    }
  });
  return map;
});

// Map: wordId → AppWordPayload
const wordById = computed(() => {
  const map = new Map<string, AppWordPayload>();
  for (const w of props.deck.words) map.set(w.id, w);
  return map;
});

// Compute quiz-related state for QuizCard
const miniQuizIndex = computed(() => {
  if (!miniQuizBatchState.value) return 0;
  return miniQuizBatchState.value.results.length;
});

const miniQuizTotal = computed(() => {
  if (!miniQuizBatchState.value) return 0;
  return miniQuizBatchState.value.initialCount;
});

const miniQuizActiveItems = computed(() => {
  if (currentSentenceIndex.value >= props.deck.lines.length) return [];
  const line = props.deck.lines[currentSentenceIndex.value];
  return line.wordIds
    .map((id) => props.deck.words.find((w) => w.id === id))
    .filter(Boolean) as QuizItem[];
});

const miniQuizDistractorPool = computed(() => props.wordPool);

const miniQuizMasteredDeck = computed(() => {
  return props.deck.words.filter((w) => {
    const ws = props.runState.get(w.id);
    return ws && ws.mastery >= props.maxMastery;
  });
});

const miniQuizShelvedItems = computed(() => {
  return [...localShelvedSet.value]
    .map((id) => props.deck.words.find((w) => w.id === id))
    .filter(Boolean) as QuizItem[];
});

// Words appearing in each sentence line
function lineWords(wordIds: string[]): AppWordPayload[] {
  return wordIds
    .map((id) => wordById.value.get(id))
    .filter(Boolean) as AppWordPayload[];
}

function onWordClick(wordId: string) {
  const indices = sentenceWordMap.value.get(wordId);
  if (!indices || indices.length === 0) return;
  const targetIdx = indices[0];
  highlightedSentenceIndex.value = targetIdx;
  const el = sentenceRefs.value[targetIdx];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Clear highlight after 1.5s
  setTimeout(() => {
    highlightedSentenceIndex.value = null;
  }, 1500);
}

async function onTryNow(wordId: string) {
  // Optimistic: remove from local set immediately
  const next = new Set(localShelvedSet.value);
  next.delete(wordId);
  localShelvedSet.value = next;

  try {
    await Promise.all([
      unshelveWord({ deckId: props.deck.id, wordId }),
      resetStagnationCountersForWords({
        deckId: props.deck.id,
        wordIds: [wordId],
      }),
    ]);
    emit('unshelveWord', props.deck.id, wordId);
  } catch {
    // Restore on error
    const restored = new Set(localShelvedSet.value);
    restored.add(wordId);
    localShelvedSet.value = restored;
  }
}

function masteryDots(wordId: string): { filled: boolean }[] {
  const ws = props.runState.get(wordId);
  const mastery = ws?.mastery ?? 0;
  return Array.from({ length: props.maxMastery }, (_, i) => ({
    filled: i < mastery,
  }));
}

function startSentenceLearning() {
  sentenceLearningActive.value = true;
  currentSentenceIndex.value = 0;
  void loadAndStartSentenceQuiz();
}

async function loadAndStartNextSentenceQuiz() {
  currentSentenceIndex.value++;
  await loadAndStartSentenceQuiz();
}

async function loadAndStartSentenceQuiz() {
  if (currentSentenceIndex.value >= props.deck.lines.length) {
    finishSentenceLearning();
    return;
  }

  const currentLine = props.deck.lines[currentSentenceIndex.value];
  const sentenceWordIds = currentLine.wordIds;

  // If no words in sentence, skip it
  if (sentenceWordIds.length === 0) {
    await loadAndStartNextSentenceQuiz();
    return;
  }

  // Assemble batch for this sentence's words
  const batch = assembleBatch(
    sentenceWordIds
      .map((id) => {
        const word = props.deck.words.find((w) => w.id === id);
        return word as QuizItem;
      })
      .filter(Boolean),
    props.wordPool,
    [],
    Math.min(3, sentenceWordIds.length),
    { excludeIds: localShelvedSet.value },
  );

  // If batch is empty after excluding shelved words, skip sentence
  if (batch.length === 0) {
    await loadAndStartNextSentenceQuiz();
    return;
  }

  // Initialize batch state
  miniQuizBatchState.value = initBatchState(batch, 2, new Map(), 5);

  // Get first question
  const { question, state: nextState } = nextQuestion(miniQuizBatchState.value);
  miniQuizBatchState.value = nextState;
  miniQuizCurrentQuestion.value = question;
}

function onMiniQuizAnswered(result: QuizResult) {
  if (!miniQuizBatchState.value) return;

  miniQuizBatchState.value = submitBatchResult(
    miniQuizBatchState.value,
    result,
  );

  if (isBatchDone(miniQuizBatchState.value)) {
    void finishMiniQuizAndProcessResults();
  } else {
    const { question, state: nextState } = nextQuestion(
      miniQuizBatchState.value,
    );
    miniQuizBatchState.value = nextState;
    miniQuizCurrentQuestion.value = question;
  }
}

async function finishMiniQuizAndProcessResults() {
  if (!miniQuizBatchState.value) return;

  const output = finishBatch(miniQuizBatchState.value);

  // Collect updated word states from engine output
  const wordResults = output.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );
  const uniqueWordIds = [...new Set(wordResults.map((r) => r.wordId))];
  const updatedWordStates = new Map<string, WordState>();

  for (const wid of uniqueWordIds) {
    const ws = props.runState.get(wid);
    if (ws) {
      updatedWordStates.set(wid, ws);
      await saveWordState(ws).catch(console.error);
    }
  }

  // Apply shelving pipeline: stagnation update + evaluation + persistence
  if (uniqueWordIds.length > 0) {
    await updateStagnationCounters({
      deckId: props.deck.id,
      activeWordIds: uniqueWordIds,
    }).catch(console.error);

    const shelvingConfig = await getShelvingConfig();
    const stagnantIds = await getStagnantWords(
      props.deck.id,
      shelvingConfig.stagnationBatchWindow,
    ).catch(() => [] as string[]);

    const decision = evaluateShelving(
      stagnantIds,
      localShelvedSet.value,
      shelvingConfig,
    );
    if (decision.toShelve.length > 0) {
      const toShelvePayload = decision.toShelve.map((id: string) => ({
        wordId: id,
        batchNum: 0,
      }));
      console.log('[SENTENCE-LEARNING-SHELVING] Applying shelving:', {
        deckId: props.deck.id,
        toShelve: toShelvePayload,
      });
      try {
        await applyShelving({
          deckId: props.deck.id,
          toShelve: toShelvePayload,
        });
        console.log(
          '[SENTENCE-LEARNING-SHELVING] Successfully persisted to DB',
        );
      } catch (err) {
        console.error('[SENTENCE-LEARNING-SHELVING] Failed to persist:', err);
      }
      decision.toShelve.forEach((id: string) => localShelvedSet.value.add(id));
    }
  }

  // Emit updated word states so App.vue can sync globalRunState
  if (updatedWordStates.size > 0) {
    emit('updateWordStates', updatedWordStates);
  }

  // Advance to next sentence
  miniQuizBatchState.value = null;
  miniQuizCurrentQuestion.value = null;
  await loadAndStartNextSentenceQuiz();
}

function finishSentenceLearning() {
  sentenceLearningActive.value = false;
  currentSentenceIndex.value = 0;
  miniQuizBatchState.value = null;
  miniQuizCurrentQuestion.value = null;
  emit('updateShelvedSet', localShelvedSet.value);
}
</script>

<template>
  <div class="deck-overview">
    <div class="overview-header">
      <button class="btn-back" @click="emit('back')">← Back</button>
      <h2 class="overview-title">{{ deck.topic }}</h2>
    </div>

    <!-- Overview mode: show conversation + word table -->
    <template v-if="!sentenceLearningActive">
      <section class="overview-section">
        <h3 class="section-label">Conversation</h3>

        <AudioPlayer
          v-if="deck.audioUrl"
          ref="audioPlayer"
          :src="deck.audioUrl"
          :vtt-url="deck.vttUrl"
          class="conversation-player"
        />

        <div
          v-for="(line, idx) in deck.lines"
          :key="line.sentenceId"
          :ref="
            (el) => {
              if (el) sentenceRefs[idx] = el as HTMLElement;
            }
          "
          class="sentence-card"
          :class="{
            highlighted: highlightedSentenceIndex === idx,
            playable: !!deck.vttUrl,
            'playing-sentence':
              playingSentenceIndex === idx ||
              audioPlayer?.activeCueId === line.sentenceId,
          }"
          @click="onSentenceClick(idx)"
        >
          <div class="sentence-native">{{ line.native }}</div>
          <div class="sentence-english">{{ line.english }}</div>
          <div class="sentence-words">
            <span
              v-for="word in lineWords(line.wordIds)"
              :key="word.id"
              class="word-chip"
              @click.stop="onWordClick(word.id)"
              >{{ word.native }}</span
            >
          </div>
        </div>
      </section>

      <section class="overview-section">
        <h3 class="section-label">Words in this deck</h3>
        <div class="word-table">
          <div class="table-header">
            <div class="th">Word</div>
            <div class="th">English</div>
            <div class="th">Mastery</div>
            <div class="th">Status</div>
          </div>
          <div
            v-for="word in deck.words"
            :key="word.id"
            class="word-row"
            :class="{ 'row-shelved': localShelvedSet.has(word.id) }"
          >
            <div class="cell word-native" @click="onWordClick(word.id)">
              {{ word.native }}
            </div>
            <div class="cell">{{ word.english }}</div>
            <div class="cell">
              <span class="mastery-dots">
                <span
                  v-for="(dot, i) in masteryDots(word.id)"
                  :key="i"
                  class="dot"
                  :class="{ filled: dot.filled }"
                />
              </span>
            </div>
            <div class="cell status-cell">
              <template v-if="localShelvedSet.has(word.id)">
                <span class="status-shelved">Shelved</span>
                <button class="btn-try-now" @click="onTryNow(word.id)">
                  Try now
                </button>
              </template>
              <span v-else class="status-active">Active</span>
            </div>
          </div>
        </div>
      </section>

      <div class="overview-actions">
        <button class="btn-sentence-learn" @click="startSentenceLearning">
          Learn sentence by sentence
        </button>
        <button class="btn-primary" @click="emit('startQuiz', deck.id)">
          Start full quiz →
        </button>
      </div>
    </template>

    <!-- Sentence learning mode: show sentence mini-quiz -->
    <template v-else>
      <div class="sentence-learning-container">
        <div class="sentence-learning-header">
          <span class="sentence-progress"
            >{{ currentSentenceIndex + 1 }} / {{ deck.lines.length }}</span
          >
        </div>

        <section v-if="miniQuizCurrentQuestion" class="sentence-quiz-section">
          <div class="current-sentence-display">
            <div class="sentence-native">
              {{ deck.lines[currentSentenceIndex].native }}
            </div>
            <div class="sentence-english">
              {{ deck.lines[currentSentenceIndex].english }}
            </div>
          </div>

          <div class="mini-quiz-harness">
            <QuizCard
              :question="miniQuizCurrentQuestion"
              :index="miniQuizIndex"
              :total="miniQuizTotal"
              :active-items="miniQuizActiveItems"
              :queue="miniQuizDistractorPool"
              :mastered-deck="miniQuizMasteredDeck"
              :shelved-items="miniQuizShelvedItems"
              @answered="onMiniQuizAnswered"
            />
          </div>
        </section>

        <div v-else class="sentence-loading">Loading next sentence...</div>

        <div class="sentence-actions">
          <button class="btn-back-overview" @click="finishSentenceLearning">
            ← Back to overview
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.deck-overview {
  max-width: 560px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.overview-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.btn-back {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #e5e7eb;
  color: #374151;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}
.btn-back:hover {
  background: #d1d5db;
}
.overview-title {
  font-size: 1.3rem;
  margin: 0;
}
.overview-section {
  margin-bottom: 28px;
}
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
  margin: 0 0 12px;
}
.sentence-card {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition:
    background 0.2s,
    border-color 0.2s;
}
.sentence-card.highlighted {
  border-color: #2563eb;
  background: #f0f7ff;
}
.sentence-card.playable {
  cursor: pointer;
}
.sentence-card.playing-sentence {
  border-color: #16a34a;
  background: #f0fdf4;
}
.conversation-player {
  margin-bottom: 16px;
}
.sentence-native {
  font-size: 1.05rem;
  font-weight: 500;
  margin-bottom: 4px;
}
.sentence-english {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 8px;
}
.sentence-words {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.word-chip {
  font-size: 0.8rem;
  padding: 2px 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 99px;
  cursor: pointer;
}
.word-chip:hover {
  background: #e5e7eb;
}
.word-table {
  display: grid;
  grid-template-columns: minmax(90px, auto) minmax(140px, 1fr) auto minmax(
      150px,
      auto
    );
  width: 100%;
  font-size: 0.9rem;
}
.table-header,
.word-row {
  display: contents;
}
.th,
.cell {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
}
.th {
  color: #6b7280;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
}
.word-native {
  font-weight: 500;
  cursor: pointer;
}
.word-native:hover {
  color: #2563eb;
}
.word-row.row-shelved > .cell {
  background: #fafafa;
  color: #9ca3af;
}
.mastery-dots {
  display: inline-flex;
  gap: 3px;
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
.status-shelved {
  font-size: 0.8rem;
  color: #92400e;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: 99px;
}
.status-active {
  font-size: 0.8rem;
  color: #6b7280;
}
.status-cell {
  gap: 8px;
  flex-wrap: wrap;
}
.btn-try-now {
  padding: 2px 10px;
  font-size: 0.78rem;
  border: 1px solid #d97706;
  border-radius: 99px;
  background: white;
  color: #92400e;
  cursor: pointer;
  white-space: nowrap;
}
.btn-try-now:hover {
  background: #fef3c7;
}
.overview-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.btn-sentence-learn {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-sentence-learn:hover {
  background: #e5e7eb;
}
.btn-primary {
  padding: 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.sentence-learning-container {
  max-width: 560px;
  margin: 40px auto;
  padding: 0 16px;
}
.sentence-learning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.sentence-progress {
  font-size: 0.9rem;
  color: #6b7280;
}
.sentence-quiz-section {
  margin-bottom: 24px;
}
.current-sentence-display {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  background: #f9fafb;
}
.sentence-loading {
  text-align: center;
  padding: 40px 16px;
  color: #6b7280;
}
.mini-quiz-harness {
  margin-bottom: 24px;
}
.sentence-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.btn-back-overview {
  flex: 1;
  padding: 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-back-overview:hover {
  background: #1d4ed8;
}
</style>
