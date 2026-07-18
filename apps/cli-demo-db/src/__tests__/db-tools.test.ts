import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import { importCurriculum } from '../import-curriculum.js';
import { clearUserState, seedDb, type DbClient } from '../db-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

interface FoundationalEntry {
  id: string;
  native: string;
  romanization: string;
  english: string;
  language: string;
}

async function loadFoundations(): Promise<FoundationalEntry[]> {
  const p = path.join(REPO_ROOT, 'packages/srs-engine/data/seed-data/thai-full-foundations.ts');
  const mod = await import(p);
  return [
    ...(mod.thaiConsonants as FoundationalEntry[]),
    ...(mod.thaiVowels as FoundationalEntry[]),
    ...(mod.thaiTones as FoundationalEntry[]),
  ];
}

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

describe('clearUserState', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = makeTestDb();
    const foundations = await loadFoundations();
    importCurriculum(db, foundations);
  });

  it('removes all word and sentence state for the given userId', async () => {
    const store = new SqliteLearningStore(db);
    await store.upsertWordState('cli-user', {
      wordId: 'test-id',
      seen: 1,
      correct: 1,
      mastery: 1,
      correctStreak: 1,
      wrongStreak: 0,
      lapses: 0,
    });

    clearUserState(db, 'cli-user');

    const wordStates = await store.getAllWordStates('cli-user');
    expect(wordStates.size).toBe(0);
  });

  it('does not remove state for a different userId', async () => {
    const store = new SqliteLearningStore(db);
    await store.upsertWordState('other-user', {
      wordId: 'test-id',
      seen: 1,
      correct: 1,
      mastery: 1,
      correctStreak: 1,
      wrongStreak: 0,
      lapses: 0,
    });

    clearUserState(db, 'cli-user');

    const otherStates = await store.getAllWordStates('other-user');
    expect(otherStates.size).toBe(1);
  });
});

describe('seedDb', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = makeTestDb();
    const foundations = await loadFoundations();
    importCurriculum(db, foundations);
  });

  it('baseline: leaves zero word state rows', async () => {
    await seedDb('baseline', db);
    const rows = db.select().from(schema.user_word_states).all();
    expect(rows.length).toBe(0);
  });

  it('mid-session: inserts 4 word states with correct mastery values', async () => {
    await seedDb('mid-session', db);
    const rows = db.select().from(schema.user_word_states).all();
    expect(rows.length).toBe(4);

    const masteries = rows.map((r) => r.mastery).sort((a, b) => a - b);
    expect(masteries).toEqual([0, 0, 1, 2]);
  });

  it('sentence-ready: inserts 6 word states all with seen >= 2', async () => {
    await seedDb('sentence-ready', db);
    const rows = db.select().from(schema.user_word_states).all();
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(row.seen).toBeGreaterThanOrEqual(2);
      expect(row.mastery).toBeGreaterThanOrEqual(2);
    }
  });

  it('is idempotent — calling twice gives same row count', async () => {
    await seedDb('mid-session', db);
    const countAfter1 = db.select().from(schema.user_word_states).all().length;

    await seedDb('mid-session', db);
    const countAfter2 = db.select().from(schema.user_word_states).all().length;

    expect(countAfter2).toBe(countAfter1);
    expect(countAfter2).toBe(4);
  });

  it('throws for unknown fixture name', async () => {
    await expect(seedDb('nonexistent-fixture', db)).rejects.toThrowError('nonexistent-fixture');
  });
});
