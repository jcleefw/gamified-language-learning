import { randomUUID } from 'crypto';
import { and, eq, asc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { AppDeck, AppDeckPayload, AppWordPayload, AppLinePayload } from '@gll/api-contract';
import type { ContentStore } from './content-store.js';
import * as schema from './schema.js';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

interface Sense {
  romanization: string;
  english: string;
  type: string;
}

export class SqliteContentStore implements ContentStore {
  constructor(private readonly db: DbClient) {}

  async getDecks(): Promise<AppDeckPayload[]> {
    const deckRows = this.db.select().from(schema.decks).all();
    return deckRows.map((deck) => this.assembleDeck(deck));
  }

  async getDeck(id: string): Promise<AppDeckPayload | null> {
    const deck = this.db.select().from(schema.decks).where(eq(schema.decks.id, id)).get();
    if (!deck) return null;
    return this.assembleDeck(deck);
  }

  private assembleDeck(deck: typeof schema.decks.$inferSelect): AppDeckPayload {
    const wordRows = this.db
      .select({
        id: schema.words.id,
        text: schema.words.text,
        language: schema.words.language,
        senses: schema.words.senses,
      })
      .from(schema.deck_words)
      .innerJoin(schema.words, eq(schema.deck_words.word_id, schema.words.id))
      .where(eq(schema.deck_words.deck_id, deck.id))
      .all();

    const words: AppWordPayload[] = wordRows.map((w) => {
      const senses = JSON.parse(w.senses) as Sense[];
      const sense = senses[0] ?? { romanization: '', english: '', type: '' };
      return {
        id: w.id,
        native: w.text,
        romanization: sense.romanization,
        english: sense.english,
        type: sense.type,
        language: 'th' as const,
      };
    });

    const sentenceRows = this.db
      .select()
      .from(schema.sentences)
      .where(eq(schema.sentences.deck_id, deck.id))
      .orderBy(asc(schema.sentences.position))
      .all();

    const lines: AppLinePayload[] = sentenceRows.map((sentence) => {
      const components = this.db
        .select({ word_id: schema.sentence_components.word_id })
        .from(schema.sentence_components)
        .where(eq(schema.sentence_components.sentence_id, sentence.id))
        .orderBy(asc(schema.sentence_components.position))
        .all();

      return {
        sentenceId: sentence.id,
        speaker: sentence.speaker ?? '',
        native: sentence.text,
        romanization: sentence.romanization ?? '',
        english: sentence.english ?? '',
        wordIds: components.map((c) => c.word_id),
      };
    });

    return {
      id: deck.id,
      topic: deck.name,
      ...(deck.difficulty !== null && { difficulty: deck.difficulty }),
      ...(deck.register !== null && { register: deck.register }),
      words,
      lines,
    };
  }

  async importCurriculum(decks: AppDeck[]): Promise<void> {
    for (const deck of decks) {
      // Idempotency: reuse existing deck by name+language if already imported
      let deckId: string;
      const existingDeck = this.db
        .select()
        .from(schema.decks)
        .where(and(eq(schema.decks.name, deck.topic), eq(schema.decks.language, 'th')))
        .get();

      if (existingDeck) {
        deckId = existingDeck.id;
      } else {
        deckId = randomUUID();
        this.db
          .insert(schema.decks)
          .values({
            id: deckId,
            name: deck.topic,
            language: 'th',
            difficulty: deck.difficulty ?? null,
            register: deck.register ?? null,
            created_at: new Date().toISOString(),
          })
          .run();
      }

      // INSERT OR IGNORE words; read back UUID for FK use
      const wordIdMap = new Map<string, string>();
      for (const line of deck.lines) {
        for (const word of line.words) {
          if (wordIdMap.has(word.native)) continue;
          this.db
            .insert(schema.words)
            .values({
              id: randomUUID(),
              language: 'th',
              text: word.native,
              senses: JSON.stringify([{ romanization: word.romanization, english: word.english, type: word.type }]),
            })
            .onConflictDoNothing()
            .run();
          const stored = this.db
            .select()
            .from(schema.words)
            .where(and(eq(schema.words.language, 'th'), eq(schema.words.text, word.native)))
            .get();
          if (stored) {
            wordIdMap.set(word.native, stored.id);
          }
        }
      }

      // Insert sentences; read back actual sentenceId; insert components only if absent
      for (let si = 0; si < deck.lines.length; si++) {
        const line = deck.lines[si];
        const candidateId = randomUUID();
        this.db
          .insert(schema.sentences)
          .values({
            id: candidateId,
            deck_id: deckId,
            language: 'th',
            text: line.native,
            english: line.english,
            romanization: line.romanization,
            speaker: line.speaker,
            position: si,
          })
          .onConflictDoNothing()
          .run();

        const sentence = this.db
          .select()
          .from(schema.sentences)
          .where(and(eq(schema.sentences.deck_id, deckId), eq(schema.sentences.text, line.native)))
          .get();
        if (!sentence) continue;

        // Skip components if already populated (idempotency guard)
        const existingComponents = this.db
          .select()
          .from(schema.sentence_components)
          .where(eq(schema.sentence_components.sentence_id, sentence.id))
          .all();
        if (existingComponents.length > 0) continue;

        for (let ci = 0; ci < line.words.length; ci++) {
          const word = line.words[ci];
          const wordId = wordIdMap.get(word.native);
          if (!wordId) continue;
          this.db
            .insert(schema.sentence_components)
            .values({
              id: randomUUID(),
              sentence_id: sentence.id,
              word_id: wordId,
              position: ci,
              romanization: word.romanization,
              english: word.english,
            })
            .run();
        }
      }

      // Populate deck_words from collected word UUIDs
      for (const wordId of wordIdMap.values()) {
        this.db
          .insert(schema.deck_words)
          .values({ deck_id: deckId, word_id: wordId })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  async close(): Promise<void> {
    this.db.$client.close();
  }
}
