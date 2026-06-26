import { Hono } from 'hono';
import { getDb, SqliteLearningStore } from '@gll/db';
import {
  ErrorCode,
  type ApiResponse,
  type GetShelvedWordsResponse,
  type GetStagnantWordsResponse,
  type ShelvedWordPayload,
  type ApplyShelvingRequest,
  type UnshelveAllRequest,
  type UpdateStagnationCountersRequest,
  type ResetStagnationCountersRequest,
} from '@gll/api-contract';

const USER_ID = 'demo-user';

const router = new Hono();

function getStore() {
  return new SqliteLearningStore(getDb());
}

router.get('/shelving', (c) => {
  const deckId = c.req.query('deckId');
  if (!deckId) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId query param is required' },
    };
    return c.json(body, 400);
  }

  const shelvedWords = getStore().getShelvedWords(USER_ID, deckId);
  const data: GetShelvedWordsResponse = shelvedWords.map(
    (sw): ShelvedWordPayload => ({
      wordId: sw.wordId,
      shelvedAtBatch: sw.shelvedAtBatch,
    }),
  );
  const body: ApiResponse<GetShelvedWordsResponse> = { success: true, data };
  return c.json(body);
});

router.post('/shelving/apply', async (c) => {
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

  const req = payload as ApplyShelvingRequest;
  if (!req?.deckId || !Array.isArray(req.toShelve)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId and toShelve array are required' },
    };
    return c.json(body, 400);
  }

  const store = getStore();
  for (const { wordId, batchNum } of req.toShelve) {
    store.shelveWord(USER_ID, req.deckId, wordId, batchNum);
  }

  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.post('/shelving/unshelve-all', async (c) => {
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

  const req = payload as UnshelveAllRequest;
  if (!req?.deckId) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId is required' },
    };
    return c.json(body, 400);
  }

  getStore().unshelveAllWords(USER_ID, req.deckId);
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

// ---------------------------------------------------------------------------
// Stagnation counter routes
// ---------------------------------------------------------------------------

router.post('/stagnation/update', async (c) => {
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

  const req = payload as UpdateStagnationCountersRequest;
  if (!req?.deckId || !Array.isArray(req.activeWordIds)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId and activeWordIds are required' },
    };
    return c.json(body, 400);
  }

  getStore().updateStagnationCounters(USER_ID, req.deckId, req.activeWordIds);
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.get('/stagnation/stagnant', (c) => {
  const deckId = c.req.query('deckId');
  const thresholdParam = c.req.query('threshold');

  if (!deckId || !thresholdParam) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId and threshold query params are required' },
    };
    return c.json(body, 400);
  }

  const threshold = parseInt(thresholdParam, 10);
  if (isNaN(threshold) || threshold < 1) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'threshold must be a positive integer' },
    };
    return c.json(body, 400);
  }

  const stagnantWordIds = getStore().getStagnantWords(USER_ID, deckId, threshold);
  const data: GetStagnantWordsResponse = { stagnantWordIds };
  const body: ApiResponse<GetStagnantWordsResponse> = { success: true, data };
  return c.json(body);
});

router.post('/stagnation/reset', async (c) => {
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

  const req = payload as ResetStagnationCountersRequest;
  if (!req?.deckId) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId is required' },
    };
    return c.json(body, 400);
  }

  getStore().resetStagnationCounters(USER_ID, req.deckId);
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

export default router;
