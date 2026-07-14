<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { type QuizItem, type RunState } from '@gll/srs-engine-v2';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { loadRunState, loadConfig } from './composables/useStore';
import { resolveSentenceAudio } from './composables/useAudio';
import { loadShelvedWords } from './composables/useShelving';
import {
  useDebugRecording,
  finalizeRecordingOnNav,
  crossesPhaseOrMidQuiz,
  dumpRecentAndDownload,
} from './composables/useDebugRecording';
import { applyTestSentenceConfig } from './composables/useTestSentenceConfig';
import { env } from './env';
import { useReviewSession } from './composables/useReviewSession';
import {
  useLearningSession,
  LAST_DECK_KEY,
} from './composables/useLearningSession';
import DeckSelector from './components/DeckSelector.vue';
import QuizCard from './components/QuizCard.vue';
import BatchResults from './components/BatchResults.vue';
import DeckOverview from './components/DeckOverview.vue';
import HomeDashboard from './components/HomeDashboard.vue';
import ReviewHub from './components/ReviewHub.vue';
import ReviewSummary from './components/ReviewSummary.vue';
import NavMenu from './components/NavMenu.vue';
import CurateAudio from './components/CurateAudio.vue';
import MarkAudio from './components/MarkAudio.vue';
import PrototypeWavesurfer from './components/PrototypeWavesurfer.vue';
import type { ConfigType, Screen } from './types';

const apiError = ref<string | null>(null);

const appDecks = ref<AppDeckPayload[]>([]);
const wordPool = ref<QuizItem[]>([]);

// No config is declared in the FE. The whole surface is fetched read-only from
// GET /api/config at boot (see EP37-DS05 + the Config Ownership ADR). Until then
// CONFIG is empty; `configReady` gates session start so nothing runs the engine
// with unset config (fail-closed — no hardcoded fallback).
const CONFIG = ref<ConfigType>({} as ConfigType);
const configReady = ref(false);

const screen = ref<Screen>('home');
const overviewDeckId = ref<string | null>(null);

// --- Learning session (EP38-DS03) — the adaptive quiz state machine (pools,
// batches, sentence scheduling, shelving pipeline, server-authoritative answer
// persistence). Owned by useLearningSession; App.vue keeps boot + nav wiring. ---
const learning = useLearningSession({
  wordPool,
  appDecks,
  CONFIG,
  configReady,
  apiError,
  screen,
});
const {
  globalRunState,
  batchState,
  currentQuestion,
  hasSavedSession,
  deckId,
  shelvedSet,
  completedDeckIds,
  batchScore,
  summary,
  questionKey,
  savedDeckName,
  activeItems,
  queue,
  masteredDeck,
  masteredGlobal,
  nextDeckId,
  shelvedItems,
  recalculateCompletedDecks,
  initSession,
  onSelect,
  onResume,
  onClear,
  finishBatchAndTransition,
  onAnswered,
  onExitBatch,
  onNext,
  onNextDeck,
  onUnshelveWord,
  onUpdateShelvedSet,
  onUpdateWordStates,
} = learning;

// --- Review mode (EP38-DS02) — pool-global session; the client is a dumb
// terminal: it renders questions, self-reports facts, and adopts the schedule
// the server returns. It computes no rating and no `due`, and imports no FSRS
// scheduler. Owned by useReviewSession; App.vue keeps only the boot/nav wiring. ---
const {
  dueReviewCount,
  badgeError,
  reviewBatchState,
  reviewQuestion,
  reviewQuestionKey,
  reviewCaughtUp,
  reviewMode,
  reviewSummary,
  reviewUnlocked,
  refreshDueBadge,
  refreshReviewAvailability,
  onReview: enterReview,
  onAnytimeReview: enterAnytime,
  onReviewAnswered,
} = useReviewSession({
  wordPool,
  globalRunState,
  configReady,
  CONFIG,
  apiError,
});

