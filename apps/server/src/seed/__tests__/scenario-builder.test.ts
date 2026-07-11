import { describe, it, expect } from 'vitest';
import { FsrsScheduler } from '@gll/srs-review';
import { buildScenario, REVIEW_SCENARIOS, type ReviewScenarioSpec } from '../scenario-builder.js';

const DAY = 1000 * 60 * 60 * 24;

describe('buildScenario', () => {
  const scheduler = new FsrsScheduler();
  const now = new Date('2026-07-10T00:00:00Z');
  const wordIds = ['w-a', 'w-b', 'w-c'];

  it('mastered-fresh: N mastered word states + N cards with natural future due', () => {
    const out = buildScenario(REVIEW_SCENARIOS['mastered-fresh'], {
      wordIds,
      deckId: 'deck-eat',
      now,
      scheduler,
    });

    expect(out.wordStates).toHaveLength(3);
    expect(out.reviewCards).toHaveLength(3);
    // Freshly graduated → the first review is scheduled in the future.
    for (const c of out.reviewCards) {
      expect(c.due.getTime()).toBeGreaterThan(now.getTime());
    }
    expect(out.expected).toEqual({ dueNow: 0, anytime: 3, reviewUnlocked: true });
  });

  it('mastered-due: N mastered word states + N cards all due now', () => {
    const out = buildScenario(REVIEW_SCENARIOS['mastered-due'], {
      wordIds,
      deckId: 'deck-eat',
      now,
      scheduler,
    });

    expect(out.wordStates).toHaveLength(3);
    expect(out.reviewCards).toHaveLength(3);
    for (const c of out.reviewCards) {
      expect(c.due.getTime()).toBeLessThanOrEqual(now.getTime());
    }
    expect(out.expected).toEqual({ dueNow: 3, anytime: 3, reviewUnlocked: true });
  });

  it('review-only: cards due now but NO word state (BUG01 — unlock from card existence)', () => {
    const out = buildScenario(REVIEW_SCENARIOS['review-only'], {
      wordIds: ['w-a', 'w-b'],
      deckId: 'deck-eat',
      now,
      scheduler,
    });

    expect(out.wordStates).toHaveLength(0);
    expect(out.reviewCards).toHaveLength(2);
    expect(out.expected).toEqual({ dueNow: 2, anytime: 2, reviewUnlocked: true });
  });

  it('relapsed-due: engine-computed multi-day history with a lapse, placed due now', () => {
    const out = buildScenario(REVIEW_SCENARIOS['relapsed-due'], {
      wordIds: ['w-a'],
      deckId: 'deck-eat',
      now,
      scheduler,
    });

    expect(out.reviewCards).toHaveLength(1);
    const card = out.reviewCards[0];

    // Placed due now (deterministic override), while internal state stays engine-computed.
    expect(card.due.getTime()).toBeLessThanOrEqual(now.getTime());

    const data = card.schedulerData as {
      state: number;
      lapses: number;
      stability: number;
    };
    const FSRS_STATE_REVIEW = 2; // ts-fsrs State.Review
    expect(data.lapses).toBeGreaterThanOrEqual(1); // the 'again' step recorded a real lapse
    expect(data.stability).toBeGreaterThan(0); // engine-produced, not hand-authored
    expect(data.state).toBe(FSRS_STATE_REVIEW); // relearn → good landed back in Review

    expect(out.expected.dueNow).toBe(1);
  });

  it('mature-interval: several good reviews → natural future due (not due now)', () => {
    const out = buildScenario(REVIEW_SCENARIOS['mature-interval'], {
      wordIds: ['w-a'],
      deckId: 'deck-eat',
      now,
      scheduler,
    });

    expect(out.reviewCards).toHaveLength(1);
    const card = out.reviewCards[0];
    expect(card.due.getTime()).toBeGreaterThan(now.getTime()); // natural due is in the future
    expect(out.expected).toEqual({ dueNow: 0, anytime: 1, reviewUnlocked: true });
  });

  it('rejects steps whose offsets are not strictly increasing (time going backwards)', () => {
    const badSpec: ReviewScenarioSpec = {
      name: 'bad-order',
      description: 'second step is older than the first',
      seedWordState: false,
      steps: [
        { offsetMs: -5 * DAY, kind: 'graduate' },
        { offsetMs: -8 * DAY, kind: 'review', rating: 'good' }, // goes backwards → negative elapsed
      ],
      expected: { dueNow: 0, anytime: 0, reviewUnlocked: false },
    };

    expect(() =>
      buildScenario(badSpec, { wordIds: ['w-a'], deckId: 'deck-eat', now, scheduler }),
    ).toThrow(/increasing/i);
  });

  it('rejects a positive offset (a step in the future)', () => {
    const badSpec: ReviewScenarioSpec = {
      name: 'future-step',
      description: 'graduate step in the future',
      seedWordState: false,
      steps: [{ offsetMs: 1 * DAY, kind: 'graduate' }],
      expected: { dueNow: 0, anytime: 0, reviewUnlocked: false },
    };

    expect(() =>
      buildScenario(badSpec, { wordIds: ['w-a'], deckId: 'deck-eat', now, scheduler }),
    ).toThrow(/offset/i);
  });
});
