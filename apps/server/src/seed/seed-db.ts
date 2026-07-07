import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { schema, SqliteContentStore } from '@gll/db';
import type { ConversationJSON } from '@gll/api-contract';
import { transformConversation } from '../transform-conversation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const CONVERSATIONS_PATH = path.join(
  REPO_ROOT,
  'packages/srs-engine-v2/data/samples/conversations-2026-03-08.json',
);

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

export function seedDemoUser(db: DbClient): void {
  db.insert(schema.users)
    .values({
      id: 'demo-user',
      email: 'demo@example.com',
      role: 'learner',
      created_at: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();
}

export async function seedContent(db: DbClient): Promise<void> {
  const existing = db.select().from(schema.decks).all();
  if (existing.length > 0) return;

  const conversations = JSON.parse(readFileSync(CONVERSATIONS_PATH, 'utf-8')) as ConversationJSON[];
  const appDecks = conversations.map(transformConversation);
  await new SqliteContentStore(db).importCurriculum(appDecks);
}
