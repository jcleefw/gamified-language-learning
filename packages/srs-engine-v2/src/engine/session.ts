import type { QuizItem } from './compose-word-batch.js';
import { type RunState, type StreakThresholds, updateRunState, isMastered } from '../types/word-state.js';
import type { WordQuizResult } from '../types/quiz.js';

const DEFAULT_STREAK_THRESHOLDS: StreakThresholds = {
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
  maxMastery: 2,
};

export interface RecheckResultOutput {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
}

/**
 * Applies one quiz answer to recheck state. Suppresses streak/mastery
 * changes on a word's first recheck attempt.
 */
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
    const existing = runState.get(wordId) ?? { wordId, seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 };
    const updated = new Map(runState);
    updated.set(wordId, { ...existing, seen: existing.seen + 1, correct: existing.correct + (wasCorrect ? 1 : 0) });
    nextState = updated;
    if (!wasCorrect) {
      nextReentered.add(wordId);
    }
  } else {
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

/** Retires mastered words from active and fills freed slots from the queue. */
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

  const eligibleQueue = queue.filter(item => {
    const wordState = runState.get(item.id);
    return !wordState || !isMastered(wordState, masteryThreshold);
  });

  const freeSlots = questionLimit - remaining.length;
  const newItems = eligibleQueue.slice(0, freeSlots);
  const newQueue = eligibleQueue.slice(freeSlots);

  return { active: [...remaining, ...newItems], queue: newQueue };
}

export interface MasteryUpdateResult {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  masteredCount: number;
  newlyMasteredIds: string[];
}

/**
 * Applies a full batch of results to run state. Returns IDs of words
 * that crossed the mastery threshold for the first time this batch.
 */
export function updateMasteryState(
  results: WordQuizResult[],
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

  for (const result of results) {
    ({ runState: nextRunState, recheckPending: nextRecheckPending, recheckReentered: nextRecheckReentered } = processRecheckResult(
      result.wordId, result.correct, nextRunState, nextRecheckPending, nextRecheckReentered, masteryThreshold, streakThresholds,
    ));
  }

  const batchWordIds = [...new Set(results.map(r => r.wordId))];
  const newlyMasteredIds: string[] = [];

  for (const wordId of batchWordIds) {
    const wordState = nextRunState.get(wordId);
    if (wordState && isMastered(wordState, masteryThreshold)) {
      const prevWordState = prevState.get(wordId);
      if (!prevWordState || !isMastered(prevWordState, masteryThreshold)) {
        newlyMasteredIds.push(wordId);
      }
    }
  }

  return {
    runState: nextRunState,
    recheckPending: nextRecheckPending,
    recheckReentered: nextRecheckReentered,
    masteredCount: newlyMasteredIds.length,
    newlyMasteredIds,
  };
}