// --- Debug-trace recording (EP40-DS02) — a phase-scoped Start/Stop session that
// stitches one correlation id per served question and, on Stop, assembles and
// downloads a self-contained replay artifact. App.vue owns Start/Stop + finalize. ---
const recorder = useDebugRecording();
const isRecording = recorder.isRecording;
// Disable the toggle while a finalize is in flight. During 'finalizing' isRecording
// is false, so without this the button re-arms to "Record" and a second click would
// start() a new session — wiping the buffers the in-flight finalize still reads.
const recorderBusy = computed(() => recorder.state.value === 'finalizing');

// Post-hoc dump: assemble a replayable artifact from the last N answers with no prior
// Record press (EP40). Independent of the armed session — recovers a session after a bug
// was already hit. The dumped artifact has no appearance context (see composable).
async function onDumpRecent() {
  try {
    const outcome = await dumpRecentAndDownload(100);
    if (outcome === 'empty') {
      alert('No recent answers to dump — learn or review a few words first.');
    }
  } catch {
    apiError.value =
      'Could not assemble the recent-answers dump. Please check the server and try again.';
  }
}

async function onToggleRecording() {
  if (!recorder.isRecording.value) {
    // Phase is inferred from the current destination; home defaults to Learning
    // (the only replayable phase — Review records the same channels as context).
    recorder.start(activeNav.value === 'review' ? 'review' : 'learning');
    return;
  }
  try {
    const outcome = await recorder.finalizeAndDownload();
    if (outcome === 'empty') {
      alert('Recording stopped — no answers were recorded, so there is nothing to download.');
    }
  } catch {
    apiError.value =
      'Could not assemble the recording. Your session is still active — please check the server and try Stop again.';
  }
}

// --- EP43-DS01 ST03: word-block segment audio resolution ---
// The engine stays audio-free (playback ADR §5); App.vue holds `appDecks` and
// resolves sentenceId → audio for the current word-block question, in both
// Learning and Review (same QuizCard). MCQ questions resolve to undefined —
// QuizCard renders no control (ADR §3).
const currentQuestionAudio = computed(() => {
  if (!currentQuestion.value || currentQuestion.value.kind !== 'word-block')
    return undefined;
  const sentenceId = currentQuestion.value.sentenceId;
  const deckAudio = resolveSentenceAudio(appDecks.value, sentenceId);
  return deckAudio ? { ...deckAudio, sentenceId } : undefined;
});

const reviewQuestionAudio = computed(() => {
  if (!reviewQuestion.value || reviewQuestion.value.kind !== 'word-block')
    return undefined;
  const sentenceId = reviewQuestion.value.sentenceId;
  const deckAudio = resolveSentenceAudio(appDecks.value, sentenceId);
  return deckAudio ? { ...deckAudio, sentenceId } : undefined;
});

// --- Top nav menu (EP38-ST08) ---
// Which top-level destination the current screen belongs to (for highlighting).
const activeNav = computed<'home' | 'learn' | 'review'>(() => {
  if (screen.value === 'home') return 'home';
  if (screen.value === 'review-hub' || screen.value === 'review')
    return 'review';
  return 'learn'; // 'select' | 'quiz' | 'results' | 'overview'
});

