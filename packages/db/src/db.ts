import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { initDb } from './init-db';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

let dbInstance: DbClient | null = null;

export function getDb(path: string = './data/learning-state.db'): DbClient {
  if (!dbInstance) {
    const sqlite = new Database(path);
    dbInstance = drizzle(sqlite, { schema });
    initDb(sqlite);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.$client.close();
    dbInstance = null;
  }
}
