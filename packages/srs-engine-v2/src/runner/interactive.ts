/* eslint-disable no-console */

import type { QuizQuestion } from '../types/quiz.js';
import { type RunState, type StreakThresholds, updateRunState, isMastered } from '../types/word-state.js';
import { composeBatchMulti, type QuizItem } from '../engine/compose-batch.js';
import type { MockDeck } from '../types/deck.js';
import type { AnswerStrategy } from '../types/answer-strategy.js';
import { runAutoInteractive } from './auto-answerer.js';

// Constants
const WORD_ID_PREFIX = 'th::';
const KEYBOARD_EXIT = '\u0003';
const BATCH_PROMPT = '\nNext batch? (y/n): ';

// Stdin helper
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

export interface QuizResult {
  wordId: string;
  correct: boolean;
}

export async function runInteractive(questions: QuizQuestion[]): Promise<{ correct: number; total: number; results: QuizResult[] }> {
  if (questions.length === 0) {
    throw new Error('runInteractive: No questions provided');
  }

  let score = 0;
  const results: QuizResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    if (question.choices.length === 0) {
      throw new Error(`runInteractive: Question ${String(i + 1)} has no choices`);
    }
    if (!question.choices.find(c => c.isCorrect)) {
      throw new Error(`runInteractive: Question ${String(i + 1)} has no correct answer marked`);
    }

    console.log(`\nQuestion ${String(i + 1)} of ${String(questions.length)}`);
    console.log(question.prompt);
    for (const choice of question.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }
    process.stdout.write('Your answer (a/b/c/d): ');

    let answer: string;
    for (;;) {
      const key = (await readKey()).toLowerCase();
      if (key === KEYBOARD_EXIT) process.exit(); // Ctrl+C
      if (['a', 'b', 'c', 'd'].includes(key)) { answer = key; break; }
    }

    console.log(answer);

    const selected = question.choices.find(c => c.label === answer);
    if (!selected) {
      throw new Error(`runInteractive: Invalid choice "${answer}" for question ${String(i + 1)}`);
    }
    const correct = question.choices.find(c => c.isCorrect);
    if (!correct) {
      throw new Error(`runInteractive: Question ${String(i + 1)} has no correct answer`);
    }
    const wasCorrect = selected.isCorrect;

    if (wasCorrect) {
      console.log('Correct!');
      score++;
    } else {
      console.log(`Wrong — correct answer was: ${correct.value}`);
    }

    results.push({ wordId: question.wordId, correct: wasCorrect });
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

const DEFAULT_STREAK_THRESHOLDS: StreakThresholds = {
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
  maxMastery: 5,
};

export interface RecheckResultOutput {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
}

export function processRecheckResult(
  wordId: string,
  wasCorrect: boolean,
  runState: RunState,
  recheckPending: Set<string>,
  recheckReentered: Set<string>,
  masteryThreshold: number,
  streakThresholds: StreakThresholds = DEFAULT_STREAK_THRESHOLDS,
): RecheckResultOutput {
  const nextPending = new Set(recheckPending);
  const nextReentered = new Set(recheckReentered);
  let nextState = runState;

  if (nextPending.has(wordId)) {
    nextPending.delete(wordId);
    // Always record the attempt (seen/correct) but never touch streaks or mastery
    const existing = runState.get(wordId) ?? { wordId, seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 };
    const updated = new Map(runState);
    updated.set(wordId, { ...existing, seen: existing.seen + 1, correct: existing.correct + (wasCorrect ? 1 : 0) });
    nextState = updated;
    if (!wasCorrect) {
      nextReentered.add(wordId);
    }
  } else {
    // normal word or recheckReentered — apply normal rules
    nextState = updateRunState(runState, wordId, wasCorrect, streakThresholds);
    if (nextReentered.has(wordId)) {
      const wordState = nextState.get(wordId);
      if (wordState && !isMastered(wordState, masteryThreshold)) {
        nextReentered.delete(wordId);
      }
    }
  }

  return { runState: nextState, recheckPending: nextPending, recheckReentered: nextReentered };
}

export function nextActivePool(
  active: QuizItem[],
  queue: QuizItem[],
  questionLimit: number,
  runState: RunState,
  masteryThreshold: number,
  recheckExempt: Set<string> = new Set(),
): { active: QuizItem[]; queue: QuizItem[] } {
  const remaining = active.filter(item => {
    if (recheckExempt.has(item.id)) return true;
    const wordState = runState.get(item.id);
    return !wordState || !isMastered(wordState, masteryThreshold);
  });

  const freeSlots = questionLimit - remaining.length;
  const newItems = queue.slice(0, freeSlots);
  const newQueue = queue.slice(freeSlots);

  return { active: [...remaining, ...newItems], queue: newQueue };
}

async function runBatch(
  batchNum: number,
  activeItems: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  questionLimit: number,
  strategy?: AnswerStrategy,
): Promise<{ correct: number; total: number; results: QuizResult[] }> {
  console.log(`\n=== Batch ${String(batchNum)} ===`);

  const activeFoundational = activeItems.filter(item => 'class' in item);
  const activeWords = activeItems.filter(item => !('class' in item));
  const consonantLimit = activeItems.length > 0
    ? Math.round(questionLimit * activeFoundational.length / activeItems.length)
    : 0;
  const wordLimit = questionLimit - consonantLimit;

  const shouldShuffle = !strategy; // Only shuffle when in interactive mode (no strategy)
  const foundationalQs = activeFoundational.length > 0
    ? composeBatchMulti(activeFoundational, foundationalPool, { questionLimit: consonantLimit, shuffle: shouldShuffle })
    : [];
  const wordQs = activeWords.length > 0
    ? composeBatchMulti(activeWords, wordPool, { questionLimit: wordLimit, shuffle: shouldShuffle })
    : [];
  const questions = [...foundationalQs, ...wordQs].sort(() => Math.random() - 0.5);

  if (strategy) {
    return await runAutoInteractive(questions, strategy);
  } else {
    return await runInteractive(questions);
  }
}

interface MasteryUpdateResult {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  masteredCount: number;
}

function updateMasteryState(
  results: QuizResult[],
  runState: RunState,
  prevState: RunState,
  recheckPending: Set<string>,
  recheckReentered: Set<string>,
  masteryThreshold: number,
  streakThresholds: StreakThresholds,
): MasteryUpdateResult {
  let nextRunState = runState;
  let nextRecheckPending = recheckPending;
  let nextRecheckReentered = recheckReentered;
  let masteredCount = 0;

  const batchWordIds = [...new Set(results.map(result => result.wordId))];

  for (const result of results) {
    ({ runState: nextRunState, recheckPending: nextRecheckPending, recheckReentered: nextRecheckReentered } = processRecheckResult(
      result.wordId, result.correct, nextRunState, nextRecheckPending, nextRecheckReentered, masteryThreshold, streakThresholds,
    ));
  }

  printWordSummary(nextRunState, batchWordIds, streakThresholds.maxMastery);

  for (const wordId of batchWordIds) {
    const wordState = nextRunState.get(wordId);
    if (wordState && isMastered(wordState, masteryThreshold)) {
      const prevWordState = prevState.get(wordId);
      if (!prevWordState || !isMastered(prevWordState, masteryThreshold)) {
        console.log(`Mastered: ${wordId.replace(WORD_ID_PREFIX, '')}`);
        masteredCount++;
      }
    }
  }

  return { runState: nextRunState, recheckPending: nextRecheckPending, recheckReentered: nextRecheckReentered, masteredCount };
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
  strategy?: AnswerStrategy,
): Promise<RunState> {
  let active: QuizItem[] = words.filter(w => recheckIds.has(w.id));
  let queue: QuizItem[] = words.filter(w => !recheckIds.has(w.id));
  let runState: RunState = new Map(initialRunState);
  let recheckPending = new Set(recheckIds);
  let recheckReentered = new Set<string>();
  let batchNum = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let masteredCount = 0;

  for (;;) {
    const recheckExempt = new Set([...recheckPending, ...recheckReentered]);
    ({ active, queue } = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, recheckExempt));

    if (active.length === 0 && queue.length === 0) break;

    batchNum++;
    const prevState = runState;

    const { correct, total, results } = await runBatch(batchNum, active, wordPool, foundationalPool, questionLimit, strategy);
    totalCorrect += correct;
    totalQuestions += total;

    const { runState: nextRunState, recheckPending: nextRecheckPending, recheckReentered: nextRecheckReentered, masteredCount: batchMastered } = updateMasteryState(
      results, runState, prevState, recheckPending, recheckReentered, masteryThreshold, streakThresholds,
    );
    runState = nextRunState;
    recheckPending = nextRecheckPending;
    recheckReentered = nextRecheckReentered;
    masteredCount += batchMastered;

    const peekExempt = new Set([...recheckPending, ...recheckReentered]);
    const peek = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, peekExempt);
    if (peek.active.length > 0 || peek.queue.length > 0) {
      // In auto mode, continue automatically; in interactive mode, ask user
      if (strategy) {
        // Auto mode: continue to next batch
        continue;
      } else {
        // Interactive mode: ask user
        process.stdout.write(BATCH_PROMPT);
        const answer = await readLine();
        if (answer !== 'y') break;
      }
    }
  }

  console.log('\n=== Run Complete ===');
  console.log(`Batches: ${String(batchNum)}`);
  console.log(`Score:   ${String(totalCorrect)} / ${String(totalQuestions)}`);
  console.log(`Mastered: ${String(masteredCount)}`);

  return runState;
}
