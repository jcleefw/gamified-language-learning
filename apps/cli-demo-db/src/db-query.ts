import { fileURLToPath } from 'url';
import path from 'path';
import { eq, asc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '@gll/db';
import type { MockFoundational, SentenceContext } from '@gll/srs-engine-v2';

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
    'packages/srs-engine-v2/data/seed-data/thai-full-foundations.ts',
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
  const sentences = db.select().from(schema.sentences).all();
  const corpus: SentenceContext[] = [];

  for (const sentence of sentences) {
    const components = db
      .select()
      .from(schema.sentence_components)
      .where(eq(schema.sentence_components.sentence_id, sentence.id))
      .orderBy(asc(schema.sentence_components.position))
      .all();

    if (components.length === 0) continue;

    corpus.push({
      sentenceId: sentence.id,
      englishSentence: sentence.english ?? '',
      wordOrder: components.map((c) => c.word_id),
    });
  }

  return corpus;
}
