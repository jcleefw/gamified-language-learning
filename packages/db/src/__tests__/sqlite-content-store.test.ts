import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteContentStore } from '../sqlite-content-store';
import type { AppDeck } from '@gll/api-contract';
import type { DbClient } from '../types/db-client';

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
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

describe('SqliteContentStore.importCurriculum', () => {
  let db: DbClient;
  let store: SqliteContentStore;

  beforeEach(() => {
    db = makeTestDb();
    store = new SqliteContentStore(db);
  });

  it('populates a deck row with a doc containing all sentences and components', async () => {
    await store.importCurriculum([deckA]);

    const decks = db.select().from(schema.decks).all();
    expect(decks).toHaveLength(1);
    expect(decks[0].doc.sentences).toHaveLength(2);
    expect(decks[0].doc.sentences.flatMap((s) => s.components)).toHaveLength(4);
    expect(db.select().from(schema.words).all()).toHaveLength(4);
    expect(db.select().from(schema.deck_words).all()).toHaveLength(4);
  });

  it('assigns a UUID deck id (not undefined or null)', async () => {
    await store.importCurriculum([deckA]);
    const deck = db.select().from(schema.decks).get();
    expect(deck!.id).toBeTruthy();
    expect(deck!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('populates doc.sentences[].speaker from AppLine.speaker', async () => {
    await store.importCurriculum([deckA]);
    const deck = db.select().from(schema.decks).get()!;
    const sentences = [...deck.doc.sentences].sort((a, b) => a.position - b.position);
    expect(sentences[0].speaker).toBe('A');
    expect(sentences[1].speaker).toBe('B');
  });

  it('deduplicates words within a deck', async () => {
    await store.importCurriculum([deckWithSharedWord]);
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

  it('deduplicates words across two decks', async () => {
    await store.importCurriculum([deckA, deckB]);
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

  it('doc component wordIds match words.id (no dangling refs)', async () => {
    await store.importCurriculum([deckA]);
    const deck = db.select().from(schema.decks).get()!;
    const wordIds = new Set(db.select().from(schema.words).all().map((w) => w.id));
    for (const sentence of deck.doc.sentences) {
      for (const comp of sentence.components) {
        expect(wordIds.has(comp.wordId), `dangling wordId: ${comp.wordId}`).toBe(true);
      }
    }
  });

  it('doc components are in position order', async () => {
    await store.importCurriculum([deckA]);
    const deck = db.select().from(schema.decks).get()!;
    for (const sentence of deck.doc.sentences) {
      const comps = [...sentence.components].sort((a, b) => a.position - b.position);
      for (let i = 0; i < comps.length; i++) {
        expect(comps[i].position).toBe(i);
      }
    }
  });

  it('is idempotent — calling twice yields same row counts', async () => {
    await store.importCurriculum([deckA]);
    const before = {
      decks: db.select().from(schema.decks).all().length,
      words: db.select().from(schema.words).all().length,
      deckWords: db.select().from(schema.deck_words).all().length,
    };

    await store.importCurriculum([deckA]);

    expect(db.select().from(schema.decks).all()).toHaveLength(before.decks);
    expect(db.select().from(schema.words).all()).toHaveLength(before.words);
    expect(db.select().from(schema.deck_words).all()).toHaveLength(before.deckWords);
  });

  it('(F2) sentenceId is stable across re-import for the same (deck, line text)', async () => {
    await store.importCurriculum([deckA]);
    const before = db.select().from(schema.decks).get()!;
    const sentenceIdsBefore = [...before.doc.sentences].sort((a, b) => a.position - b.position).map((s) => s.sentenceId);

    await store.importCurriculum([deckA]);
    const after = db.select().from(schema.decks).get()!;
    const sentenceIdsAfter = [...after.doc.sentences].sort((a, b) => a.position - b.position).map((s) => s.sentenceId);

    expect(sentenceIdsAfter).toEqual(sentenceIdsBefore);
  });

  it('(F3) re-import replaces the existing deck doc rather than duplicating the deck row', async () => {
    await store.importCurriculum([deckA]);
    const firstId = db.select().from(schema.decks).get()!.id;

    await store.importCurriculum([deckA]);
    const decks = db.select().from(schema.decks).all();

    expect(decks).toHaveLength(1);
    expect(decks[0].id).toBe(firstId);
  });

  it('rolls back the whole transaction when the built doc fails validation — no partial writes', async () => {
    const invalidDeck: AppDeck = {
      topic: 'Invalid Deck',
      lines: [
        {
          speaker: 'A',
          native: '', // fails DeckSentenceSchema's native: z.string().min(1)
          romanization: 'x',
          english: 'x',
          words: [{ native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' }],
        },
      ],
    };

    await expect(store.importCurriculum([invalidDeck])).rejects.toThrow();

    expect(db.select().from(schema.decks).all()).toHaveLength(0);
    expect(db.select().from(schema.words).all()).toHaveLength(0);
    expect(db.select().from(schema.deck_words).all()).toHaveLength(0);
  });
});
