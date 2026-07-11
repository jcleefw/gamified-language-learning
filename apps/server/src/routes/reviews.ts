import { Hono } from 'hono';
import {
  getDb,
  SqliteReviewStore,
  SqliteReviewAnswerEventStore,
} from '@gll/db';
import { FsrsScheduler, type ReviewCard, type ReviewRating } from '@gll/srs-review';
import {
  ErrorCode,
  type AnytimeReviewsResponse,
  type ApiResponse,
  type DueReviewsResponse,
  type ReviewAnswerRequest,
  type ReviewAnswerResponse,
  type ReviewQuestionType,
} from '@gll/api-contract';
import { getCurrentUserId } from '../identity/current-user.js';
import { logger } from '../logger.js';

const USER_ID = getCurrentUserId();

// Stateless (default FSRS params) — construct once, reuse across requests.
const scheduler = new FsrsScheduler();

const QUESTION_TYPES: readonly ReviewQuestionType[] = ['mcq', 'word-block'];

// Anytime batch is bounded; the limit is server policy and never crosses the wire.
const ANYTIME_LIMIT = 50;

/** FR-014/016. Due cards first (most-overdue-first). Not-due tail re-ranked
 *  least-recently-practised first (never-practised sorts to the front of the tail).
 *  Bounded to `limit`. Pure — unit-tested without a DB. */
export function orderAnytimeBatch(
  cards: ReviewCard[],
  lastSeenByWord: Map<string, string>,
  now: Date,
  limit = ANYTIME_LIMIT,
): ReviewCard[] {
  const t = now.getTime();
  const due = cards
    .filter((c) => c.due.getTime() <= t)
    .sort((a, b) => a.due.getTime() - b.due.getTime()); // most-overdue-first
  const notDue = cards
    .filter((c) => c.due.getTime() > t)
    .sort((a, b) =>
      (lastSeenByWord.get(a.wordId) ?? '').localeCompare(
        lastSeenByWord.get(b.wordId) ?? '',
      ),
    ); // least-recently-practised first ('' = never → front of tail)
  return [...due, ...notDue].slice(0, limit);
}

const router = new Hono();

// GET /api/reviews — pool-global due cards, most-overdue-first (store owns ordering
// and orphan tolerance). Thin projection to ISO `due`.
router.get('/reviews', async (c) => {
  const now = new Date();
  const cards = await new SqliteReviewStore(getDb()).getDueReviewCards(
    USER_ID,
    now,
  );
  const data: DueReviewsResponse = {
    reviews: cards.map((cd) => ({ wordId: cd.wordId, due: cd.due.toISOString() })),
  };
  const body: ApiResponse<DueReviewsResponse> = { success: true, data };
  return c.json(body);
});

// GET /api/reviews/anytime — bounded, ordered batch over ALL learned words (due or
// not). Read-only: reads cards + recency, mutates nothing. Ordering is server policy
// (orderAnytimeBatch); the wire carries only { wordId, due }. Orphan-tolerant.
router.get('/reviews/anytime', async (c) => {
  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const cards = await store.getAllReviewCards(USER_ID);
  const lastSeen = await store.getLastPracticedAtByWord(USER_ID);
  const batch = orderAnytimeBatch(cards, lastSeen, now, ANYTIME_LIMIT);
  const data: AnytimeReviewsResponse = {
    reviews: batch.map((cd) => ({ wordId: cd.wordId, due: cd.due.toISOString() })),
  };
  const body: ApiResponse<AnytimeReviewsResponse> = { success: true, data };
  return c.json(body);
});

// POST /api/reviews/answer — server-authoritative advance. Correctness-only rating;
// latency/questionType are recorded, never used for scheduling in this build.
router.post('/reviews/answer', async (c) => {
  const correlationId = c.req.header('x-correlation-id') ?? null;
  const log = logger.child({ correlationId: correlationId ?? undefined });

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    log.warn('POST /api/reviews/answer: invalid JSON body');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  const req = payload as ReviewAnswerRequest;
  if (
    !req ||
    typeof req.wordId !== 'string' ||
    req.wordId === '' ||
    typeof req.correct !== 'boolean' ||
    typeof req.latencyMs !== 'number' ||
    !Number.isFinite(req.latencyMs) ||
    req.latencyMs < 0 ||
    !QUESTION_TYPES.includes(req.questionType)
  ) {
    log.warn('POST /api/reviews/answer: invalid body');
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: 'wordId, correct, latencyMs, questionType are required',
      },
    };
    return c.json(body, 400);
  }

  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const card = await store.getReviewCard(USER_ID, req.wordId);
  if (!card) {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.NOT_FOUND,
        message: 'no review card for wordId',
      },
    };
    return c.json(body, 404);
  }

  // Due-gate (ADR §2): advance iff the card is due at answer time, derived from the
  // PERSISTED card — never from the request or which session it came through. There
  // is no spoofable client flag; due answers advance, eager (not-due) answers are
  // read-only to the schedule.
  const isDue = card.due.getTime() <= now.getTime();

  // Due → correctness-only rating; not-due → no FSRS rating (recorded as null).
  const rating: ReviewRating | null = isDue ? (req.correct ? 'good' : 'again') : null;

  // Due path only: advance + persist (write-on-answer). Not-due leaves the card's
  // scheduler state (due/schedulerData) byte-for-byte untouched (NFR-005).
  let resultDue = card.due;
  if (isDue) {
    const advanced = scheduler.schedule(card, rating as ReviewRating, now);
    await store.upsertReviewCard(USER_ID, advanced);
    resultDue = advanced.due;
  }

  // Durable record on BOTH branches — fail-open: a record-write failure must not lose
  // the advance above. `rating` is null for eager answers (the durable read-only marker).
  try {
    await new SqliteReviewAnswerEventStore(getDb(), log).appendReviewAnswerEvent({
      correlationId,
      userId: USER_ID,
      wordId: req.wordId,
      correct: req.correct,
      latencyMs: req.latencyMs,
      questionType: req.questionType,
      rating,
      createdAt: now.toISOString(),
    });
  } catch {
    // Already logged by the store; the advance (if any) stands.
  }

  const data: ReviewAnswerResponse = {
    wordId: req.wordId,
    due: resultDue.toISOString(),
    advanced: isDue,
  };
  const body: ApiResponse<ReviewAnswerResponse> = { success: true, data };
  return c.json(body);
});

export default router;
