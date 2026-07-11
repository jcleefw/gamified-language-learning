import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initDb,
  schema,
  SqliteLearningStore,
  SqliteReviewStore,
  SqliteUserConfigStore,
} from '@gll/db';
import { DIFFICULTY_PRESETS } from '../config/difficulty-presets.js';
import { seedDemoUser } from '../seed/seed-db.js';
import { updateRunState } from '@gll/srs-engine-v2';
import { FsrsScheduler } from '@gll/srs-review';
import type { AnswerResponse, ApiResponse, WordStatePayload } from '@gll/api-contract';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

beforeEach(() => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  testDb = drizzle(sqlite, { schema }) as TestDb;
});

const { default: app } = await import('../app.js');

async function post(body: unknown): Promise<Response> {
  return app.request('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/answer', () => {
  it('runs the transition server-side, returns and persists the authoritative state', async () => {
    const res = await post({ wordId: 'w1', correct: true, latencyMs: 1200 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    expect(body.success).toBe(true);
    if (!body.success) throw new Error('expected success');

    const expected = updateRunState(new Map(), 'w1', true, {
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    }).get('w1');

    const expectedPayload: WordStatePayload = {
      wordId: 'w1',
      seen: expected!.seen,
      correct: expected!.correct,
      mastery: expected!.mastery,
      correctStreak: expected!.correctStreak,
      wrongStreak: expected!.wrongStreak,
      lapses: expected!.lapses,
    };

    expect(body.data.wordState).toEqual(expectedPayload);
    expect(body.data.graduated).toBe(false);

    // Persisted for demo-user
    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('w1')).toEqual(expected);
  });

  it('graduates on the 3rd consecutive correct (mastery 0→1→2)', async () => {
    const graduated: boolean[] = [];
    const masteries: number[] = [];

    for (let i = 0; i < 3; i++) {
      const res = await post({ wordId: 'w2', correct: true, latencyMs: 1000 });
      const body = (await res.json()) as ApiResponse<AnswerResponse>;
      if (!body.success) throw new Error('expected success');
      graduated.push(body.data.graduated);
      masteries.push(body.data.wordState.mastery);
    }

    expect(masteries).toEqual([0, 1, 2]);
    expect(graduated).toEqual([false, false, true]);
  });

  it('wrong answer: not graduated, wrongStreak advances per engine', async () => {
    const res = await post({ wordId: 'w3', correct: false, latencyMs: 8000 });
    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    if (!body.success) throw new Error('expected success');

    const expected = updateRunState(new Map(), 'w3', false, {
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    }).get('w3');

    expect(body.data.graduated).toBe(false);
    expect(body.data.wordState.wrongStreak).toBe(expected!.wrongStreak);
    expect(body.data.wordState.correctStreak).toBe(0);
    expect(body.data.wordState.mastery).toBe(expected!.mastery);
  });

  it('rejects invalid bodies with 400 and leaves persisted state unchanged', async () => {
    const invalid: unknown[] = [
      { wordId: '', correct: true, latencyMs: 100 },
      { wordId: 'w4', correct: 'yes', latencyMs: 100 },
      { wordId: 'w4', correct: true, latencyMs: -1 },
      { wordId: 'w4', correct: true },
      { correct: true, latencyMs: 100 },
    ];

    for (const body of invalid) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }

    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.size).toBe(0);
  });

  it('fails open when the transition-channel append fails (state still persisted)', async () => {
    // Drop the events table so appendAnswerEvent throws inside the route.
    testDb.$client.exec('DROP TABLE answer_events');

    const res = await post({ wordId: 'w5', correct: true, latencyMs: 900 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.wordState.wordId).toBe('w5');

    // State write is intact despite the event-append failure.
    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('w5')?.seen).toBe(1);
  });

  // --- ST06: server-side Review seeding on graduation ---

  async function answerCorrect(wordId: string): Promise<ApiResponse<AnswerResponse>> {
    const res = await post({ wordId, correct: true, latencyMs: 1000 });
    return (await res.json()) as ApiResponse<AnswerResponse>;
  }

  it('does not seed a review card before the word is mastered', async () => {
    await answerCorrect('g1'); // mastery 0
    await answerCorrect('g1'); // mastery 1 — not yet mastered (threshold 2)

    const cards = await new SqliteReviewStore(testDb).getAllReviewCards('demo-user');
    expect(cards).toEqual([]);
  });

  it('graduation seeds exactly one review card', async () => {
    const before = Date.now();
    await answerCorrect('g2');
    await answerCorrect('g2');
    await answerCorrect('g2'); // 3rd correct → mastery 2 → graduated

    const cards = await new SqliteReviewStore(testDb).getAllReviewCards('demo-user');
    expect(cards).toHaveLength(1);
    expect(cards[0].wordId).toBe('g2');
    expect(cards[0].due).toBeInstanceOf(Date);
    expect(cards[0].due.getTime()).toBeGreaterThan(before);
    expect(cards[0].schedulerData).toBeTruthy();
  });

  it('seeded card is produced by FsrsScheduler with the inferred graduation rating', async () => {
    await answerCorrect('g3');
    await answerCorrect('g3');
    await answerCorrect('g3'); // graduates at correctStreak 3, lapses 0, ratio 1

    const cards = await new SqliteReviewStore(testDb).getAllReviewCards('demo-user');
    const seeded = cards[0].schedulerData as { stability: number; difficulty: number };

    // stability/difficulty are rating-determined and now-independent; matching a
    // reference seed proves the correct GraduationPerformance was inferred.
    const reference = new FsrsScheduler().seed(
      'ref',
      { correctStreak: 3, lapses: 0, correctRatio: 1 },
      new Date(),
    ).schedulerData as { stability: number; difficulty: number };

    expect(seeded.stability).toBe(reference.stability);
    expect(seeded.difficulty).toBe(reference.difficulty);
  });

  it('is idempotent and keeps graduated edge-triggered on continued correct answers', async () => {
    await answerCorrect('g4');
    await answerCorrect('g4');
    await answerCorrect('g4'); // graduates

    const store = new SqliteReviewStore(testDb);
    const afterGraduation = await store.getReviewCard('demo-user', 'g4');

    const fourth = await answerCorrect('g4');
    const fifth = await answerCorrect('g4');

    const cards = await store.getAllReviewCards('demo-user');
    expect(cards).toHaveLength(1); // no duplicate

    const now = await store.getReviewCard('demo-user', 'g4');
    expect(now!.due.getTime()).toBe(afterGraduation!.due.getTime()); // not reset
    expect(now!.schedulerData).toEqual(afterGraduation!.schedulerData);

    // graduated is edge-triggered: false once already mastered, despite level-triggered seeding
    expect(fourth.success && fourth.data.graduated).toBe(false);
    expect(fifth.success && fifth.data.graduated).toBe(false);
  });

  it('fails open on seed failure and self-heals on the next mastered answer', async () => {
    const ddl = (
      testDb.$client
        .prepare("SELECT sql FROM sqlite_master WHERE name = 'review_cards'")
        .get() as { sql: string }
    ).sql;

    await answerCorrect('g5');
    await answerCorrect('g5');

    // Break the seed target just before the graduating answer.
    testDb.$client.exec('DROP TABLE review_cards');
    const graduating = await answerCorrect('g5'); // seed throws → fail-open
    expect(graduating.success).toBe(true);

    // Learning state is intact despite the seed failure.
    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('g5')?.mastery).toBe(2);

    // Restore the table; the next mastered answer self-heals the missing card.
    testDb.$client.exec(ddl);
    const heal = await answerCorrect('g5');
    expect(heal.success).toBe(true);

    const cards = await new SqliteReviewStore(testDb).getAllReviewCards('demo-user');
    expect(cards.map((c) => c.wordId)).toEqual(['g5']);
  });

  it('does not affect the legacy POST /api/state/word path', async () => {
    const res = await app.request('/api/state/word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: 'legacy', seen: 3, correct: 2, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0 }),
    });
    expect(res.status).toBe(200);

    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('legacy')?.mastery).toBe(1);
  });
});

