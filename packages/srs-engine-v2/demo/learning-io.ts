/* eslint-disable no-console */

import {
  composeWordBatchMulti,
  composeSentenceBatch,
  nextActivePool,
  updateMasteryState,
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
} from '../src/index.js';
import { mockSentenceCorpus } from '../data/mock/mock-sentence-corpus.js';
import { LEARNING_CONFIG } from './config.js';
import type { AutoAnswerStrategy } from './auto-answer-strategy.js';
import { runAutoInteractive } from './auto-answerer.js';

const WORD_ID_PREFIX = 'th::';
const KEYBOARD_EXIT = '';
const BATCH_PROMPT = '\nNext batch? (y/n): ';

async function readFromStdin(options: { raw?: boolean; trim?: boolean } = {}): Promise<string> {
  return new Promise(resolve => {
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

async function runInteractiveMCQ(question: MCQQuestion, index: number, total: number): Promise<QuizResult> {
  if (question.choices.length === 0) throw new Error(`runInteractive: Question ${String(index + 1)} has no choices`);

  console.log(`\nQuestion ${String(index + 1)} of ${String(total)}`);
  console.log(question.prompt);
  for (const choice of question.choices) {
    console.log(`  ${choice.label}) ${choice.value}`);
  }
  const correct = question.choices.find(c => c.isCorrect);
  if (!correct) throw new Error(`runInteractiveMCQ: Question ${String(index + 1)} has no correct answer marked`);
  console.log(`Correct answer: ${correct.label}) ${correct.value}`);
  process.stdout.write('Your answer (a/b/c/d): ');

  let answer: string;
  for (;;) {
    const key = (await readKey()).toLowerCase();
    if (key === KEYBOARD_EXIT) process.exit();
    if (['a', 'b', 'c', 'd'].includes(key)) { answer = key; break; }
  }
  console.log(answer);

  const selected = question.choices.find(c => c.label === answer);
  const wasCorrect = selected?.isCorrect === true;
  console.log(wasCorrect ? 'Correct!' : `Wrong — correct answer was: ${correct.value}`);
  return { wordId: question.wordId, correct: wasCorrect };
}

async function runInteractiveWordBlock(question: SentenceQuestion, index: number, total: number): Promise<QuizResult> {
  console.log(`\nQuestion ${String(index + 1)} of ${String(total)} [word-block: ${question.direction}]`);
  console.log(question.prompt);
  console.log('Arrange the tiles:');
  question.tiles.forEach((tile, i) => {
    let face: string;
    switch (question.direction) {
      case 'english-to-native':
      case 'romanization-to-native': face = tile.native; break;
      case 'native-to-romanization': face = tile.romanization; break;
      default: throw new Error(`Unsupported word-block direction: ${question.direction}`);
    }
    console.log(`  ${String(i + 1)}) ${face}`);
  });

  const correctOrder = question.answer.map(wordId => {
    const tileIndex = question.tiles.findIndex(t => t.wordId === wordId);
    return String(tileIndex + 1);
  }).join(' ');
  console.log(`Correct order: ${correctOrder}`);
  process.stdout.write('Your order (e.g. 2 1 3): ');

  const input = await readLine();
  // accept "4 3 2 1" or "4321" — split on whitespace, then expand any run-together digits
  const tokens = input.trim().split(/\s+/).flatMap(t => t.length > 1 ? t.split('') : [t]);
  const selectedIds = tokens
    .map(n => parseInt(n, 10) - 1)
    .filter(i => i >= 0 && i < question.tiles.length)
    .map(i => question.tiles[i].wordId);

  const wasCorrect = JSON.stringify(selectedIds) === JSON.stringify(question.answer);
  console.log(wasCorrect ? 'Correct!' : `Wrong — correct answer was: ${correctOrder}`);
  return { sentenceId: question.sentenceId, correct: wasCorrect };
}

export async function runInteractive(questions: QuizQuestion[]): Promise<{ correct: number; total: number; results: QuizResult[] }> {
  if (questions.length === 0) throw new Error('runInteractive: No questions provided');

  let score = 0;
  const results: QuizResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const result = question.kind === 'mcq'
      ? await runInteractiveMCQ(question, i, questions.length)
      : await runInteractiveWordBlock(question, i, questions.length);

    if (result.correct) score++;
    results.push(result);
  }

  console.log(`\nScore: ${String(score)} / ${String(questions.length)}`);
  return { correct: score, total: questions.length, results };
}

function printWordSummary(runState: RunState, wordIds: string[], maxMastery: number): void {
  console.log('\nWord results:');
  for (const wordId of wordIds) {
    const wordState = runState.get(wordId);
    if (wordState) {
      console.log(`  ${wordId.replace(WORD_ID_PREFIX, '')}   seen: ${String(wordState.seen)}  correct: ${String(wordState.correct)}  mastery: ${String(wordState.mastery)}/${String(maxMastery)}  streaks: +${String(wordState.correctStreak)}/-${String(wordState.wrongStreak)}`);
    }
  }
}

function resolveEligibleContexts(runState: RunState, allPool: QuizItem[]): { ctx: SentenceContext; tiles: SentenceTile[] }[] {
  const corpus = LEARNING_CONFIG.debugSentenceEligibility
    ? mockSentenceCorpus
    : mockSentenceCorpus.filter(ctx =>
        ctx.wordOrder.every(id => (runState.get(id)?.seen ?? 0) >= LEARNING_CONFIG.minSeenForSentence)
      );

  return corpus.map(ctx => {
    const tiles: SentenceTile[] = ctx.wordOrder.flatMap(id => {
      const item = allPool.find(w => w.id === id);
      if (!item) return [];
      return [{ wordId: item.id, native: item.native, romanization: item.romanization, english: item.english }];
    });
    return { ctx, tiles };
  }).filter(({ ctx: c, tiles }) => tiles.length === c.wordOrder.length);
}

async function runBatch(
  batchNum: number,
  activeItems: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  questionLimit: number,
  runState: RunState,
  strategy?: AutoAnswerStrategy,
): Promise<{ correct: number; total: number; results: QuizResult[] }> {
  console.log(`\n=== Batch ${String(batchNum)} ===`);

  const activeFoundational = activeItems.filter(item => 'foundationalType' in item);
  const activeWords = activeItems.filter(item => !('foundationalType' in item));
  const consonantLimit = activeItems.length > 0
    ? Math.round(questionLimit * activeFoundational.length / activeItems.length)
    : 0;
  const wordLimit = questionLimit - consonantLimit;

  const shouldShuffle = !strategy;
  const foundationalQs = activeFoundational.length > 0
    ? composeWordBatchMulti(activeFoundational, foundationalPool, { questionLimit: consonantLimit, shuffle: shouldShuffle })
    : [];
  const wordQs = activeWords.length > 0
    ? composeWordBatchMulti(activeWords, wordPool, { questionLimit: wordLimit, shuffle: shouldShuffle })
    : [];

  const allPool = [...wordPool, ...foundationalPool];
  const sentenceQs = resolveEligibleContexts(runState, allPool).flatMap(({ ctx, tiles }) =>
    composeSentenceBatch(ctx, tiles, 'th', { shuffle: shouldShuffle })
  );

  const questions: QuizQuestion[] = [...foundationalQs, ...wordQs, ...sentenceQs].sort(() => Math.random() - 0.5);

  if (strategy) {
    return runAutoInteractive(questions, strategy);
  } else {
    return await runInteractive(questions);
  }
}

export async function runAdaptiveLoop(
  words: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  questionLimit: number,
  masteryThreshold: number,
  streakThresholds: StreakThresholds,
  initialRunState: RunState = new Map(),
  recheckIds: Set<string> = new Set(),
  strategy?: AutoAnswerStrategy,
): Promise<RunState> {
  let active: QuizItem[] = words.filter(w => recheckIds.has(w.id));
  let queue: QuizItem[] = words.filter(w => !recheckIds.has(w.id));
  let runState: RunState = new Map(initialRunState);
  let recheckPending = new Set(recheckIds);
  let recheckReentered = new Set<string>();
  let batchNum = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalMastered = 0;

  for (;;) {
    const recheckExempt = new Set([...recheckPending, ...recheckReentered]);
    ({ active, queue } = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, recheckExempt));

    if (active.length === 0 && queue.length === 0) break;

    batchNum++;
    const prevState = runState;

    const { correct, total, results } = await runBatch(batchNum, active, wordPool, foundationalPool, questionLimit, runState, strategy);
    totalCorrect += correct;
    totalQuestions += total;

    const wordResults = results.filter((r): r is WordQuizResult => 'wordId' in r);
    const batchWordIds = [...new Set(wordResults.map(r => r.wordId))];
    const { runState: nextRunState, recheckPending: nextRecheckPending, recheckReentered: nextRecheckReentered, newlyMasteredIds } =
      updateMasteryState(wordResults, runState, prevState, recheckPending, recheckReentered, masteryThreshold, streakThresholds);

    runState = nextRunState;
    recheckPending = nextRecheckPending;
    recheckReentered = nextRecheckReentered;
    totalMastered += newlyMasteredIds.length;

    printWordSummary(runState, batchWordIds, streakThresholds.maxMastery);
    for (const wordId of newlyMasteredIds) {
      console.log(`Mastered: ${wordId.replace(WORD_ID_PREFIX, '')}`);
    }

    const peekExempt = new Set([...recheckPending, ...recheckReentered]);
    const peek = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, peekExempt);
    if (peek.active.length > 0 || peek.queue.length > 0) {
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
  console.log(`Batches: ${String(batchNum)}`);
  console.log(`Score:   ${String(totalCorrect)} / ${String(totalQuestions)}`);
  console.log(`Mastered: ${String(totalMastered)}`);

  return runState;
}
