import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteReviewStore } from '../sqlite-review-store';
import { FsrsScheduler, type ReviewCard } from '@gll/srs-engine/review';
import type { DbClient } from '../types/db-client';

function makeTestDb(): { db: DbClient; sqlite: BetterSqlite3.Database } {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema }) as DbClient;
  return { db, sqlite };
}

const card = (o: Partial<ReviewCard> = {}): ReviewCard => ({
  wordId: 'w1',
  due: new Date('2026-07-08T00:00:00.000Z'),
  schedulerData: { stability: 3, difficulty: 5, state: 2 },
  ...o,
});

describe('SqliteReviewStore', () => {
  let store: SqliteReviewStore;
  let db: DbClient;

  beforeEach(() => {
    ({ db } = makeTestDb());
    store = new SqliteReviewStore(db);
  });

  it('upsert then getReviewCard round-trips due as a Date and schedulerData structurally intact', async () => {
    const c = card();
    await store.upsertReviewCard('user-a', c);
    const result = await store.getReviewCard('user-a', 'w1');

    expect(result).not.toBeNull();
    expect(result!.due).toBeInstanceOf(Date);
    expect(result!.due.getTime()).toBe(c.due.getTime());
    expect(result!.schedulerData).toEqual(c.schedulerData);
    expect(result!.wordId).toBe('w1');
  });

  it('getReviewCard returns null for an unknown (userId, wordId)', async () => {
    const result = await store.getReviewCard('user-a', 'nonexistent');
    expect(result).toBeNull();
  });

  it('second upsert with same (userId, wordId) overwrites — no duplicate rows', async () => {
    await store.upsertReviewCard('user-a', card({ due: new Date('2026-07-08T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ due: new Date('2026-07-10T00:00:00.000Z') }));

    const all = await store.getAllReviewCards('user-a');
    expect(all).toHaveLength(1);
    expect(all[0].due.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });

  it('getAllReviewCards returns [] when nothing seeded', async () => {
    const result = await store.getAllReviewCards('user-a');
    expect(result).toEqual([]);
  });

  it('getDueReviewCards excludes due > now, includes due <= now, ordered by due ascending', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    await store.upsertReviewCard('user-a', card({ wordId: 'future', due: new Date('2026-07-09T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ wordId: 'due-now', due: now }));
    await store.upsertReviewCard('user-a', card({ wordId: 'overdue', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCards('user-a', now);

    expect(result.map((c) => c.wordId)).toEqual(['overdue', 'due-now']);
  });

  it('getDueReviewCards is scoped to the given userId', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    await store.upsertReviewCard('user-a', card({ wordId: 'w1', due: new Date('2026-07-01T00:00:00.000Z') }));
    await store.upsertReviewCard('user-b', card({ wordId: 'w2', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCards('user-a', now);
    expect(result.map((c) => c.wordId)).toEqual(['w1']);
  });

  it('getDueReviewCardsForDeck returns only words present in deck_words for that deck', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    db.insert(schema.deck_words).values([
      { deck_id: 'deck-1', word_id: 'in-deck' },
    ]).run();

    await store.upsertReviewCard('user-a', card({ wordId: 'in-deck', due: new Date('2026-07-01T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ wordId: 'not-in-deck', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCardsForDeck('user-a', 'deck-1', now);
    expect(result.map((c) => c.wordId)).toEqual(['in-deck']);
  });

  it('getDueReviewCardsForDeck excludes future-due cards within the deck', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    db.insert(schema.deck_words).values([
      { deck_id: 'deck-1', word_id: 'in-deck' },
    ]).run();

    await store.upsertReviewCard('user-a', card({ wordId: 'in-deck', due: new Date('2026-07-09T00:00:00.000Z') }));

    const result = await store.getDueReviewCardsForDeck('user-a', 'deck-1', now);
    expect(result).toEqual([]);
  });

  // --- ST04: idempotent re-graduation (seedReviewCard, ignore-if-exists) ---

  it('seedReviewCard creates the card and returns true on first graduation', async () => {
    const inserted = await store.seedReviewCard('user-a', card());
    expect(inserted).toBe(true);
    expect(await store.getAllReviewCards('user-a')).toHaveLength(1);
  });

  it('seedReviewCard is ignore-if-exists: second seed returns false and does not reset FSRS progress', async () => {
    const original = card({ due: new Date('2026-07-08T00:00:00.000Z'), schedulerData: { stability: 3, difficulty: 5, state: 2 } });
    await store.seedReviewCard('user-a', original);

    const inserted = await store.seedReviewCard(
      'user-a',
      card({ due: new Date('2026-07-20T00:00:00.000Z'), schedulerData: { stability: 99, difficulty: 1, state: 0 } }),
    );

    expect(inserted).toBe(false);
    const result = await store.getReviewCard('user-a', 'w1');
    expect(result!.due.getTime()).toBe(original.due.getTime());
    expect(result!.schedulerData).toEqual(original.schedulerData);
  });

  // --- ST05: one-way graduation (re-graduation never rewinds an advanced card) ---

  it('graduation is one-way: re-seeding after a review advance preserves the advanced card', async () => {
    await store.seedReviewCard('user-a', card());
    // Review runner advances the card via upsert (overwrite).
    const advanced = card({ due: new Date('2026-08-01T00:00:00.000Z'), schedulerData: { stability: 42, difficulty: 4, state: 2 } });
    await store.upsertReviewCard('user-a', advanced);

    // A stray re-graduation must NOT rewind the advanced card.
    const inserted = await store.seedReviewCard('user-a', card());
    expect(inserted).toBe(false);

    const result = await store.getReviewCard('user-a', 'w1');
    expect(result!.due.getTime()).toBe(advanced.due.getTime());
    expect(result!.schedulerData).toEqual(advanced.schedulerData);
  });

  // --- ST05: orphan tolerance (a card whose word is gone must never crash a reader) ---

  it('getDueReviewCards tolerates an orphaned card (no words row) without crashing', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    // No words row is ever inserted for this word_id.
    await store.upsertReviewCard('user-a', card({ wordId: 'orphan', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCards('user-a', now);
    expect(result.map((c) => c.wordId)).toEqual(['orphan']);
  });

  it('getDueReviewCardsForDeck skips a word absent from deck_words without crashing', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    // Card exists but the word is not registered in this deck.
    await store.upsertReviewCard('user-a', card({ wordId: 'not-in-deck', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCardsForDeck('user-a', 'deck-1', now);
    expect(result).toEqual([]);
  });

  // --- EP39-ST03: last-practised recency (MAX(created_at) per word, user-scoped) ---

  it('getLastPracticedAtByWord returns MAX(created_at) per word and omits never-practised words', async () => {
    const insert = (wordId: string, createdAt: string, userId = 'user-a'): unknown =>
      db
        .insert(schema.review_answer_events)
        .values({
          correlation_id: null,
          user_id: userId,
          word_id: wordId,
          correct: true,
          latency_ms: 100,
          question_type: 'mcq',
          rating: 'good',
          created_at: createdAt,
        })
        .run();

    insert('w1', '2026-07-01T00:00:00.000Z');
    insert('w1', '2026-07-05T00:00:00.000Z'); // later event wins
    insert('w2', '2026-07-03T00:00:00.000Z');
    insert('other-user', '2026-07-09T00:00:00.000Z', 'user-b'); // scoped out

    const map = await store.getLastPracticedAtByWord('user-a');

    expect(map.get('w1')).toBe('2026-07-05T00:00:00.000Z');
    expect(map.get('w2')).toBe('2026-07-03T00:00:00.000Z');
    expect(map.has('other-user')).toBe(false);
    expect(map.size).toBe(2);
  });

  // EP39-BUG01: verify the mastered-vs-due timing. Three words graduated "today"
  // via the real FSRS seed are NOT due today (graduation schedules the first review
  // in the future), and ALL THREE resurface together once their due date arrives —
  // the due list is uncapped, so mastering 3 never drip-feeds "only 1".
  it('3 words graduated today are 0 due now but all 3 due by 8 days later', async () => {
    const scheduler = new FsrsScheduler();
    const now = new Date('2026-07-10T00:00:00.000Z');
    // Mixed realistic graduations: "good" (~3d) and "easy" (~8d) — 8d covers both.
    const perfs = [
      { correctStreak: 2, lapses: 0, correctRatio: 1 },
      { correctStreak: 3, lapses: 0, correctRatio: 1 },
      { correctStreak: 5, lapses: 0, correctRatio: 1 },
    ];
    for (const [i, perf] of perfs.entries()) {
      await store.upsertReviewCard('user-a', scheduler.seed(`w${String(i)}`, perf, now));
    }

    // Today: graduation schedules ahead → nothing due yet.
    expect(await store.getDueReviewCards('user-a', now)).toEqual([]);
    // Tomorrow: still nothing (a "good" graduation is ~3 days out, not 1).
    const plus = (days: number): Date => new Date(now.getTime() + days * 86_400_000);
    expect(await store.getDueReviewCards('user-a', plus(1))).toEqual([]);

    // By 8 days later: all three have crossed their due date and resurface together.
    const dueDay8 = await store.getDueReviewCards('user-a', plus(8));
    expect(dueDay8.map((c) => c.wordId).sort()).toEqual(['w0', 'w1', 'w2']);
  });

  it('getLastPracticedAtByWord counts eager (rating NULL) events too', async () => {
    db
      .insert(schema.review_answer_events)
      .values({
        correlation_id: null,
        user_id: 'user-a',
        word_id: 'eager',
        correct: true,
        latency_ms: 100,
        question_type: 'mcq',
        rating: null, // eager/not-due answer still counts as "practised"
        created_at: '2026-07-06T00:00:00.000Z',
      })
      .run();

    const map = await store.getLastPracticedAtByWord('user-a');
    expect(map.get('eager')).toBe('2026-07-06T00:00:00.000Z');
  });
});
