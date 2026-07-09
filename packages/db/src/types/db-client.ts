import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type * as schema from '../schema.js';

export type DbClient = BetterSQLite3Database<typeof schema> & {
  $client: BetterSqlite3.Database;
};
