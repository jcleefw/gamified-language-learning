import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteUserConfigStore } from '../sqlite-user-config-store';
import type { DbClient } from '../types/db-client';

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

function seedUser(db: DbClient, id: string): void {
  db.insert(schema.users)
    .values({ id, email: `${id}@example.com`, role: 'learner', created_at: '2026-07-11T00:00:00.000Z' })
    .run();
}

describe('SqliteUserConfigStore', () => {
  let db: DbClient;
  let store: SqliteUserConfigStore;

  beforeEach(() => {
    db = makeTestDb();
    store = new SqliteUserConfigStore(db);
    seedUser(db, 'user-a');
  });

  it('get returns null for a user with no config set', async () => {
    expect(await store.get('user-a')).toBeNull();
  });

  it('get returns null for a user that does not exist', async () => {
    expect(await store.get('nobody')).toBeNull();
  });

  it('put then get round-trips all three override fields', async () => {
    await store.put('user-a', {
      difficultyPreset: 'normal',
      wordsPerBatch: 5,
      sentenceDirections: ['english-to-native', 'native-to-romanization'],
    });

    expect(await store.get('user-a')).toEqual({
      difficultyPreset: 'normal',
      wordsPerBatch: 5,
      sentenceDirections: ['english-to-native', 'native-to-romanization'],
    });
  });

  it('sentenceDirections round-trips as a JSON array', async () => {
    await store.put('user-a', { sentenceDirections: ['a', 'b', 'c'] });
    const got = await store.get('user-a');
    expect(Array.isArray(got?.sentenceDirections)).toBe(true);
    expect(got?.sentenceDirections).toEqual(['a', 'b', 'c']);
  });

  it('partial put merges into the blob, leaving other fields untouched', async () => {
    await store.put('user-a', {
      difficultyPreset: 'normal',
      wordsPerBatch: 5,
      sentenceDirections: ['english-to-native'],
    });

    await store.put('user-a', { difficultyPreset: 'intense' });

    expect(await store.get('user-a')).toEqual({
      difficultyPreset: 'intense',
      wordsPerBatch: 5,
      sentenceDirections: ['english-to-native'],
    });
  });

  it('config is stored on the identity row, not a separate table', async () => {
    await store.put('user-a', { wordsPerBatch: 3 });
    await store.put('user-a', { wordsPerBatch: 7 });

    const rows = db.select().from(schema.users).all();
    expect(rows).toHaveLength(1); // still one user row; config updated in place
    expect((await store.get('user-a'))?.wordsPerBatch).toBe(7);
  });

  it('an explicit null field persists as null (an explicit "no override")', async () => {
    await store.put('user-a', { wordsPerBatch: null, difficultyPreset: 'normal' });
    expect(await store.get('user-a')).toEqual({
      difficultyPreset: 'normal',
      wordsPerBatch: null,
      sentenceDirections: null,
    });
  });
});
