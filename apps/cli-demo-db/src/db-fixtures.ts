import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2/learn';

type DbClient = BetterSQLite3Database<typeof schema>;

function resolveWordId(db: DbClient, thaiText: string): string {
  const row = db
    .select()
    .from(schema.words)
    .where(and(eq(schema.words.language, 'th'), eq(schema.words.text, thaiText)))
    .get();
  if (!row) throw new Error(`db-fixtures: word not found for thai text "${thaiText}"`);
  return row.id;
}

function baseline(): WordState[] {
  return [];
}

function midSession(db: DbClient): WordState[] {
  return [
    { wordId: resolveWordId(db, 'หิว'),  seen: 3, correct: 2, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0 },
    { wordId: resolveWordId(db, 'กิน'),  seen: 2, correct: 2, mastery: 2, correctStreak: 2, wrongStreak: 0, lapses: 0 },
    { wordId: resolveWordId(db, 'ไป'),   seen: 2, correct: 1, mastery: 0, correctStreak: 0, wrongStreak: 1, lapses: 0 },
    { wordId: resolveWordId(db, 'ดี'),   seen: 1, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 1, lapses: 0 },
  ];
}

function sentenceReady(db: DbClient): WordState[] {
  const thaiWords = ['หิว', 'แล้ว', 'ไป', 'กิน', 'อะไร', 'กัน'];
  return thaiWords.map((text) => ({
    wordId: resolveWordId(db, text),
    seen: 2,
    correct: 2,
    mastery: 2,
    correctStreak: 2,
    wrongStreak: 0,
    lapses: 0,
  }));
}

type FixtureFn = (db: DbClient) => WordState[];

export const fixtures: Record<string, FixtureFn> = {
  baseline,
  'mid-session': midSession,
  'sentence-ready': sentenceReady,
};