// Navigate from the always-visible nav menu. The nav is shown on every screen,
// so leaving an active Learning quiz mid-batch must not silently drop answers:
// Learning persists on batch finish (not per-answer), so flush the partial batch
// first (same path as Exit). Review is write-on-answer — each answered card is
// already durable — so no flush is needed there.
async function navTo(target: 'home' | 'select' | 'review') {
  // Nav-guard (EP40-ST08, generalized): a genuine product UX, not a debug-only
  // affordance — soft-confirm (Cancel default) whenever the target crosses the
  // Learning↔Review boundary or leaves an in-progress quiz batch, for every user.
  // A live recording additionally finalizes on confirm so it never spans the boundary.
  const targetPhase = target === 'review' ? 'review' : 'learning';
  const fromPhase = activeNav.value === 'home' ? null : activeNav.value === 'review' ? 'review' : 'learning';
  const isMidQuiz = screen.value === 'quiz';
  const needsConfirm = crossesPhaseOrMidQuiz(fromPhase, targetPhase, isMidQuiz);

  if (needsConfirm) {
    const message = isRecording.value
      ? 'Finish and download the recording before leaving? Cancel to stay and keep recording.'
      : 'Leave this quiz? Your progress so far will be saved. Cancel to keep going.';
    const proceed = window.confirm(message);
    if (!proceed) return; // stay; recording (if any) continues
  }

  if (
    screen.value === 'quiz' &&
    batchState.value &&
    batchState.value.results.length > 0
  ) {
    await finishBatchAndTransition(); // persists the answered results
  }

  // Finalize AFTER the partial-batch flush so the artifact includes the last batch's
  // transitions (they land in answer_events via the flush's POST /api/answer calls).
  // Debug-only concern, extracted to keep this function reading as plain nav-guard logic.
  const finalizeOutcome = await finalizeRecordingOnNav(recorder, targetPhase, isMidQuiz);
  if (finalizeOutcome === 'failed') {
    // Do NOT navigate: proceeding would carry the still-live recording across the
    // Learning↔Review boundary (or out of the batch) — the exact leak this guard
    // exists to prevent. Stay put so the tester can retry Stop.
    apiError.value =
      'Could not assemble the recording before navigating. Your recording is still active — please check the server and try again.';
    return;
  }

  if (target === 'review') {
    // The review tab is a mode-selection hub (Due Review · Practice Anytime),
    // always reachable regardless of due-count — no more caught-up dead-end.
    // Refresh the badge (due count) and availability (any card → unlock) so the
    // hub reflects reality, incl. words graduated earlier that aren't due yet.
    await Promise.all([refreshDueBadge(), refreshReviewAvailability()]);
    screen.value = 'review-hub';
    return;
  }
  screen.value = target;
}

// Enter a DUE review session from the hub: the composable fetches/builds the queue
// and reports whether it entered ('entered' — show the 'review' screen, possibly
// caught-up) or stayed ('stayed' — a fetch error surfaced via apiError).
async function onReview() {
  const outcome = await enterReview();
  if (outcome === 'entered') screen.value = 'review';
}

// Enter a Practice-Anytime session from the hub (all learned words, due or not).
async function onAnytime() {
  const outcome = await enterAnytime();
  if (outcome === 'entered') screen.value = 'review';
}

function onOverview(id: string) {
  // Fail-closed: DeckOverview reads CONFIG.value.streakThresholds.maxMastery.
  if (!configReady.value) {
    apiError.value =
      'Learning settings are not loaded yet. Please check the server and try again.';
    return;
  }
  overviewDeckId.value = id;
  screen.value = 'overview';
}

// --- Nav destinations reached from the home dashboard / review screen ---

function onSelectDeck() {
  screen.value = 'select';
}

function onLearn() {
  screen.value = 'select';
}

function onReviewExit() {
  // Already-answered advances are durable server-side (write-on-answer), so
  // leaving mid-session loses nothing. The hub is the review landing; re-entry
  // re-fetches a freshly-ordered batch (server rotates the not-due tail).
  screen.value = 'review-hub';
}

// Re-fetch the deck list so a curator write (audio upload / VTT commit) is
// reflected without a full page reload — the audioUrl/vttUrl a screen reads come
// from this list, which is otherwise only populated once at boot.
async function refreshDecks(): Promise<void> {
  const res = await fetch('/api/decks');
  if (!res.ok) return;
  const body = (await res.json()) as { success: true; data: GetDecksResponse };
  appDecks.value = body.data;
}

