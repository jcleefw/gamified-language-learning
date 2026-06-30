import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { importCurriculum } from '../import-curriculum';
import type { AppDeck } from '@gll/api-contract';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

function makeTestDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema });
}

const deckA: AppDeck = {
  topic: 'Test Deck A',
  difficulty: 'beginner',
  register: 'informal',
  lines: [
    {
      speaker: 'A',
      native: 'หิวแล้ว',
      romanization: 'hǐw lɛ́ɛo',
      english: "I'm hungry",
      words: [
        { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' },
        { native: 'แล้ว', romanization: 'lɛ́ɛo', english: 'already', type: 'particle', language: 'th' },
      ],
    },
    {
      speaker: 'B',
      native: 'ไปกิน',
      romanization: 'bpai gin',
      english: "Let's eat",
      words: [
        { native: 'ไป', romanization: 'bpai', english: 'to go', type: 'verb', language: 'th' },
        { native: 'กิน', romanization: 'gin', english: 'to eat', type: 'verb', language: 'th' },
      ],
    },
  ],
};

// Same word 'หิว' appears in both lines
const deckWithSharedWord: AppDeck = {
  topic: 'Shared Word Deck',
  lines: [
    {
      speaker: 'A',
      native: 'หิวมาก',
      romanization: 'hǐw mâak',
      english: 'Very hungry',
      words: [
        { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' },
        { native: 'มาก', romanization: 'mâak', english: 'very', type: 'adverb', language: 'th' },
      ],
    },
    {
      speaker: 'B',
      native: 'หิวจริงๆ',
      romanization: 'hǐw jing-jing',
      english: 'Really hungry',
      words: [
        { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' },
        { native: 'จริงๆ', romanization: 'jing-jing', english: 'really', type: 'adverb', language: 'th' },
      ],
    },
  ],
};

const deckB: AppDeck = {
  topic: 'Test Deck B',
  lines: [
    {
      speaker: 'A',
      // 'หิว' also appears in deckA — cross-deck dedup test
      native: 'หิวไหม',
      romanization: 'hǐw mǎi',
      english: 'Are you hungry?',
      words: [
        { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' },
        { native: 'ไหม', romanization: 'mǎi', english: 'question particle', type: 'particle', language: 'th' },
      ],
    },
  ],
};

describe('importCurriculum', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('populates all content tables for a basic deck', () => {
    importCurriculum(db, [deckA]);

    expect(db.select().from(schema.decks).all()).toHaveLength(1);
    expect(db.select().from(schema.sentences).all()).toHaveLength(2);
    expect(db.select().from(schema.words).all()).toHaveLength(4);
    expect(db.select().from(schema.sentence_components).all()).toHaveLength(4);
    expect(db.select().from(schema.deck_words).all()).toHaveLength(4);
  });

  it('assigns a UUID deck id (not undefined or null)', () => {
    importCurriculum(db, [deckA]);
    const deck = db.select().from(schema.decks).get();
    expect(deck!.id).toBeTruthy();
    expect(deck!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('populates sentences.speaker from AppLine.speaker', () => {
    importCurriculum(db, [deckA]);
    const sentences = db.select().from(schema.sentences).all();
    expect(sentences[0].speaker).toBe('A');
    expect(sentences[1].speaker).toBe('B');
  });

  it('deduplicates words within a deck', () => {
    importCurriculum(db, [deckWithSharedWord]);
    // 'หิว' appears in both lines; should only be 1 row
    const wordRows = db
      .select()
      .from(schema.words)
      .where(and(eq(schema.words.language, 'th'), eq(schema.words.text, 'หิว')))
      .all();
    expect(wordRows).toHaveLength(1);
    // Total unique words: หิว, มาก, จริงๆ = 3
    expect(db.select().from(schema.words).all()).toHaveLength(3);
  });

  it('deduplicates words across two decks', () => {
    importCurriculum(db, [deckA, deckB]);
    // 'หิว' in deckA and deckB → 1 words row
    const wordRows = db
      .select()
      .from(schema.words)
      .where(and(eq(schema.words.language, 'th'), eq(schema.words.text, 'หิว')))
      .all();
    expect(wordRows).toHaveLength(1);
    // But deck_words should have that word in both decks
    const deckWordRows = db
      .select()
      .from(schema.deck_words)
      .where(eq(schema.deck_words.word_id, wordRows[0].id))
      .all();
    expect(deckWordRows).toHaveLength(2);
  });

  it('sentence_components.word_id matches words.id (no dangling refs)', () => {
    importCurriculum(db, [deckA]);
    const components = db.select().from(schema.sentence_components).all();
    const wordIds = new Set(db.select().from(schema.words).all().map((w) => w.id));
    for (const comp of components) {
      expect(wordIds.has(comp.word_id), `dangling word_id: ${comp.word_id}`).toBe(true);
    }
  });

  it('sentence_components are in position order', () => {
    importCurriculum(db, [deckA]);
    const sentences = db.select().from(schema.sentences).all();
    for (const sentence of sentences) {
      const comps = db
        .select()
        .from(schema.sentence_components)
        .where(eq(schema.sentence_components.sentence_id, sentence.id))
        .all()
        .sort((a, b) => a.position - b.position);
      for (let i = 0; i < comps.length; i++) {
        expect(comps[i].position).toBe(i);
      }
    }
  });

  it('is idempotent — calling twice yields same row counts', () => {
    importCurriculum(db, [deckA]);
    const before = {
      decks: db.select().from(schema.decks).all().length,
      sentences: db.select().from(schema.sentences).all().length,
      words: db.select().from(schema.words).all().length,
      components: db.select().from(schema.sentence_components).all().length,
      deckWords: db.select().from(schema.deck_words).all().length,
    };

    importCurriculum(db, [deckA]);

    expect(db.select().from(schema.decks).all()).toHaveLength(before.decks);
    expect(db.select().from(schema.sentences).all()).toHaveLength(before.sentences);
    expect(db.select().from(schema.words).all()).toHaveLength(before.words);
    expect(db.select().from(schema.sentence_components).all()).toHaveLength(before.components);
    expect(db.select().from(schema.deck_words).all()).toHaveLength(before.deckWords);
  });
});
