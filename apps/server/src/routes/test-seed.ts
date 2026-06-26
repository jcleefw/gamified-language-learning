import { Hono } from 'hono';
import { getDb, SqliteLearningStore } from '@gll/db';
import { DEFAULT_SHELVING_CONFIG, type ShelvingConfig } from '@gll/srs-shelving';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { WordState } from '@gll/srs-engine-v2';

const USER_ID = 'demo-user';

// Module-level config override — null means use DEFAULT_SHELVING_CONFIG
let configOverride: Partial<ShelvingConfig> | null = null;

export function getEffectiveShelvingConfig(): ShelvingConfig {
  if (!configOverride) return DEFAULT_SHELVING_CONFIG;
  return { ...DEFAULT_SHELVING_CONFIG, ...configOverride };
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

  // 5. Set config override if provided
  if (fixture.config) {
    configOverride = fixture.config;
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

  configOverride = payload;
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

router.delete('/test/config/shelving', (c) => {
  configOverride = null;
  return c.body(null, 204);
});

router.get('/test/config/shelving', (c) => {
  const effective = getEffectiveShelvingConfig();
  const body: ApiResponse<ShelvingConfig> = { success: true, data: effective };
  return c.json(body);
});

export default router;
