import { Hono } from 'hono';
import { ErrorCode, type ApiResponse, type BatchPayload, type QuizQuestion, type QuestionType } from '@gll/api-contract';
import type { Question } from '@gll/srs-engine';
import { deckId, wordStates, wordDetails } from '../state/store.js';
import { getEngine } from '../state/engine.js';
import { register } from '../state/batchRegistry.js';

const srsRoutes = new Hono();

const ENGINE_TO_WIRE_TYPE: Record<Question['type'], QuestionType> = {
  mc: 'multiple_choice',
  wordBlock: 'word_block',
  audio: 'audio',
};

srsRoutes.post('/batch', async (c) => {
  const body = await c.req.json<{ deckId?: string }>();

  if (body.deckId !== deckId) {
    const res: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid deckId' },
    };
    return c.json(res, 400);
  }

  const batch = getEngine().composeBatch(wordStates);

  const questions: QuizQuestion[] = batch.questions.map((q) => ({
    wordId: q.wordId,
    questionType: ENGINE_TO_WIRE_TYPE[q.type],
    targetText: wordDetails.get(q.wordId)?.native ?? '',
  }));

  const batchId = crypto.randomUUID();
  register(batchId, questions);

  const res: ApiResponse<BatchPayload> = {
    success: true,
    data: { batchId, questions, batchSize: batch.batchSize },
  };
  return c.json(res, 200);
});

export default srsRoutes;
