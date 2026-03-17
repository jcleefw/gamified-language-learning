import { Hono } from 'hono';
import {
  ErrorCode,
  type ApiResponse,
  type BatchPayload,
  type QuizQuestion,
  type QuestionType,
  type QuestionDirection,
  type SubmitAnswersRequest,
  type SubmitAnswersResponse,
  type AnswerResultPayload,
  type MasteryPhase,
  type SeedPayload,
  type GetBatchRequest,
} from '@gll/api-contract';
import type { Question, MasteryPhase as EngineMasteryPhase } from '@gll/srs-engine';
import { deckId, wordStates, wordDetails, setWordStates, seedStore, type WordDetail } from '../state/store.js';
import { getEngine } from '../state/engine.js';
import { register, get } from '../state/batchRegistry.js';
import { getThaiConsonantsWordStates, getThaiConsonantsWordDetails } from '../state/seeds/thai-consonants.js';

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

const DIRECTIONS: QuestionDirection[] = ['english_to_native', 'native_to_english', 'native_to_romanization'];

function buildMcChoices(
  wordId: string,
  pool: Map<string, WordDetail>,
  direction: QuestionDirection,
): { choices: Record<string, string>; correctKey: string; targetText: string } {
  const detail = pool.get(wordId);
  let correctText: string;
  let targetText: string;
  let distractorField: (d: WordDetail) => string;

  if (direction === 'english_to_native') {
    correctText = detail?.native ?? '';
    targetText = detail?.english ?? '';
    distractorField = (d) => d.native;
  } else if (direction === 'native_to_romanization') {
    correctText = detail?.romanization ?? '';
    targetText = detail?.native ?? '';
    distractorField = (d) => d.romanization;
  } else {
    correctText = detail?.english ?? '';
    targetText = detail?.native ?? '';
    distractorField = (d) => d.english;
  }

  const distractors = shuffled(
    [...pool.entries()]
      .filter(([id]) => id !== wordId)
      .map(([, d]) => distractorField(d)),
  ).slice(0, 3);
  const texts = shuffled([correctText, ...distractors]);
  const choices: Record<string, string> = Object.fromEntries(
    CHOICE_KEYS.map((key, idx) => [key, texts[idx]!]),
  );
  const correctKey = CHOICE_KEYS.find((key) => choices[key] === correctText) ?? 'a';
  return { choices, correctKey, targetText };
}

srsRoutes.post('/batch', async (c) => {
  const body = await c.req.json<GetBatchRequest>();

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

  const caps = body.clientCapabilities;
  const fallbackType: 'mc' | 'wordBlock' | 'audio' | null = caps
    ? caps.mc !== false
      ? 'mc'
      : caps.wordBlock === true
        ? 'wordBlock'
        : caps.audio === true
          ? 'audio'
          : null
    : null;
  type EngineQuestion = (typeof batch.questions)[number];
  const normalizedQuestions: EngineQuestion[] = fallbackType
    ? batch.questions.map((q: EngineQuestion) => {
        const supported =
          (q.type === 'mc' && caps?.mc !== false) ||
          (q.type === 'wordBlock' && caps?.wordBlock === true) ||
          (q.type === 'audio' && caps?.audio === true);
        return supported ? q : { ...q, type: fallbackType as EngineQuestion['type'] };
      })
    : batch.questions;

  const correctKeys: Record<string, string> = {};
  const questions: QuizQuestion[] = normalizedQuestions.map((q) => {
    const questionType = ENGINE_TO_WIRE_TYPE[q.type];
    if (questionType === 'multiple_choice') {
      const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]!;
      const { choices, correctKey, targetText } = buildMcChoices(q.wordId, wordDetails, direction);
      correctKeys[q.wordId] = correctKey;
      return {
        wordId: q.wordId,
        questionType,
        targetText,
        choices,
        questionDirection: direction,
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
  mastered: 'anki_review',
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

  const engineAnswers = body.answers.map((a) => {
    const correctKey = registeredEntry.correctKeys[a.wordId] ?? '';
    return { wordId: a.wordId, isCorrect: a.selectedKey === correctKey };
  });
  const updatedStates = getEngine().processAnswers(engineAnswers, wordStates);
  setWordStates(updatedStates);

  const answeredIds = new Set(body.answers.map((a) => a.wordId));
  const updatedWords: AnswerResultPayload[] = updatedStates
    .filter((s) => answeredIds.has(s.wordId))
    .map((s) => {
      const answer = body.answers.find((a) => a.wordId === s.wordId);
      const correctKey = registeredEntry.correctKeys[s.wordId] ?? '';
      const submittedKey = answer?.selectedKey ?? '';
      return {
        wordId: s.wordId,
        submittedKey,
        correctKey,
        correct: submittedKey === correctKey,
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

srsRoutes.post('/seed', (c) => {
  seedStore(getThaiConsonantsWordStates(), getThaiConsonantsWordDetails());
  const res: ApiResponse<SeedPayload> = {
    success: true,
    data: { deckId, wordCount: wordDetails.size, phase: 'learning' },
  };
  return c.json(res, 200);
});

export default srsRoutes;
