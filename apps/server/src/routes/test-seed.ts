import { Hono } from 'hono';
import {
  getDb,
  SqliteContentStore,
  SqliteLearningStore,
  SqliteReviewStore,
} from '@gll/db';
import { DEFAULT_SHELVING_CONFIG, type ShelvingConfig } from '@gll/srs-shelving';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { WordState } from '@gll/srs-engine-v2';
import { FsrsScheduler, type GraduationPerformance } from '@gll/srs-review';
import { LEARNING_CONFIG } from '../config/learning.js';

const USER_ID = 'demo-user';
const scheduler = new FsrsScheduler();

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

interface ReviewCardInput {
  wordId: string;
  /** Graduation performance used to seed a realistic FSRS scheduler state. Defaults to a 'good' seed. */
  performance?: GraduationPerformance;
  /** Milliseconds to offset `due` from now; negative makes the card due already. Defaults to -1 day. */
  dueOffsetMs?: number;
  /**
   * Keep the FSRS-natural graduation `due` (the interval a freshly-mastered word
   * actually gets) instead of overriding it. Reproduces real graduation timing —
   * use this to verify "mastered N words → how many are due now?". Overrides dueOffsetMs.
   */
  naturalDue?: boolean;
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
  reviewCards?: ReviewCardInput[];
  config?: Partial<ShelvingConfig>;
}

/** Apply a full fixture: wipe the user's state, then insert every provided surface
 *  (word states, stagnation, shelving, review cards) and set config overrides.
 *  Shared by POST /test/seed (raw fixture) and POST /test/seed/scenario (presets). */
async function applyFixture(fixture: ScenarioFixture): Promise<void> {
  const db = getDb();
  const store = new SqliteLearningStore(db);
  const reviewStore = new SqliteReviewStore(db);

  // 1. Clear all word states (also clears shelving + stagnation via clearUserState)
  await store.clearUserState(USER_ID);

  // 1b. Clear existing review cards for this user (clearUserState doesn't own this table)
  db.$client.prepare('DELETE FROM review_cards WHERE user_id = ?').run(USER_ID);

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
    await store.upsertWordState(USER_ID, wordState);
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
    await store.shelveWord(USER_ID, fixture.deckId, sw.wordId, sw.shelvedAtBatch);
  }

  // 4b. Insert review cards — seeds a realistic FSRS scheduler state via FsrsScheduler,
  // then overrides `due` so callers don't have to graduate a word through /api/answer
  // and backdate the row by hand just to get a due card.
  const now = new Date();
  for (const rc of fixture.reviewCards ?? []) {
    const performance = rc.performance ?? { correctStreak: 2, lapses: 0, correctRatio: 1 };
    const card = scheduler.seed(rc.wordId, performance, now);
    // naturalDue keeps the FSRS graduation interval (real just-mastered timing);
    // otherwise override `due` for a deterministic already-due/not-due card.
    if (!rc.naturalDue) {
      const dueOffsetMs = rc.dueOffsetMs ?? -1000 * 60 * 60 * 24;
      card.due = new Date(now.getTime() + dueOffsetMs);
    }
    await reviewStore.upsertReviewCard(USER_ID, card);
  }

  // 5. Set shelving config override if provided
  if (fixture.config) {
    shelvingConfigOverride = fixture.config;
  }
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

  await applyFixture(fixture);
  const body: ApiResponse<null> = { success: true, data: null };
  return c.json(body);
});

// ---------------------------------------------------------------------------
// Named review scenarios — one-call presets that build the exact state we want to
// verify (auto-resolving real deck words), so callers don't hand-author fixtures.
// Reusable for manual verification AND e2e. Each returns the words used and the
// expected observable outcome so a caller/test can assert against it.
// ---------------------------------------------------------------------------

const REVIEW_SCENARIOS = ['mastered-fresh', 'mastered-due', 'review-only'] as const;
type ReviewScenario = (typeof REVIEW_SCENARIOS)[number];

interface ScenarioRequest {
  name: ReviewScenario;
  deckId?: string; // default: first deck
  count?: number; // words to seed; default 3
}

interface ScenarioResult {
  scenario: ReviewScenario;
  deckId: string;
  wordIds: string[];
  /** What the seeded state should produce, for manual/e2e assertions. */
  expected: { dueNow: number; anytime: number; reviewUnlocked: boolean };
}

// A "mastered" word state at the graduation threshold — the state a graduated word
// carries, so the review-unlock gate and the review card stay consistent.
function masteredWordState(wordId: string): WordStateInput {
  const m = LEARNING_CONFIG.masteryThreshold;
  return { wordId, seen: m + 1, correct: m + 1, mastery: m, correctStreak: m, wrongStreak: 0, lapses: 0 };
}

router.post('/test/seed/scenario', async (c) => {
  let reqBody: ScenarioRequest;
  try {
    reqBody = (await c.req.json()) as ScenarioRequest;
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  if (!reqBody?.name || !REVIEW_SCENARIOS.includes(reqBody.name)) {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: `name must be one of: ${REVIEW_SCENARIOS.join(', ')}`,
      },
    };
    return c.json(body, 400);
  }

  const content = new SqliteContentStore(getDb());
  const deck = reqBody.deckId
    ? await content.getDeck(reqBody.deckId)
    : (await content.getDecks())[0];
  if (!deck) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.NOT_FOUND, message: 'no deck found to seed from' },
    };
    return c.json(body, 404);
  }

  const count = Math.max(1, reqBody.count ?? 3);
  const wordIds = deck.words.slice(0, count).map((w) => w.id);
  if (wordIds.length === 0) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'deck has no words to seed' },
    };
    return c.json(body, 400);
  }

  const fixture: ScenarioFixture = {
    name: reqBody.name,
    description: `review scenario: ${reqBody.name}`,
    deckId: deck.id,
    wordStates: [],
    stagnationCounters: [],
    shelvedWords: [],
    reviewCards: [],
  };
  let expected: ScenarioResult['expected'];

  switch (reqBody.name) {
    // Freshly mastered today: mastered word states + review cards at the real FSRS
    // graduation due (future). Nothing due yet; all N practisable via anytime.
    case 'mastered-fresh':
      fixture.wordStates = wordIds.map(masteredWordState);
      fixture.reviewCards = wordIds.map((wordId) => ({ wordId, naturalDue: true }));
      expected = { dueNow: 0, anytime: wordIds.length, reviewUnlocked: true };
      break;
    // Mastered and their due date has arrived: all N are due now (verifies the due
    // list is uncapped — mastering N never yields "only 1").
    case 'mastered-due':
      fixture.wordStates = wordIds.map(masteredWordState);
      fixture.reviewCards = wordIds.map((wordId) => ({ wordId })); // default: already due
      expected = { dueNow: wordIds.length, anytime: wordIds.length, reviewUnlocked: true };
      break;
    // Review cards but NO mastered word state (EP39-BUG01 repro): Review must unlock
    // from card existence alone. All N due now.
    case 'review-only':
      fixture.reviewCards = wordIds.map((wordId) => ({ wordId })); // default: already due
      expected = { dueNow: wordIds.length, anytime: wordIds.length, reviewUnlocked: true };
      break;
  }

  await applyFixture(fixture);
  const data: ScenarioResult = { scenario: reqBody.name, deckId: deck.id, wordIds, expected };
  const body: ApiResponse<ScenarioResult> = { success: true, data };
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
