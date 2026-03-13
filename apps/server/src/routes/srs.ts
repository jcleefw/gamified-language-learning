import { Hono } from 'hono';
import {
  ErrorCode,
  type ApiResponse,
  type BatchPayload,
  type QuizQuestion,
  type QuestionType,
  type SubmitAnswersRequest,
  type SubmitAnswersResponse,
  type AnswerResultPayload,
  type MasteryPhase,
} from '@gll/api-contract';
import type { Question, MasteryPhase as EngineMasteryPhase } from '@gll/srs-engine';
import { deckId, wordStates, wordDetails, setWordStates } from '../state/store.js';
import { getEngine } from '../state/engine.js';
import { register, get } from '../state/batchRegistry.js';

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

const ENGINE_TO_WIRE_PHASE: Record<EngineMasteryPhase, MasteryPhase> = {
  learning: 'learning',
  srsM2_review: 'anki_review',
};

srsRoutes.post('/answers', async (c) => {
  const body = await c.req.json<SubmitAnswersRequest>();

  const registeredQuestions = get(body.batchId);
  if (registeredQuestions === undefined) {
    const res: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.NOT_FOUND, message: 'Unknown batchId' },
    };
    return c.json(res, 404);
  }

  const engineAnswers = body.answers.map((a) => ({ wordId: a.wordId, isCorrect: a.correct }));
  const updatedStates = getEngine().processAnswers(engineAnswers, wordStates);
  setWordStates(updatedStates);

  const answeredIds = new Set(body.answers.map((a) => a.wordId));
  const updatedWords: AnswerResultPayload[] = updatedStates
    .filter((s) => answeredIds.has(s.wordId))
    .map((s) => {
      const answer = body.answers.find((a) => a.wordId === s.wordId);
      return {
        wordId: s.wordId,
        correct: answer?.correct ?? false,
        masteryCount: s.masteryCount,
        phase: ENGINE_TO_WIRE_PHASE[s.phase],
      };
    });

  const res: ApiResponse<SubmitAnswersResponse> = {
    success: true,
    data: { processed: body.answers.length, updatedWords },
  };
  return c.json(res, 200);
});

export default srsRoutes;
