import type { ReviewCard, ReviewRating, GraduationPerformance } from '@gll/srs-review';
import type { FsrsScheduler } from '@gll/srs-review';
import { FIXED_SYSTEM } from '../config/learning.js';

/** Word-state row shape seeded by a scenario (mirrors WordState fields). */
export interface WordStateInput {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number;
}

/** Observable outcome a seeded scenario should produce — asserted by CLI/e2e. */
export interface ExpectedOutcome {
  dueNow: number;
  anytime: number;
  reviewUnlocked: boolean;
}

/**
 * A single backdated review action. Steps compose oldest→newest into a real FSRS
 * history: `offsetMs` must be ≤ 0 and strictly increasing across a spec's steps.
 */
export interface ScenarioStep {
  offsetMs: number;
  kind: 'graduate' | 'review';
  rating?: ReviewRating;
  performance?: GraduationPerformance;
}

/** A named, deterministic scenario. */
export interface ReviewScenarioSpec {
  name: string;
  description: string;
  /** Also upsert a mastered WordState per word (false = review-only / BUG01 repro). */
  seedWordState: boolean;
  steps: ScenarioStep[];
  expected: ExpectedOutcome;
  /**
   * Final `due` override in ms from `now` (e.g. -1 day = already due). When set, the
   * card keeps its engine-computed internal state but `due` is placed deterministically.
   * Omitted = keep the FSRS-natural due from the last step.
   */
  dueOverrideMs?: number;
}

export interface BuildContext {
  wordIds: string[];
  deckId: string;
  now: Date;
  scheduler: FsrsScheduler;
}

export interface BuiltScenario {
  wordStates: WordStateInput[];
  reviewCards: ReviewCard[];
  expected: ExpectedOutcome;
}

/**
 * Guard: every step's offset must be ≤ 0 (no step in the future) and strictly
 * increasing (oldest→newest), or FSRS replay would see negative elapsed time.
 */
function assertChronological(spec: ReviewScenarioSpec): void {
  let prev = -Infinity;
  for (const step of spec.steps) {
    if (step.offsetMs > 0) {
      throw new Error(`scenario "${spec.name}": step offset must be ≤ 0 (got ${step.offsetMs})`);
    }
    if (step.offsetMs <= prev) {
      throw new Error(
        `scenario "${spec.name}": step offsets must be strictly increasing (got ${step.offsetMs} after ${prev})`,
      );
    }
    prev = step.offsetMs;
  }
}

/** Default graduation performance — a 'good' seed (matches the legacy fixture default). */
const DEFAULT_PERFORMANCE: GraduationPerformance = { correctStreak: 2, lapses: 0, correctRatio: 1 };

/** A mastered WordState at the graduation threshold — keeps the unlock gate + card consistent. */
function masteredWordState(wordId: string): WordStateInput {
  const m = FIXED_SYSTEM.masteryThreshold;
  return { wordId, seen: m + 1, correct: m + 1, mastery: m, correctStreak: m, wrongStreak: 0, lapses: 0 };
}

/**
 * Build a scenario's word states + review cards by composing the scheduler over each
 * word's step history. Steps replay oldest→newest at `now + step.offsetMs`, so the
 * resulting card carries a real, engine-computed FSRS state. `expected` is derived from
 * the built cards (not trusted from the spec) so it can never drift.
 */
export function buildScenario(spec: ReviewScenarioSpec, ctx: BuildContext): BuiltScenario {
  assertChronological(spec);
  const { wordIds, now, scheduler } = ctx;
  const wordStates = spec.seedWordState ? wordIds.map(masteredWordState) : [];

  const reviewCards: ReviewCard[] = [];
  for (const wordId of wordIds) {
    let card: ReviewCard | null = null;
    for (const step of spec.steps) {
      const stepNow = new Date(now.getTime() + step.offsetMs);
      if (step.kind === 'graduate') {
        card = scheduler.seed(wordId, step.performance ?? DEFAULT_PERFORMANCE, stepNow);
      } else {
        if (!card) throw new Error(`scenario "${spec.name}": review step before graduate for ${wordId}`);
        card = scheduler.schedule(card, step.rating ?? 'good', stepNow);
      }
    }
    if (!card) continue;
    // Deterministic due placement (keeps the engine-computed internal state).
    if (spec.dueOverrideMs !== undefined) {
      card = { ...card, due: new Date(now.getTime() + spec.dueOverrideMs) };
    }
    reviewCards.push(card);
  }

  const t = now.getTime();
  const expected: ExpectedOutcome = {
    dueNow: reviewCards.filter((c) => c.due.getTime() <= t).length,
    anytime: reviewCards.length,
    reviewUnlocked: reviewCards.length > 0,
  };

  return { wordStates, reviewCards, expected };
}

/** One day in ms — used for deterministic already-due placement. */
const DAY_MS = 1000 * 60 * 60 * 24;

export const REVIEW_SCENARIOS: Record<string, ReviewScenarioSpec> = {
  'mastered-fresh': {
    name: 'mastered-fresh',
    description: 'N mastered words + cards at the natural FSRS graduation due (future)',
    seedWordState: true,
    steps: [{ offsetMs: 0, kind: 'graduate' }],
    expected: { dueNow: 0, anytime: 0, reviewUnlocked: true }, // anytime filled by count at build
  },
  'mastered-due': {
    name: 'mastered-due',
    description: 'N mastered words + cards due now (due list is uncapped)',
    seedWordState: true,
    steps: [{ offsetMs: 0, kind: 'graduate' }],
    expected: { dueNow: 0, anytime: 0, reviewUnlocked: true },
    dueOverrideMs: -DAY_MS, // already due
  },
  'review-only': {
    name: 'review-only',
    description: 'cards due now, but NO mastered word state (EP39-BUG01 repro)',
    seedWordState: false,
    steps: [{ offsetMs: 0, kind: 'graduate' }],
    expected: { dueNow: 0, anytime: 0, reviewUnlocked: true },
    dueOverrideMs: -DAY_MS, // already due
  },
  'relapsed-due': {
    name: 'relapsed-due',
    description: 'graduated → reviewed → lapsed → relearned over ~3 weeks, now due',
    seedWordState: true,
    steps: [
      { offsetMs: -21 * DAY_MS, kind: 'graduate' },
      { offsetMs: -18 * DAY_MS, kind: 'review', rating: 'good' },
      { offsetMs: -8 * DAY_MS, kind: 'review', rating: 'again' }, // lapse
      { offsetMs: -1 * DAY_MS, kind: 'review', rating: 'good' }, // relearn
    ],
    expected: { dueNow: 0, anytime: 0, reviewUnlocked: true },
    dueOverrideMs: -DAY_MS, // engine-computed history, deterministically placed due now
  },
  'mature-interval': {
    name: 'mature-interval',
    description: 'several good reviews → long stability, natural future due (not yet due)',
    seedWordState: true,
    steps: [
      { offsetMs: -40 * DAY_MS, kind: 'graduate' },
      { offsetMs: -30 * DAY_MS, kind: 'review', rating: 'good' },
      { offsetMs: -18 * DAY_MS, kind: 'review', rating: 'good' },
      { offsetMs: -6 * DAY_MS, kind: 'review', rating: 'good' },
    ],
    expected: { dueNow: 0, anytime: 0, reviewUnlocked: true },
    // no dueOverrideMs → keep the FSRS-natural (future) due
  },
};
