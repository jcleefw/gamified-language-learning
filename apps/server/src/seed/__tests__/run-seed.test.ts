import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, schema } from '@gll/db';
import { runSeed } from '../run-seed.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;
let testSqlite: Database.Database;

const USER = 'demo-user';
const WORDS = ['w-a', 'w-b', 'w-c'];

function seedDeckWithWords(deckId: string, wordIds: string[]) {
  testSqlite
    .prepare(
      `INSERT INTO decks (id, name, language, difficulty, register, created_at, doc)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .run(deckId, 'Eat', 'th', new Date().toISOString(), JSON.stringify({ sentences: [] }));
  for (const id of wordIds) {
    testSqlite
      .prepare(`INSERT INTO words (id, language, text, senses) VALUES (?, ?, ?, ?)`)
      .run(id, 'th', id, JSON.stringify([{ romanization: id, english: id, type: 'word' }]));
    testSqlite.prepare(`INSERT INTO deck_words (deck_id, word_id) VALUES (?, ?)`).run(deckId, id);
  }
}

function reviewCardCount(): number {
  return (
    testSqlite.prepare('SELECT COUNT(*) AS n FROM review_cards WHERE user_id = ?').get(USER) as {
      n: number;
    }
  ).n;
}

beforeEach(() => {
  testSqlite = new Database(':memory:');
  initDb(testSqlite);
  testDb = drizzle(testSqlite, { schema }) as TestDb;
  seedDeckWithWords('deck-eat', WORDS);
});

describe('runSeed', () => {
  it('writes N due review cards for mastered-due and reports the result', async () => {
    const result = await runSeed(
      { scenario: 'mastered-due', count: 3 },
      { db: testDb, userId: USER },
    );

    expect(result.wrote).toBe(true);
    expect(result.deckId).toBe('deck-eat');
    expect(result.wordIds).toEqual(WORDS);
    expect(result.expected).toEqual({ dueNow: 3, anytime: 3, reviewUnlocked: true });
    expect(reviewCardCount()).toBe(3);
  });

  it('--dry-run leaves the DB byte-unchanged', async () => {
    const before = reviewCardCount();
    const result = await runSeed(
      { scenario: 'mastered-due', count: 3, dryRun: true },
      { db: testDb, userId: USER },
    );

    expect(result.wrote).toBe(false);
    expect(result.expected.dueNow).toBe(3); // still computes the outcome
    expect(reviewCardCount()).toBe(before); // but writes nothing
  });

  it('throws with the catalogue on an unknown scenario', async () => {
    await expect(
      runSeed({ scenario: 'bogus' }, { db: testDb, userId: USER }),
    ).rejects.toThrow(/unknown scenario/i);
  });
});