onMounted(async () => {
  // Fetch decks from API first — required before any other initialisation
  try {
    const decksRes = await fetch('/api/decks');
    if (!decksRes.ok)
      throw new Error(`GET /api/decks failed: ${decksRes.status}`);
    const decksBody = (await decksRes.json()) as {
      success: true;
      data: GetDecksResponse;
    };
    appDecks.value = decksBody.data;

    // Build flat, deduplicated word pool across all decks
    const seen = new Set<string>();
    const pool: QuizItem[] = [];
    for (const deck of appDecks.value) {
      for (const word of deck.words) {
        if (!seen.has(word.id)) {
          seen.add(word.id);
          pool.push(word as QuizItem);
        }
      }
    }
    wordPool.value = pool;
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    return;
  }

  // Config is server-owned — fetch the whole surface before anything reads it
  // (completed-deck detection, session init). Fail closed: no session without it.
  try {
    const cfg = await loadConfig();
    CONFIG.value = { ...cfg.user, ...cfg.system };
    configReady.value = true;
  } catch {
    apiError.value =
      'Could not load learning settings. Please check that the server is running and try again.';
    return;
  }

  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    recalculateCompletedDecks();
    return;
  }
  if (runState.size > 0) {
    hasSavedSession.value = true;
    globalRunState.value = runState;
    deckId.value = localStorage.getItem(LAST_DECK_KEY);
  }

  // Review state at boot: the due-count badge and card availability. Availability
  // (any review card exists) unlocks Review even when nothing is due yet, so a
  // returning user with future-due cards isn't locked out (EP39-BUG01). Both are
  // error-tolerant (badgeError / best-effort) and safe for a brand-new user.
  await Promise.all([refreshDueBadge(), refreshReviewAvailability()]);

  // Load persisted shelved words for the last active deck on mount
  const savedDeckId = localStorage.getItem(LAST_DECK_KEY);
  if (savedDeckId) {
    try {
      const shelvedWords = await loadShelvedWords(savedDeckId);
      shelvedSet.value = new Set(shelvedWords.map((sw) => sw.wordId));
    } catch {
      // Non-fatal: shelving state will be empty
    }
  }

  if (env.testHooks) await applyTestSentenceConfig(CONFIG);

  recalculateCompletedDecks();
});
</script>