// --- EP41-ST06: per-user difficulty is applied on the transition ---
describe('POST /api/answer applies the current user\'s difficulty preset', () => {
  it('uses the per-user resolved streakThresholds while the mastery bar stays fixed', async () => {
    // Inject a selectable second preset (masters in ONE correct — normal needs two).
    // DIFFICULTY_PRESETS is the mutable source the write path + transition both read,
    // so this exercises real per-user resolution without shipping gentle/intense.
    DIFFICULTY_PRESETS.intense = {
      correctStreakThreshold: 1,
      wrongStreakThreshold: 5,
      maxMastery: 2, // fixed scale — identical to normal's, never tuned per preset
    };
    try {
      seedDemoUser(testDb); // put targets an existing users row
      await new SqliteUserConfigStore(testDb).put('demo-user', {
        difficultyPreset: 'intense',
      });

      // One correct answer: intense (threshold 1) → mastery 1; normal (threshold 2)
      // would still be mastery 0. The divergence proves the per-user bundle applied.
      const res = await post({ wordId: 'wi', correct: true, latencyMs: 1000 });
      const body = (await res.json()) as ApiResponse<AnswerResponse>;
      if (!body.success) throw new Error('expected success');
      expect(body.data.wordState.mastery).toBe(1);
      expect(body.data.wordState.correctStreak).toBe(1);

      // maxMastery/mastery bar are the fixed T3 value regardless of preset.
      const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
      expect(persisted.get('wi')?.mastery).toBe(1);
    } finally {
      delete DIFFICULTY_PRESETS.intense; // don't leak the injected preset to other tests
    }
  });
});
