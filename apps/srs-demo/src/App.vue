<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { type QuizItem, type RunState } from '@gll/srs-engine-v2';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { loadRunState, loadConfig } from './composables/useStore';
import { resolveSentenceAudio } from './composables/useAudio';
import { loadShelvedWords } from './composables/useShelving';
import {
  useDebugRecording,
  dumpRecentAndDownload,
} from './composables/useDebugRecording';
import { applyTestSentenceConfig } from './composables/useTestSentenceConfig';
import { env } from './env';
import { useReviewSession } from './composables/useReviewSession';
import {
  useLearningSession,
  LAST_DECK_KEY,
} from './composables/useLearningSession';
import { setLearningSession } from './composables/learningSessionSingleton';
import { markInternalNavigation, navTabOf } from './router-guards';
import { ROUTE_NAMES } from './routeNames';
import NavMenu from './components/NavMenu.vue';
import type { ConfigType } from './types';

const router = useRouter();
const route = useRoute();

const apiError = ref<string | null>(null);

const appDecks = ref<AppDeckPayload[]>([]);
const wordPool = ref<QuizItem[]>([]);

// No config is declared in the FE. The whole surface is fetched read-only from
// GET /api/config at boot (see EP37-DS05 + the Config Ownership ADR). Until then
// CONFIG is empty; `configReady` gates session start so nothing runs the engine
// with unset config (fail-closed — no hardcoded fallback).
const CONFIG = ref<ConfigType>({} as ConfigType);
const configReady = ref(false);

// Funnel for useLearningSession's internal screen transitions (batch start/finish,
// clear, exit-with-empty-batch). Marked "internal" so router-guards.ts's beforeEach
// skips the confirm/flush/finalize logic for these — that logic reproduces the old
// navTo guard, which only ever ran for NavMenu-initiated clicks, never for the
// state machine's own transitions (see router-guards.ts for the full rationale).
async function internalNavigate(
  name: string,
  params?: Record<string, string>,
  query?: Record<string, string>,
): Promise<void> {
  markInternalNavigation();
  await router.push({ name, params, query });
}

// --- Learning session (EP38-DS03) — the adaptive quiz state machine (pools,
// batches, sentence scheduling, shelving pipeline, server-authoritative answer
// persistence). Owned by useLearningSession; App.vue keeps boot + nav wiring. ---
const learning = useLearningSession({
  wordPool,
  appDecks,
  CONFIG,
  configReady,
  apiError,
  navigate: internalNavigate,
});
const {
  globalRunState,
  currentQuestion,
  hasSavedSession,
  deckId,
  shelvedSet,
  recalculateCompletedDecks,
} = learning;

// The nav guard runs outside the component tree (router.beforeEach), so it can't
// inject() this instance — register it on the module-level singleton instead.
setLearningSession({ session: learning, apiError });

// --- Review mode (EP38-DS02) — pool-global session; the client is a dumb
// terminal: it renders questions, self-reports facts, and adopts the schedule
// the server returns. It computes no rating and no `due`, and imports no FSRS
// scheduler. Owned by useReviewSession; App.vue keeps only the boot/nav wiring. ---
const reviewSession = useReviewSession({
  wordPool,
  globalRunState,
  configReady,
  CONFIG,
  apiError,
});
const {
  dueReviewCount,
  badgeError,
  reviewQuestion,
  reviewUnlocked,
  refreshDueBadge,
  refreshReviewAvailability,
} = reviewSession;

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
// Which top-level destination the current route belongs to (for highlighting).
const activeNav = computed<'home' | 'learn' | 'review' | 'curation'>(() =>
  navTabOf(route.name),
);

// NavMenu emits go straight to router.push — the beforeEach guard in
// router-guards.ts reproduces the old navTo confirm/flush/finalize logic for
// these (genuinely user-initiated) navigations. Curation is never guarded
// (preserved quirk — see router-guards.ts).
function goHome() {
  void router.push({ name: ROUTE_NAMES.HOME });
}
function goLearn() {
  void router.push({ name: ROUTE_NAMES.DECK_SELECT });
}
function goReview() {
  void router.push({ name: ROUTE_NAMES.REVIEW_HUB });
}
function goCuration() {
  void router.push({ name: ROUTE_NAMES.CURATION });
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

// ST03 view wrappers read boot state + the session instances through these
// (not by re-instantiating the composables — see learningSessionSingleton.ts
// for why the guard specifically can't use provide/inject).
provide('appDecks', appDecks);
provide('wordPool', wordPool);
provide('CONFIG', CONFIG);
provide('configReady', configReady);
provide('apiError', apiError);
provide('learningSession', learning);
provide('reviewSession', reviewSession);
provide('refreshDecks', refreshDecks);
provide('currentQuestionAudio', currentQuestionAudio);
provide('reviewQuestionAudio', reviewQuestionAudio);

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
    :curation-mode="env.curationMode"
    @home="goHome"
    @learn="goLearn"
    @review="goReview"
    @curation="goCuration"
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

  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

  <RouterView />
</template>

<style scoped>
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
