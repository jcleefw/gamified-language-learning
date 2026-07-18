import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { schema, initDb, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-engine/review';
import type { MCQQuestion } from '@gll/srs-engine/learn';
import type { IReviewStore } from '@gll/db';
import type { ReviewCard } from '@gll/srs-engine/review';
import {
  runReviewSession,
  loadDueCards,
  type ReviewAnswerProvider,
} from '../review-runner-db.js';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:') as unknown as BetterSqlite3.Database;
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const USER = 'cli-user';
const NOW = new Date('2026-07-08T00:00:00.000Z');

function fakeQuestion(wordId: string): MCQQuestion {
  return {
    kind: 'mcq',
    wordId,
    direction: 'native-to-english',
    prompt: wordId,
    choices: [
      { label: 'a', value: 'right', isCorrect: true },
      { label: 'b', value: 'wrong', isCorrect: false },
    ],
  };
}

/** Provider that answers every question with a fixed correctness + latency. */
function fixedProvider(correct: boolean, latencyMs: number): ReviewAnswerProvider {
  return { answer: () => Promise.resolve({ correct, latencyMs }) };
}

describe('runReviewSession', () => {
  let store: SqliteReviewStore;
  let scheduler: FsrsScheduler;

  beforeEach(async () => {
    store = new SqliteReviewStore(makeTestDb());
    scheduler = new FsrsScheduler();
  });

  async function seedDue(wordId: string): Promise<ReviewCard> {
    const card = { ...scheduler.seed(wordId, { correctStreak: 3, lapses: 0, correctRatio: 1 }, NOW), due: NOW };
    await store.upsertReviewCard(USER, card);
    return card;
  }

  it('reschedules and persists each answered card (write-on-answer)', async () => {
    await seedDue('w1');
    await seedDue('w2');
    const due = await store.getDueReviewCards(USER, NOW);

    const result = await runReviewSession({
      dueCards: due,
      questionFor: fakeQuestion,
      provider: fixedProvider(true, 6_000),
      scheduler,
      reviewStore: store,
      userId: USER,
      now: () => NOW,
    });

    expect(result.reviewed).toBe(2);
    for (const wordId of ['w1', 'w2']) {
      const persisted = await store.getReviewCard(USER, wordId);
      expect(persisted!.due.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('persists answered cards even if a later answer throws (safe early exit)', async () => {
    await seedDue('w1');
    await seedDue('w2');
    const due = await store.getDueReviewCards(USER, NOW);

    let calls = 0;
    const flakyProvider: ReviewAnswerProvider = {
      answer: () => {
        calls++;
        if (calls === 2) return Promise.reject(new Error('interrupted'));
        return Promise.resolve({ correct: true, latencyMs: 6_000 });
      },
    };

    await expect(
      runReviewSession({
        dueCards: due,
        questionFor: fakeQuestion,
        provider: flakyProvider,
        scheduler,
        reviewStore: store,
        userId: USER,
        now: () => NOW,
      }),
    ).rejects.toThrow('interrupted');

    // First card persisted (due moved), second still due at NOW.
    const first = await store.getReviewCard(USER, due[0].wordId);
    const second = await store.getReviewCard(USER, due[1].wordId);
    expect(first!.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(second!.due.getTime()).toBe(NOW.getTime());
  });

  it('exits cleanly with a message when nothing is due', async () => {
    const log = vi.fn();
    const result = await runReviewSession({
      dueCards: [],
      questionFor: fakeQuestion,
      provider: fixedProvider(true, 6_000),
      scheduler,
      reviewStore: store,
      userId: USER,
      now: () => NOW,
      log,
    });

    expect(result.reviewed).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/nothing due/i));
  });

  it('skips a due card with no matching vocab question', async () => {
    await seedDue('w1');
    const due = await store.getDueReviewCards(USER, NOW);

    const result = await runReviewSession({
      dueCards: due,
      questionFor: () => null,
      provider: fixedProvider(true, 6_000),
      scheduler,
      reviewStore: store,
      userId: USER,
      now: () => NOW,
    });

    expect(result.reviewed).toBe(0);
    const still = await store.getReviewCard(USER, 'w1');
    expect(still!.due.getTime()).toBe(NOW.getTime());
  });
});

describe('loadDueCards', () => {
  it('dispatches to the deck-scoped store method in deck mode', async () => {
    const store = {
      getDueReviewCards: vi.fn().mockResolvedValue([]),
      getDueReviewCardsForDeck: vi.fn().mockResolvedValue([]),
    } as unknown as IReviewStore;

    await loadDueCards(store, 'deck', USER, 'cli-deck', NOW);
    expect(store.getDueReviewCardsForDeck).toHaveBeenCalledWith(USER, 'cli-deck', NOW);
    expect(store.getDueReviewCards).not.toHaveBeenCalled();
  });

  it('dispatches to the pool-global store method in pool mode', async () => {
    const store = {
      getDueReviewCards: vi.fn().mockResolvedValue([]),
      getDueReviewCardsForDeck: vi.fn().mockResolvedValue([]),
    } as unknown as IReviewStore;

    await loadDueCards(store, 'pool', USER, 'cli-deck', NOW);
    expect(store.getDueReviewCards).toHaveBeenCalledWith(USER, NOW);
    expect(store.getDueReviewCardsForDeck).not.toHaveBeenCalled();
  });
});
