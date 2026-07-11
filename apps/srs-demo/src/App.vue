<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { type QuizItem, type RunState } from '@gll/srs-engine-v2';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { loadRunState, loadConfig } from './composables/useStore';
import { loadShelvedWords } from './composables/useShelving';
import { getTraceSession } from './composables/useTraceSession';
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
  if (
    screen.value === 'quiz' &&
    batchState.value &&
    batchState.value.results.length > 0
  ) {
    await finishBatchAndTransition(); // persists the answered results
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

// Debug-trace controls (EP40) — situational start/stop; on stop the in-memory
// API + appearance entries are exported as a downloadable JSON artefact,
// reconciled offline against the DB transition rows by correlationId (DS02/OQ2).
const trace = getTraceSession();
const traceActive = trace.active;

function startTrace() {
  trace.start();
}

function stopAndExportTrace() {
  trace.stop();
  const data = trace.exportSession();
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trace-${data.sessionId}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
    CONFIG.value = { ...cfg.user, ...cfg.pedagogy };
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

  // Load sentence config override for tests
  try {
    const res = await fetch('/api/test/config/sentence');
    if (res.ok) {
      const body = (await res.json()) as {
        success: boolean;
        data: object | null;
      };
      if (body.success && body.data) {
        const override = body.data as Partial<typeof CONFIG.value>;
        CONFIG.value = {
          ...CONFIG.value,
          ...override,
          sentenceScheduling: {
            ...CONFIG.value.sentenceScheduling,
            ...override.sentenceScheduling,
          },
          sentenceGraduation: {
            ...CONFIG.value.sentenceGraduation,
            ...override.sentenceGraduation,
          },
        };
      }
    }
  } catch {
    // Non-fatal: use default config
  }

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

  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

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

  <div style="text-align: center; padding: 16px">
    <button
      style="
        padding: 8px 16px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      "
      @click="traceActive ? stopAndExportTrace() : startTrace()"
    >
      {{ traceActive ? '⏹ Stop & Export Trace' : '⏺ Start Debug Trace' }}
    </button>
  </div>
</template>

<style scoped>
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
