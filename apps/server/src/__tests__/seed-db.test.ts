import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema } from '@gll/db';

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

const { seedDemoUser, seedContent } = await import('../seed/seed-db.js');

describe('seedDemoUser', () => {
  it('inserts demo-user into users table', () => {
    seedDemoUser(testDb);
    const users = testDb.select().from(schema.users).all();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('demo-user');
  });

  it('is idempotent — calling twice yields 1 user row', () => {
    seedDemoUser(testDb);
    seedDemoUser(testDb);
    const users = testDb.select().from(schema.users).all();
    expect(users).toHaveLength(1);
  });
});

describe('seedContent', () => {
  it('populates decks table with 4 rows on cold start', async () => {
    await seedContent(testDb);
    const decks = testDb.select().from(schema.decks).all();
    expect(decks).toHaveLength(5);
  });

  it('all seeded decks have UUID ids', async () => {
    await seedContent(testDb);
    const decks = testDb.select().from(schema.decks).all();
    for (const deck of decks) {
      expect(deck.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('is idempotent — calling twice keeps 4 decks', async () => {
    await seedContent(testDb);
    await seedContent(testDb);
    const decks = testDb.select().from(schema.decks).all();
    expect(decks).toHaveLength(5);
  });

  it('no-ops when decks already exist', async () => {
    await seedContent(testDb);
    const wordCountBefore = testDb.select().from(schema.words).all().length;

    await seedContent(testDb);
    const wordCountAfter = testDb.select().from(schema.words).all().length;
    expect(wordCountAfter).toBe(wordCountBefore);
  });
});
