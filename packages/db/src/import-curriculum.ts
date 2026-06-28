import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { AppDeck } from '@gll/api-contract';
import * as schema from './schema';

type DbClient = BetterSQLite3Database<typeof schema>;

export function importCurriculum(db: DbClient, decks: AppDeck[]): void {
  for (const deck of decks) {
    // Idempotency: reuse existing deck by name+language if already imported
    let deckId: string;
    const existingDeck = db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.name, deck.topic), eq(schema.decks.language, 'th')))
      .get();

    if (existingDeck) {
      deckId = existingDeck.id;
    } else {
      deckId = randomUUID();
      db.insert(schema.decks)
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
        db.insert(schema.words)
          .values({
            id: randomUUID(),
            language: 'th',
            text: word.native,
            senses: JSON.stringify([{ romanization: word.romanization, english: word.english, type: word.type }]),
          })
          .onConflictDoNothing()
          .run();
        const stored = db
          .select()
          .from(schema.words)
          .where(and(eq(schema.words.language, 'th'), eq(schema.words.text, word.native)))
          .get()!;
        wordIdMap.set(word.native, stored.id);
      }
    }

    // Insert sentences; read back actual sentenceId; insert components only if absent
    for (let si = 0; si < deck.lines.length; si++) {
      const line = deck.lines[si];
      const candidateId = randomUUID();
      db.insert(schema.sentences)
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

      const sentenceId = db
        .select()
        .from(schema.sentences)
        .where(and(eq(schema.sentences.deck_id, deckId), eq(schema.sentences.text, line.native)))
        .get()!.id;

      // Skip components if already populated (idempotency guard)
      const existingComponents = db
        .select()
        .from(schema.sentence_components)
        .where(eq(schema.sentence_components.sentence_id, sentenceId))
        .all();
      if (existingComponents.length > 0) continue;

      for (let ci = 0; ci < line.words.length; ci++) {
        const word = line.words[ci];
        const wordId = wordIdMap.get(word.native);
        if (!wordId) continue;
        db.insert(schema.sentence_components)
          .values({
            id: randomUUID(),
            sentence_id: sentenceId,
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
      db.insert(schema.deck_words)
        .values({ deck_id: deckId, word_id: wordId })
        .onConflictDoNothing()
        .run();
    }
  }
}
