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
  resolveEligibleContexts,
  updateSentenceRunState,
  type AdaptiveSessionState,
  type SessionConfig,
  type BatchOutput,
  type BatchState,
  type MCQQuestion,
  type SentenceQuestion,
  type QuizResult,
  type WordQuizResult,
  type QuizItem,
  type RunState,
  type StreakThresholds,
  type MockDeck,
  type SentenceContext,
  type SentenceRunState,
  type SentenceQuizResult,
  type WordState,
  type SentenceState,
  type GraduationHook,
  isMastered,
} from '@gll/srs-engine-v2';
import { LEARNING_CONFIG } from './config.js';
import type { AutoAnswerStrategy } from './auto-answer-strategy.js';
import { runAutoInteractive } from './auto-answerer.js';

const WORD_ID_PREFIX = 'th::';
const KEYBOARD_EXIT = '';
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
  return { correct: score, total: state.initialCount, state };
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

async function runBatch(
  batchNum: number,
  state: AdaptiveSessionState,
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,
  sentenceRunState: SentenceRunState,
  corpus: SentenceContext[],
  strategy?: AutoAnswerStrategy,
): Promise<BatchOutput & { correct: number; total: number }> {
  console.log(`\n=== Batch ${String(batchNum)} ===`);

  const allPool = [...wordPool, ...foundationalPool];
  const extraThunks = resolveEligibleContexts(corpus, state.runState, allPool, sentenceRunState, batchNum, LEARNING_CONFIG).map(
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
  initialSentenceRunState: SentenceRunState = new Map(),
  recheckIds: Set<string> = new Set(),
  strategy: AutoAnswerStrategy | undefined,
  corpus: SentenceContext[],
  onWordAnswer?: (state: WordState) => void,
  onSentenceAnswer?: (state: SentenceState) => void,
  onGraduation?: GraduationHook,
): Promise<{ runState: RunState; sentenceRunState: SentenceRunState }> {
  const config: SessionConfig = {
    wordsPerBatch,
    masteryThreshold,
    streakThresholds,
    maxRetryPerSession: 5,
  };

  const snapshotRunState = new Map(initialRunState);
  let state = initAdaptiveSession(words, config, recheckIds, initialRunState);
  const sentenceRunState: SentenceRunState = new Map(initialSentenceRunState);
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
      corpus,
      strategy,
    );
    totalCorrect += correct;
    totalQuestions += total;

    const sentenceResults = results.filter(
      (r): r is SentenceQuizResult => 'sentenceId' in r,
    );
    updateSentenceRunState(
      sentenceRunState,
      sentenceResults,
      currentBatchNum,
      LEARNING_CONFIG,
    );
    if (onSentenceAnswer) {
      for (const r of sentenceResults) {
        const ss = sentenceRunState.get(r.sentenceId);
        if (ss) onSentenceAnswer(ss);
      }
    }

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
    if (onWordAnswer) {
      for (const wordId of batchWordIds) {
        const ws = state.runState.get(wordId);
        if (!ws) throw new Error(`runState missing entry for answered word: ${wordId}`);
        onWordAnswer(ws);
      }
    }
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

  if (onGraduation) {
    const graduatedWordIds: string[] = [];
    for (const [wordId, ws] of state.runState) {
      if (isMastered(ws, masteryThreshold)) {
        const prev = snapshotRunState.get(wordId);
        if (!prev || !isMastered(prev, masteryThreshold)) {
          graduatedWordIds.push(wordId);
        }
      }
    }
    onGraduation(graduatedWordIds, state.runState);
  }

  console.log('\n=== Run Complete ===');
  console.log(`Batches: ${String(state.batchNum)}`);
  console.log(`Score:   ${String(totalCorrect)} / ${String(totalQuestions)}`);
  console.log(`Mastered: ${String(totalMastered)}`);

  return { runState: state.runState, sentenceRunState };
}
