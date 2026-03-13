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
import { deckId, wordStates, wordDetails, setWordStates, type WordDetail } from '../state/store.js';
import { getEngine } from '../state/engine.js';
import { register, get } from '../state/batchRegistry.js';

const srsRoutes = new Hono();

const ENGINE_TO_WIRE_TYPE: Record<Question['type'], QuestionType> = {
  mc: 'multiple_choice',
  wordBlock: 'word_block',
  audio: 'audio',
};

const CHOICE_KEYS = ['a', 'b', 'c', 'd'] as const;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function buildMcChoices(
  wordId: string,
  pool: Map<string, WordDetail>,
): { choices: Record<string, string>; correctKey: string } {
  const correctText = pool.get(wordId)?.native ?? '';
  const distractors = shuffled(
    [...pool.entries()].filter(([id]) => id !== wordId).map(([, detail]) => detail.native),
  ).slice(0, 3);
  const texts = shuffled([correctText, ...distractors]);
  const choices: Record<string, string> = Object.fromEntries(
    CHOICE_KEYS.map((key, idx) => [key, texts[idx]!]),
  );
  const correctKey = CHOICE_KEYS.find((key) => choices[key] === correctText) ?? 'a';
  return { choices, correctKey };
}

srsRoutes.post('/batch', async (c) => {
  const body = await c.req.json<{ deckId?: string }>();

  if (body.deckId !== deckId) {
    const res: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid deckId' },
    };
    return c.json(res, 400);
  }

  if (wordDetails.size < 4) {
    const res: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.INSUFFICIENT_WORD_POOL,
        message: `Cannot generate choices: need ≥4 unique words, got ${wordDetails.size}`,
      },
    };
    return c.json(res, 400);
  }

  const batch = getEngine().composeBatch(wordStates);

  const correctKeys: Record<string, string> = {};
  const questions: QuizQuestion[] = batch.questions.map((q) => {
    const questionType = ENGINE_TO_WIRE_TYPE[q.type];
    if (questionType === 'multiple_choice') {
      const { choices, correctKey } = buildMcChoices(q.wordId, wordDetails);
      correctKeys[q.wordId] = correctKey;
      return {
        wordId: q.wordId,
        questionType,
        targetText: wordDetails.get(q.wordId)?.native ?? '',
        choices,
      };
    }
    return {
      wordId: q.wordId,
      questionType,
      targetText: wordDetails.get(q.wordId)?.native ?? '',
      choices: {},
    };
  });

  const batchId = crypto.randomUUID();
  register(batchId, { questions, correctKeys });

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

  const registeredEntry = get(body.batchId);
  if (registeredEntry === undefined) {
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
        submittedKey: '',
        correctKey: '',
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
