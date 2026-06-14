/* eslint-disable no-console */

import {
  composeSentenceBatch,
  assembleBatch,
  initAdaptiveSession,
  advanceAdaptiveSession,
  getNewlyMasteredIds,
  initBatchState,
  nextQuestion,
  submitBatchResult,
  finishBatch,
  isBatchDone,
  type AdaptiveSessionState,
  type SessionConfig,
  type BatchOutput,
  type BatchState,
  type MCQQuestion,
  type QuizQuestion,
  type SentenceQuestion,
  type SentenceTile,
  type QuizResult,
  type WordQuizResult,
  type QuizItem,
  type RunState,
  type StreakThresholds,
  type MockDeck,
  type SentenceContext,
  type SentenceRunState,
  defaultSentenceState,
  type SentenceQuizResult,
} from '../src/index.js';
import { mockSentenceCorpus } from '../data/mock/mock-sentence-corpus.js';
import { LEARNING_CONFIG } from './config.js';
import type { AutoAnswerStrategy } from './auto-answer-strategy.js';
import { runAutoInteractive } from './auto-answerer.js';

const WORD_ID_PREFIX = 'th::';
const KEYBOARD_EXIT = '';
const BATCH_PROMPT = '\nNext batch? (y/n): ';

async function readFromStdin(
  options: { raw?: boolean; trim?: boolean } = {},
): Promise<string> {
  return new Promise((resolve) => {
    if (options.raw) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data: string) => {
      if (options.raw) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      const result = options.trim ? data.trim().toLowerCase() : data;
      resolve(result);
    });
  });
}

function readKey(): Promise<string> {
  return readFromStdin({ raw: true });
}

function readLine(): Promise<string> {
  return readFromStdin({ raw: false, trim: true });
}

export async function selectDeck(decks: MockDeck[]): Promise<MockDeck> {
  if (decks.length === 0) {
    throw new Error('selectDeck: No decks available');
  }
  console.log('\nAvailable decks:');
  for (let i = 0; i < decks.length; i++) {
    console.log(`  ${String(i + 1)}. ${decks[i].topic}`);
  }
  process.stdout.write(`Select a deck (1-${String(decks.length)}): `);

  for (;;) {
    const key = (await readKey()).toLowerCase();
    if (key === KEYBOARD_EXIT) process.exit();
    const num = parseInt(key, 10);
    if (num >= 1 && num <= decks.length) {
      console.log(num);
      return decks[num - 1];
    }
  }
}

async function runInteractiveMCQ(
  question: MCQQuestion,
  index: number,
  total: number,
): Promise<QuizResult> {
  if (question.choices.length === 0)
    throw new Error(
      `runInteractive: Question ${String(index + 1)} has no choices`,
    );

  console.log(`\nQuestion ${String(index + 1)} of ${String(total)}`);
  console.log(question.prompt);
  for (const choice of question.choices) {
    console.log(`  ${choice.label}) ${choice.value}`);
  }
  const correct = question.choices.find((c) => c.isCorrect);
  if (!correct)
    throw new Error(
      `runInteractiveMCQ: Question ${String(index + 1)} has no correct answer marked`,
    );
  console.log(`Correct answer: ${correct.label}) ${correct.value}`);
  process.stdout.write('Your answer (a/b/c/d): ');

  let answer: string;
  for (;;) {
    const key = (await readKey()).toLowerCase();
    if (key === KEYBOARD_EXIT) process.exit();
    if (['a', 'b', 'c', 'd'].includes(key)) {
      answer = key;
      break;
    }
  }
  console.log(answer);

  const selected = question.choices.find((c) => c.label === answer);
  const wasCorrect = selected?.isCorrect === true;
  console.log(
    wasCorrect ? 'Correct!' : `Wrong — correct answer was: ${correct.value}`,
  );
  return { wordId: question.wordId, correct: wasCorrect };
}

