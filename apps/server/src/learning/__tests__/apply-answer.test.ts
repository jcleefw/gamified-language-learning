import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import { processRecheckResult, type WordState } from '@gll/srs-engine-v2';
import { applyAnswer } from '../apply-answer.js';

type Store = SqliteLearningStore;

const THRESHOLDS = {
  masteryThreshold: 2,
  streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
};

function makeStore(): Store {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema }) as ReturnType<typeof drizzle<typeof schema>>;
  return new SqliteLearningStore(db);
}

/** The engine result applyAnswer must reproduce, computed via the same pure path it uses. */
function expectedAfter(
  runState: Map<string, WordState>,
  wordId: string,
  correct: boolean,
  recheck: boolean,
): WordState {
  const { runState: next } = processRecheckResult(
    wordId,
    correct,
    runState,
    recheck ? new Set([wordId]) : new Set(),
    new Set(),
    THRESHOLDS.masteryThreshold,
    THRESHOLDS.streakThresholds,
  );
  return next.get(wordId)!;
}

describe('applyAnswer', () => {
  let store: Store;
  beforeEach(() => {
    store = makeStore();
  });

  it('transitions a fresh word on a correct answer and persists the authoritative state', async () => {
    const result = await applyAnswer(
      store,
      'u1',
      { wordId: 'w1', correct: true, latencyMs: 100, recheck: false },
      THRESHOLDS,
    );

    const expected = expectedAfter(new Map(), 'w1', true, false);
    expect(result.before).toBeNull();
    expect(result.after).toEqual(expected);
    expect(result.graduated).toBe(false);

    const persisted = await store.getAllWordStates('u1');
    expect(persisted.get('w1')).toEqual(expected);
  });

  it('freezes mastery/streak on a recheck answer (bumps seen/correct only)', async () => {
    // Seed a word that has been missed once (mastery 0, wrongStreak 1).
    const seeded: WordState = {
      wordId: 'w2',
      seen: 1,
      correct: 0,
      mastery: 0,
      correctStreak: 0,
      wrongStreak: 1,
      lapses: 1,
    };
    await store.upsertWordState('u1', seeded);

    const result = await applyAnswer(
      store,
      'u1',
      { wordId: 'w2', correct: true, latencyMs: 100, recheck: true },
      THRESHOLDS,
    );

    // Recheck: seen/correct bump, everything else frozen.
    expect(result.after).toEqual({
      ...seeded,
      seen: seeded.seen + 1,
      correct: seeded.correct + 1,
    });
    expect(result.before).toEqual(seeded);
    expect(result.graduated).toBe(false);
  });

  it('reports graduation exactly on the mastery-threshold crossing', async () => {
    const graduated: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await applyAnswer(
        store,
        'u1',
        { wordId: 'w3', correct: true, latencyMs: 100, recheck: false },
        THRESHOLDS,
      );
      graduated.push(r.graduated);
    }
    // mastery 0→1→2; graduated only on the crossing (3rd correct).
    expect(graduated).toEqual([false, false, true]);
  });
});
