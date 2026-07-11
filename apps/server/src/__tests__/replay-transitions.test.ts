import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb,
  schema,
  SqliteAnswerEventStore,
  SqliteReviewTransitionEventStore,
  SqliteReviewAnswerEventStore,
  SqliteReviewStore,
  type DbClient,
} from '@gll/db';
import { FsrsScheduler, type ReviewCard } from '@gll/srs-review';
import type { WordState } from '@gll/srs-engine-v2';
import { DEFAULT_LEARNING } from '../config/learning.js';
import {
  loadLearningRows,
  replayLearningRows,
  loadRevisionRows,
  replayRevisionRows,
  buildFixture,
} from '../tooling/replay-transitions.js';

let db: DbClient;
beforeEach(() => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  db = drizzle(sqlite, { schema }) as DbClient;
});

const USER = 'demo-user';
const scheduler = new FsrsScheduler();

const ws = (o: Partial<WordState> = {}): WordState => ({
  wordId: 'w1', seen: 1, correct: 1, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0, ...o,
});

// Fold a raw answer through the pure engine the same way the server does, to
// generate a FAITHFUL before/after pair for the fixtures.
function foldAnswer(before: WordState | null, correct: boolean): WordState {
  const rows = replayLearningRows(
    [{ correlationId: null, wordId: 'w1', correct, recheck: false, beforeState: before, afterState: ws() }],
    DEFAULT_LEARNING,
  );
  return rows[0].recomputed as WordState;
}

describe('replay harness — Learning (answer_events)', () => {
  it('reproduces every recorded after_state byte-identically', async () => {
    const store = new SqliteAnswerEventStore(db);
    // Two chained answers on w1 (before → after → after2), each recorded faithfully.
    const before1 = ws({ seen: 1, correct: 1, mastery: 1, correctStreak: 1 });
    const after1 = foldAnswer(before1, true);
    const after2 = foldAnswer(after1, false);
    await store.appendAnswerEvent({
      correlationId: 'c1', userId: USER, wordId: 'w1', correct: true, latencyMs: 0,
      beforeState: before1, afterState: after1, graduated: false, recheck: false,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
    await store.appendAnswerEvent({
      correlationId: 'c2', userId: USER, wordId: 'w1', correct: false, latencyMs: 0,
      beforeState: after1, afterState: after2, graduated: false, recheck: false,
      createdAt: '2026-07-10T00:00:01.000Z',
    });

    const results = replayLearningRows(loadLearningRows(db), DEFAULT_LEARNING);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.matched)).toBe(true);

    const fixture = buildFixture('learning', results);
    expect(fixture.allMatched).toBe(true);
    expect(fixture.firstDivergence).toBeNull();
  });

  it('reports the first divergence when a recorded after_state was corrupted', async () => {
    const store = new SqliteAnswerEventStore(db);
    const before = ws({ seen: 1, correct: 1, mastery: 1, correctStreak: 1 });
    await store.appendAnswerEvent({
      correlationId: 'c1', userId: USER, wordId: 'w1', correct: true, latencyMs: 0,
      beforeState: before,
      afterState: ws({ mastery: 99 }), // tampered — not what the engine would produce
      graduated: false, recheck: false, createdAt: '2026-07-10T00:00:00.000Z',
    });

    const fixture = buildFixture('learning', replayLearningRows(loadLearningRows(db), DEFAULT_LEARNING));
    expect(fixture.allMatched).toBe(false);
    expect(fixture.firstDivergence?.correlationId).toBe('c1');
  });

  it('filters to a correlation-id set', async () => {
    const store = new SqliteAnswerEventStore(db);
    for (const id of ['c1', 'c2', 'c3']) {
      const before = ws();
      await store.appendAnswerEvent({
        correlationId: id, userId: USER, wordId: 'w1', correct: true, latencyMs: 0,
        beforeState: before, afterState: foldAnswer(before, true), graduated: false, recheck: false,
        createdAt: '2026-07-10T00:00:00.000Z',
      });
    }
    const rows = loadLearningRows(db, ['c2']);
    expect(rows.map((r) => r.correlationId)).toEqual(['c2']);
  });
});

describe('replay harness — Revision (review_transition_events)', () => {
  async function seedDueCardAndAnswer(wordId: string, correlationId: string, correct: boolean) {
    const now = new Date('2026-07-10T00:00:00.000Z');
    const seeded = scheduler.seed(wordId, { correctStreak: 3, lapses: 0, correctRatio: 1 }, now);
    const before: ReviewCard = { ...seeded, due: new Date(now.getTime() - 1000) }; // due
    await new SqliteReviewStore(db).upsertReviewCard(USER, before);

    const rating = correct ? 'good' : 'again';
    const advanced = scheduler.schedule(before, rating, now);
    // Record exactly what POST /api/reviews/answer records: answer row (rating) + transition row.
    await new SqliteReviewAnswerEventStore(db).appendReviewAnswerEvent({
      correlationId, userId: USER, wordId, correct, latencyMs: 0, questionType: 'mcq',
      rating, createdAt: now.toISOString(),
    });
    await new SqliteReviewTransitionEventStore(db).appendReviewTransitionEvent({
      correlationId, userId: USER, wordId, beforeCard: before, afterCard: advanced,
      createdAt: now.toISOString(),
    });
  }

  it('reproduces every recorded after_card byte-identically, joining rating from the answer log', async () => {
    await seedDueCardAndAnswer('w1', 'c1', true);
    await seedDueCardAndAnswer('w2', 'c2', false);

    const results = replayRevisionRows(loadRevisionRows(db));
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.matched)).toBe(true);
    expect(buildFixture('revision', results).allMatched).toBe(true);
  });

  it('reports a divergence when the after_card was corrupted', async () => {
    await seedDueCardAndAnswer('w1', 'c1', true);
    // Corrupt the stored after_card.
    db.$client.exec(
      `UPDATE review_transition_events SET after_card = '{"wordId":"w1","due":"2099-01-01T00:00:00.000Z","schedulerData":{}}'`,
    );
    const fixture = buildFixture('revision', replayRevisionRows(loadRevisionRows(db)));
    expect(fixture.allMatched).toBe(false);
    expect(fixture.firstDivergence?.wordId).toBe('w1');
  });
});
