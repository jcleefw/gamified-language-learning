import { ref, computed, type Ref } from 'vue';
import {
  assembleBatch,
  initBatchState,
  nextQuestion,
  submitBatchResult,
  isBatchDone,
  isMastered,
  type QuizItem,
  type QuizQuestion,
  type QuizResult,
  type RunState,
  type BatchState,
} from '@gll/srs-engine-v2';
import type { DueReviewItem, ReviewQuestionType } from '@gll/api-contract';
import {
  loadAnytimeReviews,
  loadDueReviews,
  postReviewAnswer,
} from './useStore';
import { mintCorrelationId, type CorrelationId } from './useCorrelation';
import { getTraceSession } from './useTraceSession';
import type { ConfigType } from '../types';

export interface UseReviewSessionDeps {
  wordPool: Ref<QuizItem[]>;
  globalRunState: Ref<RunState>;
  configReady: Ref<boolean>;
  CONFIG: Ref<ConfigType>;
  apiError: Ref<string | null>;
}

// --- Review mode (EP38-DS02) — pool-global session; the client is a dumb
// terminal: it renders questions, self-reports facts, and adopts the schedule
// the server returns. It computes no rating and no `due`, and imports no FSRS
// scheduler. ---
export function useReviewSession(deps: UseReviewSessionDeps) {
  const { wordPool, globalRunState, configReady, CONFIG, apiError } = deps;

  const dueReviews = ref<DueReviewItem[]>([]); // from GET /api/reviews
  const dueReviewCount = ref<number | null>(null); // badge; null until fetched
  const badgeError = ref(false); // due-count fetch failed (never masquerade as "caught up")
  // Does the user have ANY review card (due or not)? Set from /api/reviews/anytime.
  // Unlocks Review even when nothing is due yet (fresh graduation) so Practice
  // Anytime is reachable — fixes EP39-BUG01 (a due card behind a locked tab).
  const hasReviewCards = ref(false);
  const reviewBatchState = ref<BatchState | null>(null);
  const reviewQuestion = ref<QuizQuestion | null>(null);
  const reviewShownAt = ref<number>(0); // latency start for the current review question
  // Correlation id for the currently-shown review question (EP40-ST01). Minted on
  // show, sent with its answer POST — Review has no recheck, so one id per question.
  const reviewCorrelationId = ref<CorrelationId | null>(null);
  const reviewQuestionKey = ref(0);
  const reviewCaughtUp = ref(false); // nothing was due on entry
  // Session-type marker — UI only (summary copy + exit target); never sent to the
  // server. Due-ness is server truth (ADR §2); the client can't and shouldn't decide it.
  const reviewMode = ref<'due' | 'anytime'>('due');
  const reviewSummary = ref<{
    reviewed: number;
    advanced: number;
    nextDue: string | null;
  }>({
    reviewed: 0,
    advanced: 0,
    nextDue: null,
  });

  // Review unlock gate. Epic: "locked until any word is mastered." Unlocked when
  // EITHER a word is mastered locally (instant, no round-trip — covers a word just
  // graduated this session) OR the user has any review card (covers a returning
  // user whose cards exist but aren't currently due — see EP39-BUG01). Fail-closed
  // when config isn't ready (no threshold to test).
  const reviewUnlocked = computed(
    () =>
      configReady.value &&
      ([...globalRunState.value.values()].some((ws) =>
        isMastered(ws, CONFIG.value.masteryThreshold),
      ) ||
        hasReviewCards.value),
  );

  // wordId → QuizItem resolution against the already-preloaded, cross-deck
  // wordPool. Orphans (word deleted; no pool match) are skipped, not errored —
  // pillar-3 tolerance carried through the UI.
  function resolveDueItems(reviews: DueReviewItem[]): QuizItem[] {
    const byId = new Map(wordPool.value.map((w) => [w.id, w]));
    return reviews
      .map((r) => byId.get(r.wordId))
      .filter((w): w is QuizItem => w != null);
  }

  // ReviewQuestionType mirrors QuizQuestion.kind, so the client reports what was
  // shown as-is — no mapping/renaming (a DS01 wire fact, not policy).
  function toReviewQuestionType(q: QuizQuestion): ReviewQuestionType {
    return q.kind;
  }

  // Review due-count badge. No longer gated on reviewUnlocked: the count itself now
  // feeds availability (EP39-BUG01), so it must load regardless — a locked-but-due
  // state must still surface its count. A failed fetch flags badgeError so home
  // shows a dash, never a false "0 / caught up".
  async function refreshDueBadge() {
    try {
      const reviews = await loadDueReviews();
      dueReviews.value = reviews;
      dueReviewCount.value = reviews.length;
      badgeError.value = false;
    } catch {
      badgeError.value = true;
    }
  }

  // "Does the user have any review card at all?" — sourced from the anytime read
  // (all learned words, due or not). Drives the unlock gate so Review is reachable
  // whenever cards exist, even with nothing due today (EP39-BUG01). Best-effort:
  // on failure the local mastery path still unlocks.
  async function refreshReviewAvailability() {
    try {
      const cards = await loadAnytimeReviews();
      hasReviewCards.value = cards.length > 0;
    } catch {
      // Leave hasReviewCards as-is; mastery still gates unlock.
    }
  }

  // Appearance channel (EP40-ST04) — the review-queue "which word appears next"
  // seam, keyed by the just-minted question correlation id. Fail-open.
  function traceReviewQuestionServed(question: QuizQuestion | null): void {
    getTraceSession().record({
      correlationId: reviewCorrelationId.value,
      channel: 'appearance',
      data: {
        kind: 'question-served',
        detail: {
          mode: reviewMode.value,
          wordId: question?.kind === 'mcq' ? question.wordId : undefined,
        },
      },
    });
  }

  // Build the queue from resolved QuizItems and ask the first question. Shared by
  // due and anytime entry — the only divergence between the two is the source
  // endpoint and the session-type marker. Same pipeline/UI as Learning;
  // distractors come from the full cross-deck wordPool. Retries disabled (0) so
  // each word is asked exactly once. An empty list shows the caught-up state.
  function startSessionFromItems(items: QuizItem[]) {
    reviewBatchState.value = null;
    reviewQuestion.value = null;
    if (items.length === 0) {
      reviewCaughtUp.value = true;
      return;
    }
    reviewCaughtUp.value = false;
    const questions = assembleBatch(items, wordPool.value, [], items.length, {
      excludeIds: new Set<string>(),
    });
    reviewBatchState.value = initBatchState(questions, 0, new Map(), 0);
    const { question, state } = nextQuestion(reviewBatchState.value);
    reviewBatchState.value = state;
    reviewQuestion.value = question;
    reviewShownAt.value = performance.now();
    reviewCorrelationId.value = mintCorrelationId();
    traceReviewQuestionServed(question);
    reviewQuestionKey.value++;
  }

  // Enter a pool-global DUE review session. Refreshes due cards (also keeps the
  // badge honest), resolves them against wordPool (skipping orphans), and builds
  // questions via the same pipeline Learning uses. An empty due list shows the
  // caught-up state rather than an error.
  async function onReview(): Promise<'entered' | 'stayed'> {
    apiError.value = null;
    let reviews: DueReviewItem[];
    try {
      reviews = await loadDueReviews();
    } catch {
      // Gate is local truth; a failed fetch must surface, not fake "caught up".
      badgeError.value = true;
      apiError.value =
        'Could not load your reviews. Please check that the server is running and try again.';
      return 'stayed'; // stay on hub
    }
    dueReviews.value = reviews;
    dueReviewCount.value = reviews.length;
    badgeError.value = false;

    reviewMode.value = 'due';
    reviewSummary.value = { reviewed: 0, advanced: 0, nextDue: null };
    startSessionFromItems(resolveDueItems(reviews));
    return 'entered';
  }

  // Enter a Practice-Anytime session over ALL learned words (due or not), sourced
  // from GET /api/reviews/anytime (server-ordered, ≤50). The answer round-trip is
  // identical to due review — the server due-gates, and we read `advanced` back
  // (see onReviewAnswered). No due-ness is inspected or sent (ADR §2).
  async function onAnytimeReview(): Promise<'entered' | 'stayed'> {
    apiError.value = null;
    let reviews: DueReviewItem[];
    try {
      reviews = await loadAnytimeReviews();
    } catch {
      apiError.value =
        'Could not load words to practise. Please check that the server is running and try again.';
      return 'stayed'; // stay on hub
    }

    reviewMode.value = 'anytime';
    reviewSummary.value = { reviewed: 0, advanced: 0, nextDue: null };
    startSessionFromItems(resolveDueItems(reviews));
    return 'entered';
  }

  function advanceReviewQueue(result: QuizResult) {
    if (!reviewBatchState.value) return;
    reviewBatchState.value = submitBatchResult(reviewBatchState.value, result);
    if (isBatchDone(reviewBatchState.value)) {
      reviewQuestion.value = null; // → summary sub-state on the 'review' screen
    } else {
      const { question, state } = nextQuestion(reviewBatchState.value);
      reviewBatchState.value = state;
      reviewQuestion.value = question;
      reviewShownAt.value = performance.now();
      reviewCorrelationId.value = mintCorrelationId();
      traceReviewQuestionServed(question);
      reviewQuestionKey.value++;
    }
  }

  async function onReviewAnswered(result: QuizResult) {
    if (!reviewBatchState.value || !reviewQuestion.value) return;
    const questionType = toReviewQuestionType(reviewQuestion.value);

    // Review only generates word MCQs (word items, no sentence thunks). Guard a
    // stray sentence result rather than POST a malformed request.
    if (!('wordId' in result)) {
      advanceReviewQueue(result);
      return;
    }

    const latencyMs = Math.max(
      0,
      Math.round(performance.now() - reviewShownAt.value),
    );
    let res;
    try {
      res = await postReviewAnswer(
        {
          wordId: result.wordId,
          correct: result.correct,
          latencyMs,
          questionType,
        },
        reviewCorrelationId.value ?? undefined,
      );
    } catch (err) {
      // DS01 leaves the card unchanged on error; do not advance past this word or
      // fake success — surface it (write-on-answer contract).
      console.error('[REVIEW] answer persistence failed for', result.wordId, err);
      apiError.value =
        'Could not save your review answer. Your progress may not be recorded — please check the server and try again.';
      return;
    }

    // Adopt the server-returned schedule for the summary horizon (no client math).
    // `advanced` is server truth (due-gate, DS01): only an advanced answer moved
    // the schedule, so only its `due` may narrow the next-due horizon. A read-only
    // (eager, not-due) answer returns its unchanged far-future `due` — folding that
    // in would misreport the horizon.
    reviewSummary.value.reviewed++;
    if (res.advanced) {
      reviewSummary.value.advanced++;
      const prev = reviewSummary.value.nextDue;
      if (
        prev === null ||
        new Date(res.due).getTime() < new Date(prev).getTime()
      ) {
        reviewSummary.value.nextDue = res.due;
      }
    }

    advanceReviewQueue(result);
  }

  return {
    dueReviews,
    dueReviewCount,
    badgeError,
    hasReviewCards,
    reviewBatchState,
    reviewQuestion,
    reviewQuestionKey,
    reviewCaughtUp,
    reviewMode,
    reviewSummary,
    reviewUnlocked,
    resolveDueItems,
    toReviewQuestionType,
    refreshDueBadge,
    refreshReviewAvailability,
    onReview,
    onAnytimeReview,
    onReviewAnswered,
  };
}
