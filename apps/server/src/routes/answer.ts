import { Hono } from 'hono';
import { getDb, SqliteLearningStore, SqliteAnswerEventStore, SqliteReviewStore } from '@gll/db';
import { processRecheckResult, isMastered, type WordState } from '@gll/srs-engine-v2';
import { FsrsScheduler } from '@gll/srs-review';
import {
  ErrorCode,
  type ApiResponse,
  type AnswerRequest,
  type AnswerResponse,
  type WordStatePayload,
} from '@gll/api-contract';
import { LEARNING_CONFIG } from '../config/learning.js';
import { toGraduationPerformance } from '../review/graduation-performance.js';
import { logger } from '../logger.js';

const USER_ID = 'demo-user';

// Stateless (default FSRS params) — construct once, reuse across requests.
const scheduler = new FsrsScheduler();

const router = new Hono();

function toPayload(ws: WordState): WordStatePayload {
  return {
    wordId: ws.wordId,
    seen: ws.seen,
    correct: ws.correct,
    mastery: ws.mastery,
    correctStreak: ws.correctStreak,
    wrongStreak: ws.wrongStreak,
    lapses: ws.lapses,
  };
}

router.post('/answer', async (c) => {
  const correlationId = c.req.header('x-correlation-id') ?? null;
  const log = logger.child({ correlationId: correlationId ?? undefined });

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    log.warn('POST /api/answer: invalid JSON body');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  const req = payload as AnswerRequest;
  if (
    !req ||
    typeof req.wordId !== 'string' ||
    req.wordId === '' ||
    typeof req.correct !== 'boolean' ||
    typeof req.latencyMs !== 'number' ||
    !Number.isFinite(req.latencyMs) ||
    req.latencyMs < 0 ||
    (req.recheck !== undefined && typeof req.recheck !== 'boolean')
  ) {
    log.warn('POST /api/answer: invalid body');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'wordId, correct, latencyMs are required' },
    };
    return c.json(body, 400);
  }

  const now = new Date();
  const db = getDb();
  const store = new SqliteLearningStore(db);
  const runState = await store.getAllWordStates(USER_ID);
  const before = runState.get(req.wordId) ?? null;

  // Reuse the exact pure recheck branch so a re-asked missed word bumps
  // seen/correct only (mastery frozen), byte-identical to the client's fold.
  // recheck travels as a wire fact (like correct/latency), not server policy.
  const { runState: next } = processRecheckResult(
    req.wordId,
    req.correct,
    runState,
    req.recheck ? new Set([req.wordId]) : new Set(), // recheckPending
    new Set(),                                       // recheckReentered (WordState-irrelevant here)
    LEARNING_CONFIG.masteryThreshold,
    LEARNING_CONFIG.streakThresholds,
  );
  const after = next.get(req.wordId)!;

  await store.upsertWordState(USER_ID, after);

  const wasMastered = before ? isMastered(before, LEARNING_CONFIG.masteryThreshold) : false;
  const graduated = !wasMastered && isMastered(after, LEARNING_CONFIG.masteryThreshold);

  // Transition channel — fail-open: a diagnostics-write failure must not lose the answer.
  try {
    await new SqliteAnswerEventStore(db, log).appendAnswerEvent({
      correlationId,
      userId: USER_ID,
      wordId: req.wordId,
      correct: req.correct,
      latencyMs: req.latencyMs,
      beforeState: before,
      afterState: after,
      graduated,
      recheck: req.recheck ?? false,
      createdAt: now.toISOString(),
    });
  } catch {
    // Already logged by the store; state write stands.
  }

  // Review seeding — level-triggered: seed a card whenever the word is mastered
  // and has none yet. Gating on absence self-heals a transient failure on the next
  // mastered answer while skipping a wasted FSRS computation for already-seeded
  // words; seedReviewCard's idempotency still covers a concurrent double-seed.
  // Fail-open: the authoritative Learning write must not be lost to a seed failure.
  if (isMastered(after, LEARNING_CONFIG.masteryThreshold)) {
    try {
      const reviewStore = new SqliteReviewStore(db);
      if (!(await reviewStore.getReviewCard(USER_ID, after.wordId))) {
        const card = scheduler.seed(after.wordId, toGraduationPerformance(after), now);
        await reviewStore.seedReviewCard(USER_ID, card);
      }
    } catch (err) {
      log.error('review-card seed failed', {
        correlationId: correlationId ?? undefined,
        wordId: after.wordId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const body: ApiResponse<AnswerResponse> = {
    success: true,
    data: { wordState: toPayload(after), graduated },
  };
  return c.json(body);
});

export default router;
