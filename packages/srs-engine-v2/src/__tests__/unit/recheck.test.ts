import { describe, it, expect } from 'vitest';
import { nextActivePool, processRecheckResult } from '../../runner/interactive.js';
import type { RunState } from '../../types/word-state.js';
import type { QuizItem } from '../../engine/compose-batch.js';

function makeItem(id: string): QuizItem {
  return { id, native: id, english: id, romanization: id, type: 'word', language: 'th' } as QuizItem;
}

function makeState(
  entries: Record<string, { mastery: number; seen?: number; correct?: number }>,
): RunState {
  const m: RunState = new Map();
  for (const [wordId, { mastery, seen = 1, correct = 1 }] of Object.entries(entries)) {
    m.set(wordId, { wordId, seen, correct, mastery, correctStreak: 0, wrongStreak: 0 });
  }
  return m;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function masteryThreshold(): number { return 3; }

// ---------------------------------------------------------------------------
// Cycle 1: nextActivePool recheckExempt
// ---------------------------------------------------------------------------

describe('nextActivePool — recheckExempt', () => {
  it('does not retire a mastered word when it is in recheckExempt', () => {
    const active = [makeItem('w1'), makeItem('w2')];
    const queue: QuizItem[] = [];
    const runState = makeState({ w1: { mastery: 3 }, w2: { mastery: 0 } });
    const recheckExempt = new Set(['w1']);

    const result = nextActivePool(active, queue, 2, runState, 3, recheckExempt);

    // w1 is mastered but exempt — must stay in active
    expect(result.active.map(i => i.id)).toContain('w1');
  });

  it('retires a mastered word that is NOT in recheckExempt', () => {
    const active = [makeItem('w1'), makeItem('w2')];
    const queue: QuizItem[] = [];
    const runState = makeState({ w1: { mastery: 3 }, w2: { mastery: 0 } });
    const recheckExempt = new Set<string>(); // w1 not exempt

    const result = nextActivePool(active, queue, 2, runState, 3, recheckExempt);

    expect(result.active.map(i => i.id)).not.toContain('w1');
  });

  it('omitting recheckExempt behaves identically to current behaviour', () => {
    const active = [makeItem('w1')];
    const queue = [makeItem('w2')];
    const runState = makeState({ w1: { mastery: 3 } });

    const result = nextActivePool(active, queue, 2, runState, 3);

    expect(result.active.map(i => i.id)).toEqual(['w2']);
    expect(result.queue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cycles 2–4: processRecheckResult
// ---------------------------------------------------------------------------

describe('processRecheckResult — correct on first attempt', () => {
  it('removes word from recheckPending when answered correctly', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', true, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.recheckPending.has('w1')).toBe(false);
  });

  it('does NOT add word to recheckReentered when answered correctly', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', true, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.recheckReentered.has('w1')).toBe(false);
  });

  it('increments seen/correct but keeps mastery unchanged when answered correctly on first attempt', () => {
    const runState = makeState({ w1: { mastery: 3, seen: 5 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', true, runState, recheckPending, recheckReentered, masteryThreshold());

    // mastery must not change (already mastered)
    expect(result.runState.get('w1')?.mastery).toBe(3);
    // seen and correct must increment — attempt was recorded
    expect(result.runState.get('w1')?.seen).toBe(6);
    expect(result.runState.get('w1')?.correct).toBe(2);
    // streaks must not change
    expect(result.runState.get('w1')?.correctStreak).toBe(0);
  });
});

describe('processRecheckResult — wrong on first attempt', () => {
  it('removes word from recheckPending when answered wrong', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.recheckPending.has('w1')).toBe(false);
  });

  it('adds word to recheckReentered when answered wrong', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.recheckReentered.has('w1')).toBe(true);
  });

  it('increments seen but suppresses streak/mastery change when answered wrong on first attempt', () => {
    const runState = makeState({ w1: { mastery: 3, seen: 5 } });
    const recheckPending = new Set(['w1']);
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold());

    // mastery must not change
    expect(result.runState.get('w1')?.mastery).toBe(3);
    // seen must increment — attempt was recorded
    expect(result.runState.get('w1')?.seen).toBe(6);
    // correct must not increment (wrong answer)
    expect(result.runState.get('w1')?.correct).toBe(1);
    // streaks must not change
    expect(result.runState.get('w1')?.wrongStreak).toBe(0);
  });
});

describe('processRecheckResult — wrong on second attempt (recheckReentered)', () => {
  it('calls updateRunState normally — seen increments', () => {
    const runState = makeState({ w1: { mastery: 3, seen: 5 } });
    const recheckPending = new Set<string>(); // not pending
    const recheckReentered = new Set(['w1']); // second attempt

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.runState.get('w1')?.seen).toBe(6);
  });

  it('removes word from recheckReentered when mastery drops below threshold', () => {
    // wrongStreak: 1 already, threshold 2 — second wrong will decrement mastery
    const runState: RunState = new Map([['w1', { wordId: 'w1', seen: 5, correct: 3, mastery: 3, correctStreak: 0, wrongStreak: 1 }]]);
    const recheckPending = new Set<string>();
    const recheckReentered = new Set(['w1']);

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold(), { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 5 });

    // mastery decremented to 2 (< threshold 3) → removed from recheckReentered
    expect(result.runState.get('w1')?.mastery).toBe(2);
    expect(result.recheckReentered.has('w1')).toBe(false);
  });

  it('keeps word in recheckReentered when mastery stays at or above threshold', () => {
    // wrongStreak: 0, threshold 2 — one wrong not enough to decrement
    const runState: RunState = new Map([['w1', { wordId: 'w1', seen: 5, correct: 3, mastery: 3, correctStreak: 0, wrongStreak: 0 }]]);
    const recheckPending = new Set<string>();
    const recheckReentered = new Set(['w1']);

    const result = processRecheckResult('w1', false, runState, recheckPending, recheckReentered, masteryThreshold(), { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 5 });

    // mastery unchanged (streak not yet at threshold)
    expect(result.runState.get('w1')?.mastery).toBe(3);
    expect(result.recheckReentered.has('w1')).toBe(true);
  });
});

describe('processRecheckResult — non-recheck word', () => {
  it('calls updateRunState normally for non-recheck words', () => {
    const runState = makeState({ w1: { mastery: 0, seen: 2 } });
    const recheckPending = new Set<string>();
    const recheckReentered = new Set<string>();

    const result = processRecheckResult('w1', true, runState, recheckPending, recheckReentered, masteryThreshold());

    expect(result.runState.get('w1')?.seen).toBe(3);
  });
});
