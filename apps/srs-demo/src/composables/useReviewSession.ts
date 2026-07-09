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
import { loadDueReviews, postReviewAnswer } from './useStore';
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
  const reviewBatchState = ref<BatchState | null>(null);
  const reviewQuestion = ref<QuizQuestion | null>(null);
  const reviewShownAt = ref<number>(0); // latency start for the current review question
  const reviewQuestionKey = ref(0);
  const reviewCaughtUp = ref(false); // nothing was due on entry
  const reviewSummary = ref<{ reviewed: number; nextDue: string | null }>({
    reviewed: 0,
    nextDue: null,
  });

  // Review unlock gate — purely local truth; no server call. Epic: "locked until
  // any word is mastered." Fail-closed when config isn't ready (no threshold to test).
  const reviewUnlocked = computed(
    () =>
      configReady.value &&
      [...globalRunState.value.values()].some((ws) =>
        isMastered(ws, CONFIG.value.masteryThreshold),
      ),
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

  // Review due-count badge — only when unlocked (gate is local; badge needs the
  // route). A failed fetch flags badgeError so home shows a dash, never a false
  // "0 / caught up".
  async function refreshDueBadge() {
    if (!reviewUnlocked.value) return;
    try {
      const reviews = await loadDueReviews();
      dueReviews.value = reviews;
      dueReviewCount.value = reviews.length;
      badgeError.value = false;
    } catch {
      badgeError.value = true;
    }
  }

  // Enter a pool-global review session. Refreshes due cards (also keeps the
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
      return 'stayed'; // stay on home
    }
    dueReviews.value = reviews;
    dueReviewCount.value = reviews.length;
    badgeError.value = false;

    reviewSummary.value = { reviewed: 0, nextDue: null };
    reviewBatchState.value = null;
    reviewQuestion.value = null;

    const items = resolveDueItems(reviews);
    if (items.length === 0) {
      reviewCaughtUp.value = true;
      return 'entered';
    }
    reviewCaughtUp.value = false;

    // Same pipeline/UI as Learning; distractors come from the full cross-deck
    // wordPool. Retries disabled (0) so each due word is asked exactly once.
    const questions = assembleBatch(items, wordPool.value, [], items.length, {
      excludeIds: new Set<string>(),
    });
    reviewBatchState.value = initBatchState(questions, 0, new Map(), 0);
    const { question, state } = nextQuestion(reviewBatchState.value);
    reviewBatchState.value = state;
    reviewQuestion.value = question;
    reviewShownAt.value = performance.now();
    reviewQuestionKey.value++;
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
      res = await postReviewAnswer({
        wordId: result.wordId,
        correct: result.correct,
        latencyMs,
        questionType,
      });
    } catch (err) {
      // DS01 leaves the card unchanged on error; do not advance past this word or
      // fake success — surface it (write-on-answer contract).
      console.error('[REVIEW] answer persistence failed for', result.wordId, err);
      apiError.value =
        'Could not save your review answer. Your progress may not be recorded — please check the server and try again.';
      return;
    }

    // Adopt the server-returned schedule for the summary horizon (no client math).
    reviewSummary.value.reviewed++;
    const prev = reviewSummary.value.nextDue;
    if (prev === null || new Date(res.due).getTime() < new Date(prev).getTime()) {
      reviewSummary.value.nextDue = res.due;
    }

    advanceReviewQueue(result);
  }

  return {
    dueReviews,
    dueReviewCount,
    badgeError,
    reviewBatchState,
    reviewQuestion,
    reviewQuestionKey,
    reviewCaughtUp,
    reviewSummary,
    reviewUnlocked,
    resolveDueItems,
    toReviewQuestionType,
    refreshDueBadge,
    onReview,
    onReviewAnswered,
  };
}
