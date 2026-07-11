import { Hono } from 'hono';
import {
  getDb,
  SqliteLearningStore,
  SqliteAnswerEventStore,
  SqliteReviewStore,
  SqliteUserConfigStore,
  type ResolvedThresholds,
} from '@gll/db';
import { isMastered, type WordState } from '@gll/srs-engine-v2';
import { FsrsScheduler } from '@gll/srs-review';
import { applyAnswer } from '../learning/apply-answer.js';
import {
  ErrorCode,
  type ApiResponse,
  type AnswerRequest,
  type AnswerResponse,
  type WordStatePayload,
} from '@gll/api-contract';
import { FIXED_SYSTEM, resolveUserThresholds } from '../config/learning.js';
import { toGraduationPerformance } from '../review/graduation-performance.js';
import { getCurrentUserId } from '../identity/current-user.js';
import { logger } from '../logger.js';

const USER_ID = getCurrentUserId();

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

  // Difficulty (T1) takes effect HERE, on the authoritative transition: the mastery
  // bar is the FIXED T3 value (same finish line for everyone), while streak
  // forgiveness is the current user's resolved preset. Only `normal` ships today, so
  // this is byte-identical for the default user — but the wiring is complete, so
  // `gentle`/`intense` will apply with no further change to this path.
  const thresholds: ResolvedThresholds = {
    masteryThreshold: FIXED_SYSTEM.masteryThreshold,
    streakThresholds: await resolveUserThresholds(new SqliteUserConfigStore(db), USER_ID),
  };

  // The one shared Learning transition — the same pure fold artifact-replay runs, so
  // replay parity holds by construction. `recheck` travels as a wire fact (like
  // correct/latency), not server policy; a re-asked missed word bumps seen/correct only.
  const { before, after, graduated } = await applyAnswer(
    store,
    USER_ID,
    { wordId: req.wordId, correct: req.correct, latencyMs: req.latencyMs, recheck: req.recheck ?? false },
    thresholds,
  );

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
      resolvedThresholds: thresholds,
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
  if (isMastered(after, thresholds.masteryThreshold)) {
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
