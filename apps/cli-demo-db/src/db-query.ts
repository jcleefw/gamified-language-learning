import { fileURLToPath } from 'url';
import path from 'path';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '@gll/db';
import type { MockFoundational, SentenceContext } from '@gll/srs-engine/learn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

type DbClient = BetterSQLite3Database<typeof schema>;

interface Sense {
  romanization: string;
  english: string;
  type: string;
}

export interface VocabWord {
  id: string;
  native: string;
  romanization: string;
  english: string;
  type: string;
  language: 'th';
}

export function buildQuizItems(db: DbClient): VocabWord[] {
  const rows = db.select().from(schema.words).all();
  return rows.map((row) => {
    const senses = JSON.parse(row.senses) as Sense[];
    const sense = senses[0] ?? { romanization: '', english: '', type: '' };
    return {
      id: row.id,
      native: row.text,
      romanization: sense.romanization,
      english: sense.english,
      type: sense.type,
      language: 'th' as const,
    };
  });
}

export async function buildFoundationalPool(): Promise<MockFoundational[]> {
  const p = path.join(
    REPO_ROOT,
    'packages/srs-engine/data/seed-data/thai-full-foundations.ts',
  );
  const mod = await import(p) as {
    thaiConsonants: MockFoundational[];
    thaiVowels: MockFoundational[];
    thaiTones: MockFoundational[];
  };
  return [
    ...mod.thaiConsonants,
    ...mod.thaiVowels,
    ...mod.thaiTones,
  ];
}

export function buildSentenceCorpus(db: DbClient): SentenceContext[] {
  const decks = db.select({ doc: schema.decks.doc }).from(schema.decks).all();
  const corpus: SentenceContext[] = [];

  for (const deck of decks) {
    for (const sentence of deck.doc.sentences) {
      if (sentence.components.length === 0) continue;

      const wordOrder = [...sentence.components].sort((a, b) => a.position - b.position).map((c) => c.wordId);
      corpus.push({
        sentenceId: sentence.sentenceId,
        englishSentence: sentence.english,
        wordOrder,
      });
    }
  }

  return corpus;
}
