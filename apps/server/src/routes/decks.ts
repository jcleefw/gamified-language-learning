import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { getDb, schema, importCurriculum } from '@gll/db';
import { ErrorCode, type ApiResponse, type GetDecksResponse, type AppDeckPayload, type AppWordPayload, type AppLinePayload, type ConversationJSON } from '@gll/api-contract';
import { transformConversation } from '../transform-conversation.js';

interface Sense {
  romanization: string;
  english: string;
  type: string;
}

const router = new Hono();

router.get('/decks', (c) => {
  const db = getDb();
  const deckRows = db.select().from(schema.decks).all();

  const result: AppDeckPayload[] = deckRows.map((deck) => {
    // Words for this deck via deck_words JOIN words
    const wordRows = db
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

    // Sentences ordered by position
    const sentenceRows = db
      .select()
      .from(schema.sentences)
      .where(eq(schema.sentences.deck_id, deck.id))
      .orderBy(asc(schema.sentences.position))
      .all();

    const lines: AppLinePayload[] = sentenceRows.map((sentence) => {
      const components = db
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
  });

  const body: ApiResponse<GetDecksResponse> = { success: true, data: result };
  return c.json(body);
});

router.post('/curriculum/import', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Body must be a single ConversationJSON object' },
    };
    return c.json(body, 400);
  }

  const conv = payload as ConversationJSON;
  const appDeck = transformConversation(conv);
  importCurriculum(getDb(), [appDeck]);

  return c.body(null, 201);
});

export default router;
