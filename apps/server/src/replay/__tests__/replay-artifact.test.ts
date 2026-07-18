import { describe, it, expect } from 'vitest';
import type { WordState } from '@gll/srs-engine-v2/learn';
import { applyAnswer } from '../../learning/apply-answer.js';
import { makeMemoryLearningStore } from '../memory-store.js';
import { replayArtifact } from '../replay-artifact.js';
import type { ReplayArtifact, TransitionInput } from '../artifact.js';

const THRESHOLDS = {
  masteryThreshold: 2,
  streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
};

/** Record a faithful artifact by running answers through a store, capturing each authoritative afterState. */
async function recordArtifact(
  answers: Array<{ wordId: string; correct: boolean; recheck?: boolean }>,
  baseline: WordState[] = [],
): Promise<ReplayArtifact> {
  const store = makeMemoryLearningStore();
  for (const ws of baseline) await store.upsertWordState('u1', ws);

  const inputs: TransitionInput[] = [];
  let i = 0;
  for (const a of answers) {
    const { after } = await applyAnswer(
      store,
      'u1',
      { wordId: a.wordId, correct: a.correct, latencyMs: 100, recheck: a.recheck ?? false },
      THRESHOLDS,
    );
    inputs.push({
      correlationId: `c${i++}`,
      wordId: a.wordId,
      correct: a.correct,
      latencyMs: 100,
      recheck: a.recheck ?? false,
      recordedAfter: after,
    });
  }

  return {
    version: 1,
    meta: { createdAt: '2026-07-12T00:00:00.000Z', sessionId: 's1', phase: 'learning', originUserId: 'u1' },
    thresholds: THRESHOLDS,
    baseline,
    inputs,
    appearance: [],
  };
}

describe('replayArtifact', () => {
  it('replays a faithful session byte-exact on a fresh :memory: store', async () => {
    const artifact = await recordArtifact([
      { wordId: 'w1', correct: true },
      { wordId: 'w1', correct: false },
      { wordId: 'w1', correct: true },
    ]);

    const result = await replayArtifact(artifact, { store: makeMemoryLearningStore(), userId: 'u1' });
    expect(result.ok).toBe(true);
    expect(result.steps).toBe(artifact.inputs.length);
    expect(result.divergence).toBeNull();
  });

  it('reports the first divergence with its inputs when a recordedAfter is tampered', async () => {
    const artifact = await recordArtifact([
      { wordId: 'w1', correct: true },
      { wordId: 'w1', correct: true },
      { wordId: 'w1', correct: true },
    ]);
    // Tamper step 1's recorded state.
    artifact.inputs[1].recordedAfter = { ...artifact.inputs[1].recordedAfter, mastery: 99 };

    const result = await replayArtifact(artifact, { store: makeMemoryLearningStore(), userId: 'u1' });
    expect(result.ok).toBe(false);
    expect(result.steps).toBe(2);
    expect(result.divergence?.step).toBe(1);
    expect(result.divergence?.input).toBe(artifact.inputs[1]);
    expect(result.divergence?.expected.mastery).toBe(99);
    expect(result.divergence?.actual.mastery).not.toBe(99);
  });

  it('replays a brand-new word (no baseline entry) correctly', async () => {
    const artifact = await recordArtifact([{ wordId: 'fresh', correct: true }]);
    expect(artifact.baseline).toEqual([]); // brand-new ⇒ no baseline

    const result = await replayArtifact(artifact, { store: makeMemoryLearningStore(), userId: 'u1' });
    expect(result.ok).toBe(true);
  });

  it('is deterministic across runs', async () => {
    const artifact = await recordArtifact([
      { wordId: 'w1', correct: true },
      { wordId: 'w2', correct: false },
      { wordId: 'w1', correct: true },
    ]);

    const a = await replayArtifact(artifact, { store: makeMemoryLearningStore(), userId: 'u1' });
    const b = await replayArtifact(artifact, { store: makeMemoryLearningStore(), userId: 'u1' });
    expect(a).toEqual(b);
  });
});