<template>
  <NavMenu
    :active="activeNav"
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    :badge-error="badgeError"
    @home="navTo('home')"
    @learn="navTo('select')"
    @review="navTo('review')"
  />

  <button
    v-if="env.debugMode"
    class="rec-toggle"
    :class="{ recording: isRecording }"
    :disabled="recorderBusy"
    :title="isRecording ? 'Stop recording and download the artifact' : 'Start a debug-trace recording'"
    @click="onToggleRecording"
  >
    <span class="rec-dot" />
    {{ isRecording ? 'Stop & download' : 'Record' }}
  </button>

  <button
    v-if="env.debugMode && !isRecording"
    class="dump-recent"
    :disabled="recorderBusy"
    title="Download a replayable artifact from the last 100 answers (no prior Record needed)"
    @click="onDumpRecent"
  >
    Dump last 100
  </button>

  <button
    v-if="env.curatorMode && screen !== 'curate'"
    class="curate-toggle"
    title="Pair conversation audio with a deck (curator tooling)"
    @click="screen = 'curate'"
  >
    🎙️ Curate audio
  </button>

  <button
    v-if="env.curatorMode && screen !== 'mark'"
    class="mark-toggle"
    title="Mark per-sentence audio segments for a deck (curator tooling)"
    @click="screen = 'mark'"
  >
    🏷️ Mark audio
  </button>

  <!-- EP43-BUG01 spike only — dev-only, not a real screen. -->
  <button
    v-if="env.debugMode && screen !== 'ws-proto'"
    class="ws-proto-toggle"
    title="Wavesurfer.js seek-accuracy spike (EP43-BUG01)"
    @click="screen = 'ws-proto'"
  >
    🌊 WS proto
  </button>

  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

  <CurateAudio
    v-if="env.curatorMode && screen === 'curate'"
    :decks="appDecks"
    @uploaded="refreshDecks"
    @back="screen = 'select'"
  />

  <MarkAudio
    v-if="env.curatorMode && screen === 'mark'"
    :decks="appDecks"
    @committed="refreshDecks"
    @back="screen = 'select'"
  />

  <PrototypeWavesurfer
    v-if="env.debugMode && screen === 'ws-proto' && appDecks.length"
    :deck="appDecks.find((d) => d.audioUrl) ?? appDecks[0]"
  />

  <HomeDashboard
    v-if="screen === 'home'"
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    :badge-error="badgeError"
    @learn="onLearn"
    @review="navTo('review')"
  />

  <ReviewHub
    v-else-if="screen === 'review-hub'"
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    :badge-error="badgeError"
    @due="onReview"
    @anytime="onAnytime"
  />

  <DeckSelector
    v-else-if="screen === 'select'"
    :decks="appDecks"
    :has-saved-session="hasSavedSession"
    :saved-deck-id="deckId"
    :saved-deck-name="savedDeckName"
    :completed-deck-ids="completedDeckIds"
    @select="onSelect"
    @resume="onResume"
    @clear="onClear"
    @overview="onOverview"
  />

  <DeckOverview
    v-else-if="screen === 'overview' && overviewDeckId"
    :deck="appDecks.find((d) => d.id === overviewDeckId)!"
    :run-state="globalRunState"
    :shelved-set="shelvedSet"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :word-pool="wordPool"
    @back="screen = 'select'"
    @start-quiz="
      (id) => {
        void initSession(id, false);
      }
    "
    @unshelve-word="onUnshelveWord"
    @update-shelved-set="onUpdateShelvedSet"
    @update-word-states="onUpdateWordStates"
  />

  <QuizCard
    v-else-if="screen === 'quiz' && currentQuestion && batchState"
    :key="questionKey"
    :question="currentQuestion"
    :index="batchState.results.length"
    :total="batchState.initialCount"
    :active-items="activeItems"
    :queue="queue"
    :mastered-deck="masteredDeck"
    :shelved-items="shelvedItems"
    :audio="currentQuestionAudio"
    @answered="onAnswered"
    @exit="onExitBatch"
  />

  <BatchResults
    v-else-if="screen === 'results'"
    :summary="summary"
    :batch-score="batchScore"
    :active-items="activeItems"
    :queue="queue"
    :mastered-deck="masteredDeck"
    :mastered-global="masteredGlobal"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :next-deck-id="nextDeckId"
    :shelved-items="shelvedItems"
    @next="onNext"
    @select-deck="onSelectDeck"
    @next-deck="onNextDeck"
  />

  <!-- Review session: same QuizCard UI as Learning (D5 — no self-rating prompt).
       Three sub-states: active question, end-of-session summary, or caught-up. -->
  <template v-else-if="screen === 'review'">
    <QuizCard
      v-if="reviewQuestion && reviewBatchState"
      :key="reviewQuestionKey"
      :question="reviewQuestion"
      :index="reviewBatchState.results.length"
      :total="reviewBatchState.initialCount"
      :active-items="[]"
      :queue="[]"
      :mastered-deck="[]"
      :feedback-dwell="true"
      :audio="reviewQuestionAudio"
      @answered="onReviewAnswered"
      @exit="onReviewExit"
    />
    <ReviewSummary
      v-else
      :caught-up="reviewCaughtUp"
      :mode="reviewMode"
      :reviewed="reviewSummary.reviewed"
      :advanced="reviewSummary.advanced"
      :next-due="reviewSummary.nextDue"
      @home="onReviewExit"
    />
  </template>
</template>

<style scoped>
.curate-toggle,
.mark-toggle {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 50;
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #374151;
  font-family: sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.mark-toggle {
  bottom: 56px;
}
.rec-toggle {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #374151;
  font-family: sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.dump-recent {
  position: fixed;
  bottom: 60px;
  right: 16px;
  z-index: 50;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #6b7280;
  font-family: sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.dump-recent:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rec-toggle .rec-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
}
.rec-toggle.recording {
  border-color: #fca5a5;
  color: #b91c1c;
}
.rec-toggle.recording .rec-dot {
  background: #dc2626;
  animation: rec-pulse 1.2s ease-in-out infinite;
}
@keyframes rec-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.api-error {
  max-width: 480px;
  margin: 24px auto;
  padding: 12px 16px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  font-size: 0.95rem;
  text-align: center;
}
</style>
