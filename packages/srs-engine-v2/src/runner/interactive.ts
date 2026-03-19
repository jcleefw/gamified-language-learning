import { QuizQuestion } from '../types/quiz.js';
import { RunState, StreakThresholds, updateRunState, isMastered } from '../types/word-state.js';
import { composeBatchMulti, QuizItem } from '../engine/compose-batch.js';
import { MockDeck } from '../types/deck.js';

function readKey(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (key: string) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(key);
    });
  });
}

function readLine(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (line: string) => {
      process.stdin.pause();
      resolve(line.trim().toLowerCase());
    });
  });
}

export async function selectDeck(decks: MockDeck[]): Promise<MockDeck> {
  console.log('\nAvailable decks:');
  for (let i = 0; i < decks.length; i++) {
    console.log(`  ${i + 1}. ${decks[i].topic}`);
  }
  process.stdout.write(`Select a deck (1-${decks.length}): `);

  while (true) {
    const key = (await readKey()).toLowerCase();
    if (key === '\u0003') process.exit();
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
  let score = 0;
  const results: QuizResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\nQuestion ${i + 1} of ${questions.length}`);
    console.log(q.prompt);
    for (const choice of q.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }
    process.stdout.write('Your answer (a/b/c/d): ');

    let answer: string;
    while (true) {
      const key = (await readKey()).toLowerCase();
      if (key === '\u0003') process.exit(); // Ctrl+C
      if (['a', 'b', 'c', 'd'].includes(key)) { answer = key; break; }
    }

    console.log(answer!);

    const selected = q.choices.find(c => c.label === answer)!;
    const correct = q.choices.find(c => c.isCorrect)!;
    const wasCorrect = selected.isCorrect;

    if (wasCorrect) {
      console.log('Correct!');
      score++;
    } else {
      console.log(`Wrong — correct answer was: ${correct.value}`);
    }

    results.push({ wordId: q.wordId, correct: wasCorrect });
  }

  console.log(`\nScore: ${score} / ${questions.length}`);
  return { correct: score, total: questions.length, results };
}

function printWordSummary(runState: RunState, wordIds: string[], maxMastery: number): void {
  console.log('\nWord results:');
  for (const wordId of wordIds) {
    const ws = runState.get(wordId);
    if (ws) {
      console.log(`  ${wordId.replace('th::', '')}   seen: ${ws.seen}  correct: ${ws.correct}  mastery: ${ws.mastery}/${maxMastery}  streaks: +${ws.correctStreak}/-${ws.wrongStreak}`);
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
      const ws = nextState.get(wordId);
      if (ws && !isMastered(ws, masteryThreshold)) {
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
    const ws = runState.get(item.id);
    return !ws || !isMastered(ws, masteryThreshold);
  });

  const freeSlots = questionLimit - remaining.length;
  const newItems = queue.slice(0, freeSlots);
  const newQueue = queue.slice(freeSlots);

  return { active: [...remaining, ...newItems], queue: newQueue };
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

  while (true) {
    const recheckExempt = new Set([...recheckPending, ...recheckReentered]);
    ({ active, queue } = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, recheckExempt));

    if (active.length === 0 && queue.length === 0) break;

    batchNum++;
    console.log(`\n=== Batch ${batchNum} ===`);

    const activeFoundational = active.filter(item => 'class' in item);
    const activeWords = active.filter(item => !('class' in item));
    const consonantLimit = active.length > 0
      ? Math.round(questionLimit * activeFoundational.length / active.length)
      : 0;
    const wordLimit = questionLimit - consonantLimit;

    const foundationalQs = activeFoundational.length > 0
      ? composeBatchMulti(activeFoundational, foundationalPool, { questionLimit: consonantLimit })
      : [];
    const wordQs = activeWords.length > 0
      ? composeBatchMulti(activeWords, wordPool, { questionLimit: wordLimit })
      : [];
    const questions = [...foundationalQs, ...wordQs].sort(() => Math.random() - 0.5);

    const { correct, total, results } = await runInteractive(questions);
    totalCorrect += correct;
    totalQuestions += total;

    const prevState = runState;
    const batchWordIds = [...new Set(results.map(r => r.wordId))];
    for (const r of results) {
      ({ runState, recheckPending, recheckReentered } = processRecheckResult(
        r.wordId, r.correct, runState, recheckPending, recheckReentered, masteryThreshold, streakThresholds,
      ));
    }

    printWordSummary(runState, batchWordIds, streakThresholds.maxMastery);

    for (const wordId of batchWordIds) {
      const ws = runState.get(wordId);
      if (ws && isMastered(ws, masteryThreshold)) {
        const prevWs = prevState.get(wordId);
        if (!prevWs || !isMastered(prevWs, masteryThreshold)) {
          console.log(`Mastered: ${wordId.replace('th::', '')}`);
          masteredCount++;
        }
      }
    }

    const peekExempt = new Set([...recheckPending, ...recheckReentered]);
    const peek = nextActivePool(active, queue, questionLimit, runState, masteryThreshold, peekExempt);
    if (peek.active.length > 0 || peek.queue.length > 0) {
      process.stdout.write('\nNext batch? (y/n): ');
      const answer = await readLine();
      if (answer !== 'y') break;
    }
  }

  console.log('\n=== Run Complete ===');
  console.log(`Batches: ${batchNum}`);
  console.log(`Score:   ${totalCorrect} / ${totalQuestions}`);
  console.log(`Mastered: ${masteredCount}`);

  return runState;
}
