import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema } from '@gll/db';
import { importCurriculum } from '../import-curriculum.js';

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
  const p = path.join(REPO_ROOT, 'packages/srs-engine/data/seed-data/thai-full-foundations.ts');
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

describe('importCurriculum', () => {
  let db: ReturnType<typeof makeTestDb>;
  let foundations: FoundationalEntry[];

  beforeEach(async () => {
    db = makeTestDb();
    foundations = await loadFoundations();
  });

  it('populates decks table with one row per conversation', () => {
    importCurriculum(db, foundations);
    const rows = db.select().from(schema.decks).all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('populates words table with unique (language, text) entries', () => {
    importCurriculum(db, foundations);
    const rows = db.select().from(schema.words).all();
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map((r) => `${r.language}::${r.text}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(rows.length);
  });

  it('populates doc.sentences for conversations that have breakdown entries', () => {
    importCurriculum(db, foundations);
    const rows = db
      .select({ doc: schema.decks.doc })
      .from(schema.decks)
      .all()
      .flatMap((deck) => deck.doc.sentences);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('populates doc components linking sentences to words', () => {
    importCurriculum(db, foundations);
    const rows = db
      .select({ doc: schema.decks.doc })
      .from(schema.decks)
      .all()
      .flatMap((deck) => deck.doc.sentences)
      .flatMap((sentence) => sentence.components);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('populates deck_words derived from doc components', () => {
    importCurriculum(db, foundations);
    const rows = db.select().from(schema.deck_words).all();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('populates foundational_words from thai-full-foundations', () => {
    importCurriculum(db, foundations);
    const rows = db.select().from(schema.foundational_words).all();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('is idempotent — running twice does not error or duplicate rows', () => {
    const countSentences = () =>
      db
        .select({ doc: schema.decks.doc })
        .from(schema.decks)
        .all()
        .flatMap((deck) => deck.doc.sentences).length;

    importCurriculum(db, foundations);
    const after1 = {
      decks: db.select().from(schema.decks).all().length,
      words: db.select().from(schema.words).all().length,
      sentences: countSentences(),
      foundational_words: db.select().from(schema.foundational_words).all().length,
    };

    importCurriculum(db, foundations);
    const after2 = {
      decks: db.select().from(schema.decks).all().length,
      words: db.select().from(schema.words).all().length,
      sentences: countSentences(),
      foundational_words: db.select().from(schema.foundational_words).all().length,
    };

    expect(after2).toEqual(after1);
  });

  it('word ids are valid UUIDs', () => {
    importCurriculum(db, foundations);
    const rows = db.select().from(schema.words).all();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const row of rows) {
      expect(row.id).toMatch(uuidRe);
    }
  });
});
