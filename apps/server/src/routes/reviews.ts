import { Hono } from 'hono';
import {
  getDb,
  SqliteReviewStore,
  SqliteReviewAnswerEventStore,
} from '@gll/db';
import { FsrsScheduler, type ReviewRating } from '@gll/srs-review';
import {
  ErrorCode,
  type ApiResponse,
  type DueReviewsResponse,
  type ReviewAnswerRequest,
  type ReviewAnswerResponse,
  type ReviewQuestionType,
} from '@gll/api-contract';
import { logger } from '../logger.js';

// TODO: replace with authenticated user id once auth/session middleware exists.
const USER_ID = 'demo-user';

// Stateless (default FSRS params) — construct once, reuse across requests.
const scheduler = new FsrsScheduler();

const QUESTION_TYPES: readonly ReviewQuestionType[] = ['mcq', 'word-block'];

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

  // Correctness-only rating — latency/questionType deliberately NOT read here.
  const rating: ReviewRating = req.correct ? 'good' : 'again';

  // Advance + persist (write-on-answer): the schedule is durable before we respond.
  const advanced = scheduler.schedule(card, rating, now);
  await store.upsertReviewCard(USER_ID, advanced);

  // Durable record — fail-open: a record-write failure must not lose the advance above.
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
    // Already logged by the store; the advance stands.
  }

  const data: ReviewAnswerResponse = {
    wordId: advanced.wordId,
    due: advanced.due.toISOString(),
  };
  const body: ApiResponse<ReviewAnswerResponse> = { success: true, data };
  return c.json(body);
});

export default router;
