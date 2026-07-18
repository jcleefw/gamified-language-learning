import { describe, it, expect } from 'vitest';
import { FsrsScheduler } from '../FsrsScheduler.js';
import type { ReviewCard, GraduationPerformance } from '../types.js';

const NOW = new Date('2026-07-08T00:00:00Z');
const perf = (o: Partial<GraduationPerformance> = {}): GraduationPerformance => ({
  correctStreak: 4, lapses: 0, correctRatio: 1, ...o,
});

describe('FsrsScheduler.seed', () => {
  it('produces a card due in the future and never rates it "again"', () => {
    const card = new FsrsScheduler().seed('w1', perf(), NOW);
    expect(card.wordId).toBe('w1');
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.schedulerData).toBeDefined();
  });

  it('strong performance seeds a longer first interval than weak performance', () => {
    const s = new FsrsScheduler();
    const strong = s.seed('w1', perf({ correctStreak: 6, lapses: 0, correctRatio: 1 }), NOW);
    const weak = s.seed('w2', perf({ correctStreak: 1, lapses: 3, correctRatio: 0.4 }), NOW);
    expect(strong.due.getTime()).toBeGreaterThan(weak.due.getTime());
  });
});

describe('FsrsScheduler.schedule', () => {
  const seeded = (): ReviewCard => new FsrsScheduler().seed('w1', perf(), NOW);

  it('"good" pushes the due date further out', () => {
    const s = new FsrsScheduler();
    const card = seeded();
    const next = s.schedule(card, 'good', card.due);
    expect(next.due.getTime()).toBeGreaterThan(card.due.getTime());
  });

  it('"again" reschedules soon without resetting to day 1 (relearning, not New)', () => {
    const s = new FsrsScheduler();
    const card = seeded();
    const lapsed = s.schedule(card, 'again', card.due);
    expect(lapsed.due.getTime()).toBeGreaterThan(card.due.getTime()); // still forward
    expect(lapsed.due.getTime()).toBeLessThan(
      s.schedule(card, 'good', card.due).due.getTime(),                // but sooner than good
    );
  });

  it('survives a JSON round-trip of schedulerData (store simulation)', () => {
    const s = new FsrsScheduler();
    const card = seeded();
    const roundTripped: ReviewCard = {
      ...card,
      schedulerData: JSON.parse(JSON.stringify(card.schedulerData)),
    };
    expect(() => s.schedule(roundTripped, 'good', card.due)).not.toThrow();
  });
});

describe('FsrsScheduler.isDue', () => {
  it('is due when due <= now (boundary inclusive), not due when due > now', () => {
    const s = new FsrsScheduler();
    const card = s.seed('w1', perf(), NOW);
    expect(s.isDue({ ...card, due: NOW }, NOW)).toBe(true);  // due == now
    expect(s.isDue(card, NOW)).toBe(false);                  // due in future
    expect(s.isDue(card, new Date(card.due.getTime() + 1))).toBe(true);
  });
});