async function runInteractiveWordBlock(
  question: SentenceQuestion,
  index: number,
  total: number,
): Promise<QuizResult> {
  console.log(
    `\nQuestion ${String(index + 1)} of ${String(total)} [word-block: ${question.direction}]`,
  );
  console.log(question.prompt);
  console.log('Arrange the tiles:');
  question.tiles.forEach((tile, i) => {
    let face: string;
    switch (question.direction) {
      case 'english-to-native':
      case 'romanization-to-native':
        face = tile.native;
        break;
      case 'native-to-romanization':
        face = tile.romanization;
        break;
      default:
        throw new Error(
          `Unsupported word-block direction: ${question.direction}`,
        );
    }
    console.log(`  ${String(i + 1)}) ${face}`);
  });

  const correctOrder = question.answer
    .map((wordId) => {
      const tileIndex = question.tiles.findIndex((t) => t.wordId === wordId);
      return String(tileIndex + 1);
    })
    .join(' ');
  console.log(`Correct order: ${correctOrder}`);
  process.stdout.write('Your order (e.g. 2 1 3): ');

  const input = await readLine();
  // accept "4 3 2 1" or "4321" — split on whitespace, then expand any run-together digits
  const tokens = input
    .trim()
    .split(/\s+/)
    .flatMap((t) => (t.length > 1 ? t.split('') : [t]));
  const selectedIds = tokens
    .map((n) => parseInt(n, 10) - 1)
    .filter((i) => i >= 0 && i < question.tiles.length)
    .map((i) => question.tiles[i].wordId);

  const wasCorrect =
    JSON.stringify(selectedIds) === JSON.stringify(question.answer);
  console.log(
    wasCorrect ? 'Correct!' : `Wrong — correct answer was: ${correctOrder}`,
  );
  return { sentenceId: question.sentenceId, correct: wasCorrect };
}

export async function runInteractive(
  initialState: BatchState,
): Promise<{ correct: number; total: number; state: BatchState }> {
  let score = 0;
  let count = 0;
  let state = initialState;

  for (;;) {
    const { question, state: nextState } = nextQuestion(state);
    state = nextState;
    if (!question) break;
    count++;

    const result =
      question.kind === 'mcq'
        ? await runInteractiveMCQ(question, count - 1, state.initialCount)
        : await runInteractiveWordBlock(question, count - 1, state.initialCount);

    if (result.correct) score++;
    state = submitBatchResult(state, result);
  }

  console.log(`\nScore: ${String(score)} / ${String(state.initialCount)}`);
  return { correct: score, total: count, state };
}


function printWordSummary(
  runState: RunState,
  wordIds: string[],
  maxMastery: number,
): void {
  console.log('\nWord results:');
  for (const wordId of wordIds) {
    const wordState = runState.get(wordId);
    if (wordState) {
      console.log(
        `  ${wordId.replace(WORD_ID_PREFIX, '')}   seen: ${String(wordState.seen)}  correct: ${String(wordState.correct)}  mastery: ${String(wordState.mastery)}/${String(maxMastery)}  streaks: +${String(wordState.correctStreak)}/-${String(wordState.wrongStreak)}`,
      );
    }
  }
}

export function resolveEligibleContexts(
  runState: RunState,
  allPool: QuizItem[],
  sentenceRunState: SentenceRunState,
  batchNum: number,
): { ctx: SentenceContext; tiles: SentenceTile[] }[] {
  const corpus = LEARNING_CONFIG.debugSentenceEligibility
    ? mockSentenceCorpus
    : mockSentenceCorpus.filter((ctx) => {
        // 1. Word-seen gate: all wordIds seen >= minSeenForSentence
        const wordSeenPass = ctx.wordOrder.every(
          (id) =>
            (runState.get(id)?.seen ?? 0) >= LEARNING_CONFIG.minSeenForSentence,
        );
        if (!wordSeenPass) return false;

        // Fetch sentence scheduling state (with defaults for never-seen sentences)
        const sState =
          sentenceRunState.get(ctx.sentenceId) ??
          defaultSentenceState(ctx.sentenceId);

        // 2. Active gate: false = shelved or graduated
        if (!sState.active) return false;

        // 3. Spacing / Batch-gap gate: must be > sentenceBatchGap
        if (sState.lastBatchSeen !== -1) {
          const gap = batchNum - sState.lastBatchSeen;
          if (gap <= LEARNING_CONFIG.sentenceBatchGap) {
            return false;
          }
        }

        return true;
      });

  return corpus
    .map((ctx) => {
      const tiles: SentenceTile[] = ctx.wordOrder.flatMap((id) => {
        const item = allPool.find((w) => w.id === id);
        if (!item) return [];
        return [
          {
            wordId: item.id,
            native: item.native,
            romanization: item.romanization,
            english: item.english,
          },
        ];
      });
      return { ctx, tiles };
    })
    .filter(({ ctx: c, tiles }) => tiles.length === c.wordOrder.length);
}

