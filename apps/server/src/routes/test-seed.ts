import { Hono } from 'hono';
import { getDb, SqliteLearningStore } from '@gll/db';
import { DEFAULT_SHELVING_CONFIG, type ShelvingConfig } from '@gll/srs-shelving';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { WordState } from '@gll/srs-engine-v2';

const USER_ID = 'demo-user';

// Module-level config overrides
let shelvingConfigOverride: Partial<ShelvingConfig> | null = null;
let sentenceConfigOverride: Partial<{
  sentenceScheduling: { minSeenForSentence?: number; sentenceBatchGap?: number };
  sentenceGraduation: { sentenceCorrectStreakThreshold?: number; sentenceWrongStreakThreshold?: number };
  sentenceDirections?: string[];
}> | null = null;

export function getEffectiveShelvingConfig(): ShelvingConfig {
  if (!shelvingConfigOverride) return DEFAULT_SHELVING_CONFIG;
  return { ...DEFAULT_SHELVING_CONFIG, ...shelvingConfigOverride };
}

export function getEffectiveSentenceConfig() {
  return sentenceConfigOverride;
}

interface StagnationCounterInput {
  wordId: string;
  count: number;
  lastBoundaryMastery: number;
}

interface ShelvedWordInput {
  wordId: string;
  shelvedAtBatch: number;
}

interface WordStateInput {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number;
}

interface ScenarioFixture {
  name: string;
  description: string;
  deckId: string;
  wordStates: WordStateInput[];
  stagnationCounters: StagnationCounterInput[];
  shelvedWords: ShelvedWordInput[];
  config?: Partial<ShelvingConfig>;
}

const router = new Hono();

router.post('/test/seed', async (c) => {
  let fixture: ScenarioFixture;
  try {
    fixture = (await c.req.json()) as ScenarioFixture;
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  if (!fixture?.deckId || !Array.isArray(fixture.wordStates)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deckId and wordStates are required' },
    };
    return c.json(body, 400);
  }

  const db = getDb();
  const store = new SqliteLearningStore(db);

  // 1. Clear all word states (also clears shelving + stagnation via clearUserState)
  store.clearUserState(USER_ID);

  // 2. Insert word states
  for (const ws of fixture.wordStates) {
    const wordState: WordState = {
      wordId: ws.wordId,
      seen: ws.seen,
      correct: ws.correct,
      mastery: ws.mastery,
      correctStreak: ws.correctStreak,
      wrongStreak: ws.wrongStreak,
      lapses: ws.lapses,
    };
    store.upsertWordState(USER_ID, wordState);
  }

  // 3. Insert stagnation counters directly via raw SQL
  const sqlite = db.$client;
  for (const counter of fixture.stagnationCounters ?? []) {
    sqlite
      .prepare(
        `INSERT INTO user_deck_word_tracking (user_id, deck_id, word_id, stagnation_count, last_boundary_mastery)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, deck_id, word_id) DO UPDATE SET
           stagnation_count = excluded.stagnation_count,
           last_boundary_mastery = excluded.last_boundary_mastery`,
      )
      .run(USER_ID, fixture.deckId, counter.wordId, counter.count, counter.lastBoundaryMastery);
  }

  // 4. Insert shelved words
  for (const sw of fixture.shelvedWords ?? []) {
    store.shelveWord(USER_ID, fixture.deckId, sw.wordId, sw.shelvedAtBatch);
  }

  // 5. Set shelving config override if provided
  if (fixture.config) {
    shelvingConfigOverride = fixture.config;
  }

  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.post('/test/config/shelving', async (c) => {
  let payload: Partial<ShelvingConfig>;
  try {
    payload = (await c.req.json()) as Partial<ShelvingConfig>;
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  shelvingConfigOverride = payload;
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.delete('/test/config/shelving', (c) => {
  shelvingConfigOverride = null;
  return c.body(null, 204);
});

router.post('/test/config/sentence', async (c) => {
  let payload: Partial<{
    sentenceScheduling: { minSeenForSentence?: number; sentenceBatchGap?: number };
    sentenceGraduation: { sentenceCorrectStreakThreshold?: number; sentenceWrongStreakThreshold?: number };
    sentenceDirections?: string[];
  }>;
  try {
    payload = (await c.req.json()) as typeof payload;
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  sentenceConfigOverride = payload;
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.delete('/test/config/sentence', (c) => {
  sentenceConfigOverride = null;
  return c.body(null, 204);
});

router.get('/test/config/sentence', (c) => {
  const effective = getEffectiveSentenceConfig();
  const body: ApiResponse<typeof effective> = { success: true, data: effective };
  return c.json(body);
});

router.get('/test/config/shelving', (c) => {
  const effective = getEffectiveShelvingConfig();
  const body: ApiResponse<ShelvingConfig> = { success: true, data: effective };
  return c.json(body);
});

export default router;
