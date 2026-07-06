import { existsSync, unlinkSync } from 'fs';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { getDb, closeDb, schema, SqliteLearningStore } from '@gll/db';
import { fixtures } from './db-fixtures.js';

export type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

export function clearUserState(db: BetterSQLite3Database<typeof schema>, userId: string): void {
  db.delete(schema.user_word_states)
    .where(eq(schema.user_word_states.user_id, userId))
    .run();
  db.delete(schema.user_sentence_states)
    .where(eq(schema.user_sentence_states.user_id, userId))
    .run();
}

export function resetDb(dbPath: string): void {
  closeDb();
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
  getDb(dbPath);
}

export async function seedDb(
  fixtureName: string,
  db: DbClient,
  userId: string = 'cli-user',
): Promise<void> {
  const fixture = fixtures[fixtureName];
  if (!fixture) {
    throw new Error(`seedDb: unknown fixture "${fixtureName}". Available: ${Object.keys(fixtures).join(', ')}`);
  }

  clearUserState(db, userId);

  const store = new SqliteLearningStore(db);
  const wordStates = fixture(db);
  for (const ws of wordStates) {
    await store.upsertWordState(userId, ws);
  }
}
