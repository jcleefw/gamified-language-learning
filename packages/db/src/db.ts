import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { initDb } from './init-db';

type DbClient = BetterSQLite3Database<typeof schema>;

let dbInstance: DbClient | null = null;

/**
 * Get or create database connection
 */
export function getDb(path: string = './data/learning-state.db'): DbClient {
  if (!dbInstance) {
    const sqlite = new Database(path);
    dbInstance = drizzle(sqlite, { schema });

    // Apply migrations
    initDb(sqlite);
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    // @ts-ignore — accessing internal connection
    dbInstance?._.connection?.close();
    dbInstance = null;
  }
}