export function updateSentenceRunState(
  sentenceRunState: SentenceRunState,
  results: SentenceQuizResult[],
  batchNum: number,
  config: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  },
): SentenceRunState {
  for (const r of results) {
    const existing =
      sentenceRunState.get(r.sentenceId) ??
      defaultSentenceState(r.sentenceId);

    if (r.correct) {
      existing.sentenceStreak += 1;
      existing.sessionWrongStreak = 0;
      if (existing.sentenceStreak >= config.sentenceCorrectStreakThreshold) {
        existing.active = false;
      }
    } else {
      existing.sessionWrongStreak += 1;
      existing.sentenceStreak = 0;
      if (existing.sessionWrongStreak >= config.sentenceWrongStreakThreshold) {
        existing.active = false;
      }
    }
    existing.lastBatchSeen = batchNum;
    sentenceRunState.set(r.sentenceId, existing);
  }
  return sentenceRunState;
}

async function runBatch(
  batchNum: number,
  state: AdaptiveSessionState,
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,
  sentenceRunState: SentenceRunState,
  strategy?: AutoAnswerStrategy,
): Promise<BatchOutput & { correct: number; total: number }> {
  console.log(`\n=== Batch ${String(batchNum)} ===`);

  const allPool = [...wordPool, ...foundationalPool];
  const extraThunks = resolveEligibleContexts(state.runState, allPool, sentenceRunState, batchNum).map(
    ({ ctx, tiles }) =>
      () =>
        composeSentenceBatch(ctx, tiles, 'th', { shuffle: !strategy }),
  );

  const questions = assembleBatch(
    state.active,
    wordPool,
    foundationalPool,
    wordsPerBatch,
    {
      shuffle: !strategy,
      extraThunks,
    },
  );

  let batchState = initBatchState(
    questions,
    LEARNING_CONFIG.maxRetryPerWord,
    state.sessionRetryCounts,
    LEARNING_CONFIG.maxRetryPerSession,
  );

  let runStats;
  if (strategy) {
    runStats = await runAutoInteractive(batchState, strategy);
  } else {
    runStats = await runInteractive(batchState);
  }

  const output = finishBatch(runStats.state);
  return {
    ...output,
    correct: runStats.correct,
    total: runStats.total,
  };
}

export async function runAdaptiveLoop(
  words: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,
  masteryThreshold: number,
  streakThresholds: StreakThresholds,
  initialRunState: RunState = new Map(),
  recheckIds: Set<string> = new Set(),
  strategy?: AutoAnswerStrategy,
): Promise<RunState> {
  const config: SessionConfig = {
    wordsPerBatch,
    masteryThreshold,
    streakThresholds,
    maxRetryPerSession: 5,
  };

  let state = initAdaptiveSession(words, config, recheckIds, initialRunState);
  const sentenceRunState: SentenceRunState = new Map();
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalMastered = 0;

  for (;;) {
    if (state.active.length === 0 && state.queue.length === 0) break;

    const currentBatchNum = state.batchNum + 1;
    const {
      correct,
      total,
      results,
      sessionRetryCounts,
    } = await runBatch(
      currentBatchNum,
      state,
      wordPool,
      foundationalPool,
      wordsPerBatch,
      sentenceRunState,
      strategy,
    );
    totalCorrect += correct;
    totalQuestions += total;

    // Update sentence run state with correct/wrong results, streaks, deactivations, and last batch seen
    const sentenceResults = results.filter(
      (r): r is SentenceQuizResult => 'sentenceId' in r,
    );
    updateSentenceRunState(
      sentenceRunState,
      sentenceResults,
      currentBatchNum,
      LEARNING_CONFIG,
    );

    const batchOutput: BatchOutput = {
      results,
      sessionRetryCounts,
    };

    const prevState = state.runState;
    state = advanceAdaptiveSession(state, batchOutput, config);

    const wordResults = results.filter(
      (r): r is WordQuizResult => 'wordId' in r,
    );
    const batchWordIds = [...new Set(wordResults.map((r) => r.wordId))];
    const newlyMasteredIds = getNewlyMasteredIds(
      prevState,
      state.runState,
      batchWordIds,
      masteryThreshold,
    );

    totalMastered += newlyMasteredIds.length;

    printWordSummary(state.runState, batchWordIds, streakThresholds.maxMastery);
    for (const wordId of newlyMasteredIds) {
      console.log(`Mastered: ${wordId.replace(WORD_ID_PREFIX, '')}`);
    }

    if (state.active.length > 0 || state.queue.length > 0) {
      if (strategy) {
        continue;
      } else {
        process.stdout.write(BATCH_PROMPT);
        const answer = await readLine();
        if (answer !== 'y') break;
      }
    }
  }

  console.log('\n=== Run Complete ===');
  console.log(`Batches: ${String(state.batchNum)}`);
  console.log(`Score:   ${String(totalCorrect)} / ${String(totalQuestions)}`);
  console.log(`Mastered: ${String(totalMastered)}`);

  return state.runState;
}
