import { Hono } from 'hono';
import { getDb, SqliteLearningStore, SqliteAnswerEventStore } from '@gll/db';
import { updateRunState, isMastered, type WordState } from '@gll/srs-engine-v2';
import {
  ErrorCode,
  type ApiResponse,
  type AnswerRequest,
  type AnswerResponse,
  type WordStatePayload,
} from '@gll/api-contract';
import { LEARNING_CONFIG } from '../config/learning.js';
import { logger } from '../logger.js';

const USER_ID = 'demo-user';

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
    req.latencyMs < 0
  ) {
    log.warn('POST /api/answer: invalid body');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'wordId, correct, latencyMs are required' },
    };
    return c.json(body, 400);
  }

  const store = new SqliteLearningStore(getDb());
  const runState = await store.getAllWordStates(USER_ID);
  const before = runState.get(req.wordId) ?? null;

  const next = updateRunState(runState, req.wordId, req.correct, LEARNING_CONFIG.streakThresholds);
  const after = next.get(req.wordId)!;

  await store.upsertWordState(USER_ID, after);

  const wasMastered = before ? isMastered(before, LEARNING_CONFIG.masteryThreshold) : false;
  const graduated = !wasMastered && isMastered(after, LEARNING_CONFIG.masteryThreshold);

  // Transition channel — fail-open: a diagnostics-write failure must not lose the answer.
  try {
    await new SqliteAnswerEventStore(getDb(), log).appendAnswerEvent({
      correlationId,
      userId: USER_ID,
      wordId: req.wordId,
      correct: req.correct,
      latencyMs: req.latencyMs,
      beforeState: before,
      afterState: after,
      graduated,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Already logged by the store; state write stands.
  }

  const body: ApiResponse<AnswerResponse> = {
    success: true,
    data: { wordState: toPayload(after), graduated },
  };
  return c.json(body);
});

export default router;
