import { Hono } from 'hono';
import { getDb, SqliteLearningStore } from '@gll/db';
import { ErrorCode, type ApiResponse, type GetStateResponse, type UpsertWordStateRequest, type WordStatePayload } from '@gll/api-contract';
import type { WordState } from '@gll/srs-engine-v2';
import { getCurrentUserId } from '../identity/current-user.js';

const USER_ID = getCurrentUserId();

const router = new Hono();

function getStore() {
  return new SqliteLearningStore(getDb());
}

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

router.get('/state', async (c) => {
  const runState = await getStore().getAllWordStates(USER_ID);
  const words: WordStatePayload[] = Array.from(runState.values()).map(toPayload);
  const body: ApiResponse<GetStateResponse> = { success: true, data: { words } };
  return c.json(body);
});

router.post('/state/word', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  const req = payload as UpsertWordStateRequest;
  if (!req || typeof req.wordId !== 'string' || req.wordId === '') {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'wordId is required' },
    };
    return c.json(body, 400);
  }

  const ws: WordState = {
    wordId: req.wordId,
    seen: req.seen ?? 0,
    correct: req.correct ?? 0,
    mastery: req.mastery ?? 0,
    correctStreak: req.correctStreak ?? 0,
    wrongStreak: req.wrongStreak ?? 0,
    lapses: req.lapses ?? 0,
  };

  await getStore().upsertWordState(USER_ID, ws);

  const body: ApiResponse<WordStatePayload> = { success: true, data: toPayload(ws) };
  return c.json(body);
});

router.delete('/state', async (c) => {
  await getStore().clearUserState(USER_ID);
  return c.body(null, 204);
});

export default router;
