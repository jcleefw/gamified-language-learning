import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema, SqliteLearningStore } from '@gll/db';

/**
 * A fresh, empty in-memory Learning store for `--fresh` replay. Reuses the real
 * `SqliteLearningStore` over `better-sqlite3 ':memory:'` (no new store impl, ADR D2) —
 * NOT `getDb`, which is a process singleton that would leak state across replays.
 */
export function makeMemoryLearningStore(): SqliteLearningStore {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema }) as ReturnType<typeof drizzle<typeof schema>>;
  return new SqliteLearningStore(db);
}
