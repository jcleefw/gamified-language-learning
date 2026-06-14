import type { QuizItem } from './compose-word-batch.js';
import { type RunState, type StreakThresholds } from '../types/word-state.js';
import { type BatchOutput } from './batch-queue.js';

export interface AdaptiveSessionState {
  active: QuizItem[];
  queue: QuizItem[];
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  batchNum: number;
  sessionRetryCounts: Map<string, number>;
}

export interface SessionConfig {
  wordsPerBatch: number;
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
  maxRetryPerSession: number;
}

export function initAdaptiveSession(
  words: QuizItem[],
  config: SessionConfig,
  recheckIds: Set<string> = new Set(),
  initialRunState?: RunState,
): AdaptiveSessionState {
  const recheckItems = words.filter((w) => recheckIds.has(w.id));
  const otherItems = words.filter((w) => !recheckIds.has(w.id));

  const active = [
    ...recheckItems,
    ...otherItems.slice(
      0,
      Math.max(0, config.wordsPerBatch - recheckItems.length),
    ),
  ];

  const activeIds = new Set(active.map((w) => w.id));
  const queue = words.filter((w) => !activeIds.has(w.id));

  return {
    active,
    queue,
    runState: new Map(initialRunState),
    recheckPending: new Set(recheckIds),
    recheckReentered: new Set(),
    batchNum: 0,
    sessionRetryCounts: new Map(),
  };
}

import { updateMasteryState, nextActivePool } from './session.js';
import type { WordQuizResult } from '../types/quiz.js';

export function advanceAdaptiveSession(
  state: AdaptiveSessionState,
  batchOutput: BatchOutput,
  config: SessionConfig,
): AdaptiveSessionState {
  // Filter mixed results to word results only (Phase 2)
  const wordResults = batchOutput.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );

  const { runState, recheckPending, recheckReentered } = updateMasteryState(
    wordResults,
    state.runState,
    state.recheckPending,
    state.recheckReentered,
    config.masteryThreshold,
    config.streakThresholds,
  );

  const { active, queue } = nextActivePool(
    state.active,
    state.queue,
    config.wordsPerBatch,
    runState,
    config.masteryThreshold,
    new Set([...recheckPending, ...recheckReentered]), // both recheck stages exempt from retirement
  );

  // finishBatch pre-accumulates prior session totals into batchOutput.sessionRetryCounts,
  // so .set() is correct here — additive merge would double-count
  const nextSessionRetryCounts = new Map(state.sessionRetryCounts);
  for (const [id, count] of batchOutput.sessionRetryCounts) {
    nextSessionRetryCounts.set(id, count);
  }

  return {
    active,
    queue,
    runState,
    recheckPending,
    recheckReentered,
    batchNum: state.batchNum + 1,
    sessionRetryCounts: nextSessionRetryCounts,
  };
}
