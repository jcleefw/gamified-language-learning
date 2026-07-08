import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { DeckDocSchema } from '@gll/api-contract';
import type {
  AppDeck,
  AppDeckPayload,
  AppWordPayload,
  AppLinePayload,
  DeckDoc,
  DeckSentence,
  DeckComponent,
} from '@gll/api-contract';
import type { IContentStore } from './content-store.js';
import * as schema from './schema.js';

type DbClient = BetterSQLite3Database<typeof schema> & {
  $client: BetterSqlite3.Database;
};
type TxClient = BetterSQLite3Database<typeof schema>;

interface Sense {
  romanization: string;
  english: string;
  type: string;
}

export class SqliteContentStore implements IContentStore {
  constructor(private readonly db: DbClient) {}

  async getDecks(): Promise<AppDeckPayload[]> {
    const deckRows = this.db.select().from(schema.decks).all();
    return deckRows.map((deck) => this.assembleDeck(deck));
  }

  async getDeck(id: string): Promise<AppDeckPayload | null> {
    const deck = this.db
      .select()
      .from(schema.decks)
      .where(eq(schema.decks.id, id))
      .get();
    if (!deck) return null;
    return this.assembleDeck(deck);
  }

  private assembleDeck(deck: typeof schema.decks.$inferSelect): AppDeckPayload {
    const wordRows = this.db
      .select({
        id: schema.words.id,
        text: schema.words.text,
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

    const sortedSentences = [...deck.doc.sentences].sort(
      (a, b) => a.position - b.position,
    );
    const lines: AppLinePayload[] = sortedSentences.map((sentence) => ({
      sentenceId: sentence.sentenceId,
      speaker: sentence.speaker,
      native: sentence.native,
      romanization: sentence.romanization,
      english: sentence.english,
      wordIds: [...sentence.components]
        .sort((a, b) => a.position - b.position)
        .map((c) => c.wordId),
    }));

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
    this.db.transaction((tx) => {
      for (const deck of decks) {
        this.importOneDeck(tx, deck);
      }
    });
  }

  private importOneDeck(tx: TxClient, deck: AppDeck): void {
    const existing = tx
      .select()
      .from(schema.decks)
      .where(
        and(eq(schema.decks.name, deck.topic), eq(schema.decks.language, 'th')),
      )
      .get();
    const deckId = existing?.id ?? randomUUID();

    // Upsert global words; dedupe within this deck by native text
    const wordIdMap = new Map<string, string>();
    for (const line of deck.lines) {
      for (const word of line.words) {
        if (wordIdMap.has(word.native)) continue;
        tx.insert(schema.words)
          .values({
            id: randomUUID(),
            language: 'th',
            text: word.native,
            senses: JSON.stringify([
              {
                romanization: word.romanization,
                english: word.english,
                type: word.type,
              },
            ]),
          })
          .onConflictDoNothing()
          .run();
        const stored = tx
          .select()
          .from(schema.words)
          .where(
            and(
              eq(schema.words.language, 'th'),
              eq(schema.words.text, word.native),
            ),
          )
          .get();
        if (!stored) {
          throw new Error(
            `ContentStore.importCurriculum: failed to resolve word id for "${word.native}"`,
          );
        }
        wordIdMap.set(word.native, stored.id);
      }
    }

    // Stable sentenceId: reuse from the existing doc when re-importing the same (deck, text)
    // pair, so user_sentence_states rows keyed on sentence_id are not orphaned.
    const existingSentenceIdByText = new Map<string, string>();
    if (existing) {
      for (const s of existing.doc.sentences)
        existingSentenceIdByText.set(s.native, s.sentenceId);
    }

    const sentences: DeckSentence[] = deck.lines.map((line, si) => {
      const components: DeckComponent[] = line.words.map((word, ci) => {
        const wordId = wordIdMap.get(word.native);
        if (!wordId) {
          throw new Error(
            `ContentStore.importCurriculum: component word "${word.native}" does not resolve to a global word id`,
          );
        }
        return {
          wordId,
          position: ci,
          romanization: word.romanization,
          english: word.english,
        };
      });

      return {
        sentenceId: existingSentenceIdByText.get(line.native) ?? randomUUID(),
        speaker: line.speaker,
        native: line.native,
        english: line.english,
        romanization: line.romanization,
        position: si,
        components,
      };
    });

    const doc: DeckDoc = DeckDocSchema.parse({ sentences });

    if (existing) {
      tx.update(schema.decks)
        .set({ doc })
        .where(eq(schema.decks.id, deckId))
        .run();
    } else {
      tx.insert(schema.decks)
        .values({
          id: deckId,
          name: deck.topic,
          language: 'th',
          difficulty: deck.difficulty ?? null,
          register: deck.register ?? null,
          created_at: new Date().toISOString(),
          doc,
        })
        .run();
    }

    // Rebuild deck_words to exactly match the words referenced by the doc just written
    tx.delete(schema.deck_words)
      .where(eq(schema.deck_words.deck_id, deckId))
      .run();
    const usedWordIds = new Set(
      sentences.flatMap((s) => s.components.map((c) => c.wordId)),
    );
    for (const wordId of usedWordIds) {
      tx.insert(schema.deck_words)
        .values({ deck_id: deckId, word_id: wordId })
        .onConflictDoNothing()
        .run();
    }
  }

  async close(): Promise<void> {
    this.db.$client.close();
  }
}
