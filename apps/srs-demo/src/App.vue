<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { type QuizItem } from '@gll/srs-engine-v2';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { resolveSentenceAudio } from './composables/useAudio';
import { bootApp } from './composables/useAppBoot';
import { env } from './env';
import { useReviewSession } from './composables/useReviewSession';
import { useLearningSession } from './composables/useLearningSession';
import { setLearningSession } from './composables/learningSessionSingleton';
import { markInternalNavigation, navTabOf } from './router-guards';
import { ROUTE_NAMES } from './routeNames';
import NavMenu from './components/NavMenu.vue';
import DebugRecordingControls from './components/DebugRecordingControls.vue';
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

onMounted(() =>
  bootApp({
    appDecks,
    wordPool,
    CONFIG,
    configReady,
    apiError,
    hasSavedSession,
    globalRunState,
    deckId,
    shelvedSet,
    refreshDueBadge,
    refreshReviewAvailability,
    recalculateCompletedDecks,
  }),
);
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

  <DebugRecordingControls
    :active-nav="activeNav"
    @error="apiError = $event"
  />

  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

  <RouterView />
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
