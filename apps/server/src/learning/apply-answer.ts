import { processRecheckResult, isMastered, type WordState } from '@gll/srs-engine-v2/learn';
import type { ILearningStore, ResolvedThresholds } from '@gll/db';

/** The raw answer fact the transition folds. `latencyMs` is carried for the record; the transition does not read it. */
export interface AnswerEvent {
  wordId: string;
  correct: boolean;
  latencyMs: number;
  recheck: boolean;
}

/** The result of one Learning transition. */
export interface AppliedAnswer {
  before: WordState | null;
  after: WordState;
  graduated: boolean;
}

/** The store surface the transition needs — read prior state, persist the result. */
export type LearningTransitionStore = Pick<
  ILearningStore,
  'getAllWordStates' | 'upsertWordState'
>;

/**
 * The single Learning state transition. Reads prior state, folds the answer through the exact pure
 * recheck branch (a recheck bumps seen/correct only, mastery frozen), persists `after`, and reports
 * whether the word crossed the mastery threshold on this answer. The live `/api/answer` route and
 * artifact-replay both call this, so replay parity holds by construction. Pure of clock/RNG ⇒
 * deterministic replay.
 */
export async function applyAnswer(
  store: LearningTransitionStore,
  userId: string,
  event: AnswerEvent,
  thresholds: ResolvedThresholds,
): Promise<AppliedAnswer> {
  const runState = await store.getAllWordStates(userId);
  const before = runState.get(event.wordId) ?? null;

  const { runState: next } = processRecheckResult(
    event.wordId,
    event.correct,
    runState,
    event.recheck ? new Set([event.wordId]) : new Set(),
    new Set(),
    thresholds.masteryThreshold,
    thresholds.streakThresholds,
  );
  const after = next.get(event.wordId)!;
  await store.upsertWordState(userId, after);

  const wasMastered = before ? isMastered(before, thresholds.masteryThreshold) : false;
  const graduated = !wasMastered && isMastered(after, thresholds.masteryThreshold);
  return { before, after, graduated };
}
