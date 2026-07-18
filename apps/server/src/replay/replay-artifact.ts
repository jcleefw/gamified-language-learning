import type { WordState } from '@gll/srs-engine-v2/learn';
import { applyAnswer, type LearningTransitionStore } from '../learning/apply-answer.js';
import type { ReplayArtifact, TransitionInput } from './artifact.js';

/** The first step where the recomputed WordState diverges from the recorded one — the pinpointed bug. */
export interface ReplayDivergence {
  step: number; // 0-based index into inputs
  input: TransitionInput;
  expected: WordState; // input.recordedAfter
  actual: WordState; // recomputed
}

export interface ReplayResult {
  ok: boolean;
  steps: number; // steps executed (== inputs.length when ok)
  divergence: ReplayDivergence | null;
}

function wordStateEqual(a: WordState, b: WordState): boolean {
  return (
    a.wordId === b.wordId &&
    a.seen === b.seen &&
    a.correct === b.correct &&
    a.mastery === b.mastery &&
    a.correctStreak === b.correctStreak &&
    a.wrongStreak === b.wrongStreak &&
    a.lapses === b.lapses
  );
}

/**
 * Seed `store` from the artifact baseline, fold every input through the shared `applyAnswer` using
 * the artifact's OWN thresholds, and diff each recomputed WordState against `recordedAfter`. Stops at
 * and reports the first divergence. Deterministic — the transition path reads no clock/RNG (ADR D2).
 */
export async function replayArtifact(
  artifact: ReplayArtifact,
  deps: { store: LearningTransitionStore; userId: string },
): Promise<ReplayResult> {
  const { store, userId } = deps;

  // Lazy per-word baseline seeds the fresh store; brand-new words contribute no entry.
  for (const ws of artifact.baseline) {
    await store.upsertWordState(userId, ws);
  }

  for (let step = 0; step < artifact.inputs.length; step++) {
    const input = artifact.inputs[step];
    const { after } = await applyAnswer(
      store,
      userId,
      {
        wordId: input.wordId,
        correct: input.correct,
        latencyMs: input.latencyMs,
        recheck: input.recheck,
      },
      artifact.thresholds,
    );
    if (!wordStateEqual(after, input.recordedAfter)) {
      return {
        ok: false,
        steps: step + 1,
        divergence: { step, input, expected: input.recordedAfter, actual: after },
      };
    }
  }

  return { ok: true, steps: artifact.inputs.length, divergence: null };
}
