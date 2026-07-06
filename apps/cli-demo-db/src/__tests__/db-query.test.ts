import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema } from '@gll/db';
import { importCurriculum } from '../import-curriculum.js';
import { buildQuizItems, buildSentenceCorpus } from '../db-query.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

interface FoundationalEntry {
  id: string;
  native: string;
  romanization: string;
  english: string;
  language: string;
}

async function loadFoundations(): Promise<FoundationalEntry[]> {
  const p = path.join(REPO_ROOT, 'packages/srs-engine-v2/data/seed-data/thai-full-foundations.ts');
  const mod = await import(p);
  return [
    ...(mod.thaiConsonants as FoundationalEntry[]),
    ...(mod.thaiVowels as FoundationalEntry[]),
    ...(mod.thaiTones as FoundationalEntry[]),
  ];
}

function makeTestDb() {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema });
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('buildQuizItems', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeEach(async () => {
    db = makeTestDb();
    const foundations = await loadFoundations();
    importCurriculum(db, foundations);
  });

  it('returns MockWord[] with UUID ids and required fields', () => {
    const items = buildQuizItems(db);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.id).toMatch(uuidRe);
      expect(item.native).toBeTruthy();
      expect(item.romanization).toBeTruthy();
      expect(item.english).toBeTruthy();
      expect(item.type).toBeTruthy();
      expect(item.language).toBe('th');
    }
  });

  it('returns distinct items — no duplicate ids', () => {
    const items = buildQuizItems(db);
    const uniqueIds = new Set(items.map((i) => i.id));
    expect(uniqueIds.size).toBe(items.length);
  });
});

describe('buildSentenceCorpus', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeEach(async () => {
    db = makeTestDb();
    const foundations = await loadFoundations();
    importCurriculum(db, foundations);
  });

  it('returns SentenceContext[] with non-empty wordOrder', () => {
    const corpus = buildSentenceCorpus(db);
    expect(corpus.length).toBeGreaterThan(0);
    for (const ctx of corpus) {
      expect(ctx.sentenceId).toMatch(uuidRe);
      expect(ctx.englishSentence).toBeTruthy();
      expect(ctx.wordOrder.length).toBeGreaterThan(0);
    }
  });

  it('wordOrder entries are word UUIDs that exist in words table', () => {
    const corpus = buildSentenceCorpus(db);
    const quizItems = buildQuizItems(db);
    const wordIds = new Set(quizItems.map((i) => i.id));
    for (const ctx of corpus) {
      for (const wordId of ctx.wordOrder) {
        expect(wordIds.has(wordId)).toBe(true);
      }
    }
  });

  it('skips sentences with no components — corpus count matches doc sentence coverage', () => {
    const corpus = buildSentenceCorpus(db);
    // All sentences in corpus must have at least one component (enforced by buildSentenceCorpus)
    for (const ctx of corpus) {
      expect(ctx.wordOrder.length).toBeGreaterThan(0);
    }
    // Conversations without breakdowns produce sentences with zero components, so those
    // are excluded. Verify corpus is non-empty and bounded by total doc sentence count.
    const allSentences = db
      .select({ doc: schema.decks.doc })
      .from(schema.decks)
      .all()
      .flatMap((deck) => deck.doc.sentences);
    expect(corpus.length).toBeLessThanOrEqual(allSentences.length);
  });
});
