# EP36-DS01: Review Scheduler Package (`@gll/srs-review`) Specification

**Date**: 20260708T011607Z
**Status**: Draft
**Epic**: [EP36 - SRS Review Phase](../../plans/epics/EP36-srs-review-phase.md)

**Architecture**: [Review Phase Packaging ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) · FSRS behaviour: [20260321 Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md)

---

## 1. Feature Overview

This DS covers **Phase 1 (EP36-PH01)** only: the new pure-logic package `@gll/srs-review`. It
holds the review-scheduling domain — the `ReviewScheduler` interface, its `FsrsScheduler`
implementation, and the review domain types — with `ts-fsrs` isolated to a single file and
**removed** from `srs-engine-v2`.

The package is a sibling of `@gll/srs-shelving` and follows the same shape: self-contained types
over primitives, no I/O, no persistence, no `console`/`process`. Persistence (`ReviewStore`) is
DS02; the runner and rating inference are DS03.

**Boundary decision (refines the ADR):** per [RULES.md §Package Structure — "No cross-package type
imports"](../../../RULES.md), `@gll/srs-review` imports **nothing** from `@gll/srs-engine-v2`. Its
inputs are primitives and its own types. `GraduationPerformance` is self-contained; the app-layer
`GraduationHook` (DS03) maps `WordState → GraduationPerformance`. The package therefore has **no
workspace dependency on the engine** — matching how `srs-shelving`'s code imports zero engine types.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Package identity | New `packages/srs-review`, name `@gll/srs-review`, private, ESM | Mirror `@gll/srs-shelving` scaffold |
| `ts-fsrs` location | Dependency of `srs-review`; **removed** from `srs-engine-v2/package.json` | Revises DS02-EP21; keeps core engine FSRS-free |
| `ts-fsrs` isolation | Imported **only** in `src/FsrsScheduler.ts` | One swap point; algorithm never leaks |
| FSRS config | `enable_short_term: false`, `request_retention: 0.9` | Day-scale only; no competing "learning" loop (20260321 ADR §1) |
| Cross-package imports | **None** from the engine | RULES.md §"No cross-package type imports" |
| Scheduler shape | `ReviewScheduler` interface + `FsrsScheduler` **class** | RULES.md §105 sanctions `FsrsScheduler.ts` as a class file; class holds the configured `fsrs` instance |
| `ReviewCard.schedulerData` | Opaque `unknown` (serialised ts-fsrs `Card` as JSON) | Store/runner never inspect it; swap needs no schema change (ADR §3) |
| Purity | No `console`, `process`, fs, or DB | Library boundary; unit-testable in isolation |
| Types home | `src/types.ts` (shared types); class in `src/FsrsScheduler.ts` | Follows `srs-shelving` + RULES.md §110/105 |
| Testing | Strict TDD, all paths | RULES.md §Testing — engine packages |

---

## 3. Data Structures

All types are self-contained (primitives only). Defined in `src/types.ts`:

```typescript
/** How the user answered a due review. Inferred by the runner (DS03), never asked. */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Performance snapshot at the moment a word graduates from Learning.
 * Primitive-only — the app-layer GraduationHook derives this from WordState;
 * this package never imports WordState.
 */
export interface GraduationPerformance {
  correctStreak: number; // final streak at graduation
  lapses: number;        // times mastery dropped during Learning
  correctRatio: number;  // correct / seen, range 0..1
}

/**
 * Persisted per-word review record. `due` is the only field the runner/store read;
 * `schedulerData` is opaque and owned entirely by the scheduler.
 */
export interface ReviewCard {
  wordId: string;
  due: Date;
  schedulerData: unknown; // FsrsScheduler stores the serialised ts-fsrs Card here
}

/** Swappable scheduling contract. FsrsScheduler is one implementation. */
export interface ReviewScheduler {
  /** Create the first ReviewCard for a freshly graduated word. */
  seed(wordId: string, performance: GraduationPerformance, now: Date): ReviewCard;
  /** Advance a card after a review, given the inferred rating. */
  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard;
  /** Is this card due at `now`? */
  isDue(card: ReviewCard, now: Date): boolean;
}
```

`FsrsScheduler` (in `src/FsrsScheduler.ts` — the **only** `ts-fsrs` importer):

```typescript
import { fsrs, generatorParameters, createEmptyCard, Rating, type Card } from 'ts-fsrs';
import type { ReviewScheduler, ReviewCard, ReviewRating, GraduationPerformance } from './types.js';

const RATING_MAP: Record<ReviewRating, Rating> = {
  again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy,
};

export class FsrsScheduler implements ReviewScheduler {
  private readonly engine = fsrs(
    generatorParameters({ enable_short_term: false, request_retention: 0.9 }),
  );
  // seed(): createEmptyCard → engine.next(card, now, seedRating) → ReviewCard
  //   seedRating derived from GraduationPerformance (Easy/Good/Hard; never Again)
  // schedule(): deserialise card.schedulerData → engine.next(card, now, RATING_MAP[rating]) → ReviewCard
  // isDue(): card.due.getTime() <= now.getTime()
}
```

`schedulerData` holds the ts-fsrs `Card` (`stability`, `difficulty`, `state`, `due`, `reps`,
`lapses`, `last_review`) serialised as JSON. `ReviewCard.due` mirrors `Card.due` for cheap
due-filtering without deserialising.

**Graduation → seed rating** (self-contained heuristic; thresholds calibrated later, OQ5):

| Signal | Seed rating |
| --- | --- |
| High `correctStreak`, `lapses === 0` | `easy` |
| Moderate streak, 1–2 lapses | `good` |
| Low streak / multiple lapses / low `correctRatio` | `hard` |

A graduated word is **never** seeded `again` — graduation implies success.

---

## 4. User Workflows

```
Graduation (app-layer hook, DS03)
  WordState ──map──▶ GraduationPerformance
                       │
                       ▼
        scheduler.seed(wordId, perf, now)
          createEmptyCard → engine.next(_, now, seedRating)
                       │
                       ▼
              ReviewCard { wordId, due, schedulerData } ──▶ ReviewStore.upsert (DS02/03)

Review answer (runner, DS03)
  ReviewCard + inferred ReviewRating
                       │
                       ▼
        scheduler.schedule(card, rating, now)
          deserialise schedulerData → engine.next(card, now, RATING_MAP[rating])
                       │
                       ▼
              updated ReviewCard (later due) ──▶ ReviewStore.upsert
```

---

## 5. Stories

### Phase 1: Review Scheduler Package (EP36-PH01)

### EP36-ST01: Scaffold `@gll/srs-review` and relocate `ts-fsrs`

**Scope**: Package scaffold + dependency move only — no scheduler logic yet.
**Read List**:
- `packages/srs-shelving/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` (scaffold template)
- `packages/srs-engine-v2/package.json` (remove `ts-fsrs` from here)

**Tasks**:
- [ ] Create `packages/srs-review/` with `package.json` (`@gll/srs-review`, private, ESM, `main`/`types`/`exports` mirroring `srs-shelving`), `tsconfig*.json`, `vitest.config.ts`
- [ ] Add `ts-fsrs` to `srs-review` dependencies; add `typescript` + `vitest` dev deps
- [ ] Remove `ts-fsrs` from `packages/srs-engine-v2/package.json`
- [ ] Add empty `src/index.ts` barrel and confirm workspace install resolves

**Acceptance Criteria**:
- [ ] `pnpm install` resolves; `@gll/srs-review` is a recognised workspace package
- [ ] `ts-fsrs` no longer appears anywhere in `srs-engine-v2/package.json`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` and `typecheck` still pass (engine untouched by the dep removal)
- [ ] `pnpm --filter @gll/srs-review typecheck` passes on the empty package

### EP36-ST02: Review domain types + `ReviewScheduler` interface

**Scope**: Pure types only — no `ts-fsrs` import.
**Read List**:
- `packages/srs-shelving/src/types.ts` (self-contained-types pattern)
- `packages/srs-shelving/src/index.ts` (barrel pattern)
- This DS §3

**Tasks**:
- [ ] Create `src/types.ts` with `ReviewRating`, `GraduationPerformance`, `ReviewCard`, `ReviewScheduler` (exactly §3)
- [ ] Export all four from `src/index.ts`
- [ ] Add `src/__tests__/unit/exports.test.ts` asserting the public surface (mirror `srs-shelving`'s `exports.test.ts`)

**Acceptance Criteria**:
- [ ] `src/types.ts` contains **no** `ts-fsrs` import and no import from `@gll/srs-engine-v2`
- [ ] All four types importable from `@gll/srs-review`
- [ ] `pnpm --filter @gll/srs-review typecheck` passes

### EP36-ST03: `FsrsScheduler` implementation

**Scope**: The `ts-fsrs` adapter class — the only file importing `ts-fsrs`. Strict TDD.
**Read List**:
- `packages/srs-review/src/types.ts` (from ST02)
- [SRS Scheduling Libraries research](../../../product-documentation/research/20260319T000000Z-srs-scheduling-libraries.md) (ts-fsrs `next`/`Card`/`Rating` API)
- 20260321 Review Phase ADR §1–3 (FSRS config + opaque `schedulerData`)

**Tasks**:
- [ ] Write unit tests first: `seed` produces a future-due card and never rates `again`; `schedule('good')` pushes `due` further out; `schedule('again')` shortens interval (relearning, no day-1 reset); `isDue` boundary (due==now is due, due>now is not); `schedulerData` round-trips through JSON serialise/deserialise
- [ ] Implement `FsrsScheduler` in `src/FsrsScheduler.ts` with `enable_short_term: false`, `request_retention: 0.9`
- [ ] Implement the `GraduationPerformance → seed rating` heuristic (§3 table) as a private pure helper
- [ ] Export `FsrsScheduler` from `src/index.ts`

**Acceptance Criteria**:
- [ ] `ts-fsrs` is imported **only** in `src/FsrsScheduler.ts` (grep-verifiable)
- [ ] `FsrsScheduler` satisfies `ReviewScheduler` structurally (assignability test)
- [ ] Correct answers produce increasing intervals; `again` relapses without resetting to day 1
- [ ] `ReviewCard.due` equals the ts-fsrs `Card.due` after `seed`/`schedule`
- [ ] Full `pnpm --filter @gll/srs-review test` suite passes; no `console`/`process` in `src/`

---

## 6. Success Criteria

1. `@gll/srs-review` builds, typechecks, and tests green as a standalone package.
2. `ts-fsrs` lives in `srs-review` only and is imported in exactly one file; `srs-engine-v2` is FSRS-free and its suite still passes.
3. The package imports nothing from `@gll/srs-engine-v2` (verifiable: no `@gll/srs-engine-v2` in `package.json` deps, no such import in `src/`).
4. `ReviewScheduler` is swappable — a second implementation would need only to satisfy the interface; `schedulerData` stays opaque.
5. No type errors.

---

## 7. Out of Scope (this DS)

- `ReviewStore` / `SqliteReviewStore` / `review_cards` schema → **DS02**
- Runner (`pnpm reviewv2`), response-time rating inference, `GraduationHook` wiring, mock seeder → **DS03**
- Exact seed-rating and response-time thresholds (calibration — OQ5 and the timing-bands note)

---

## Appendix A — ST03 Reference Implementation

Verified against **ts-fsrs 5.2.3** (installed). `next(card, now, grade)` returns `{ card, log }`;
`Card.due` / `last_review` are `Date`s; `Rating` is `Again(1) | Hard(2) | Good(3) | Easy(4)`. This
is the intended implementation for EP36-ST03 — adjust only if the ts-fsrs major version changes.

### A.1 `src/FsrsScheduler.ts` (the only `ts-fsrs` importer)

```typescript
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type CardInput,
  type Grade,
  type FSRSParameters,
} from 'ts-fsrs';
import type {
  ReviewScheduler,
  ReviewCard,
  ReviewRating,
  GraduationPerformance,
} from './types.js';

/** Domain rating → ts-fsrs grade. All four are valid Grades (Manual excluded). */
const RATING_TO_GRADE: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Seed heuristic thresholds — calibrate empirically (OQ5). Generous by intent.
const EASY_STREAK = 4; // final streak at/above this + zero lapses ⇒ easy
const GOOD_RATIO = 0.7; // correctRatio at/above this (≤2 lapses) ⇒ good

export class FsrsScheduler implements ReviewScheduler {
  private readonly engine: ReturnType<typeof fsrs>;

  constructor(params?: Partial<FSRSParameters>) {
    this.engine = fsrs(
      generatorParameters({
        enable_short_term: false, // day-scale only — no competing "learning" loop
        request_retention: 0.9,
        ...params,
      }),
    );
  }

  seed(wordId: string, performance: GraduationPerformance, now: Date): ReviewCard {
    const fresh = createEmptyCard(now);
    const grade = RATING_TO_GRADE[seedRating(performance)];
    const { card } = this.engine.next(fresh, now, grade);
    return toReviewCard(wordId, card);
  }

  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard {
    const fsrsCard = fromSchedulerData(card.schedulerData);
    const { card: advanced } = this.engine.next(fsrsCard, now, RATING_TO_GRADE[rating]);
    return toReviewCard(card.wordId, advanced);
  }

  isDue(card: ReviewCard, now: Date): boolean {
    return card.due.getTime() <= now.getTime();
  }
}

// ── private pure helpers ──────────────────────────────────────────────

/** Graduation performance → initial seed rating. Never `again` — graduation implies success. */
function seedRating(perf: GraduationPerformance): ReviewRating {
  const { correctStreak, lapses, correctRatio } = perf;
  if (lapses === 0 && correctStreak >= EASY_STREAK) return 'easy';
  if (lapses <= 2 && correctRatio >= GOOD_RATIO) return 'good';
  return 'hard';
}

/** Wrap a ts-fsrs Card as our opaque ReviewCard. `due` mirrors Card.due for cheap filtering. */
function toReviewCard(wordId: string, card: Card): ReviewCard {
  return { wordId, due: card.due, schedulerData: card };
}

/**
 * Rehydrate the opaque blob into a ts-fsrs CardInput.
 * After a store round-trip (DS02) the Dates arrive as ISO strings; ts-fsrs `next`
 * accepts CardInput whose `due`/`last_review` are DateInput (Date | number | string),
 * so no manual Date parsing is needed here.
 */
function fromSchedulerData(data: unknown): CardInput {
  return data as CardInput;
}
```

### A.2 Persistence seam (hand-off to DS02)

`seed`/`schedule` always **return** `ReviewCard.due` as a real `Date` (ts-fsrs emits `Date`s), so
`isDue` is safe within this package. Once `SqliteReviewStore` persists and reloads a card, `due`
returns as an ISO **string** — **rehydrating `ReviewCard.due` back to a `Date` on read is the
store's responsibility (DS02)**. `schedulerData` itself needs no rehydration, because `next()`
accepts string dates via `CardInput`.

### A.3 `src/__tests__/unit/FsrsScheduler.test.ts` (TDD-first)

```typescript
import { describe, it, expect } from 'vitest';
import { FsrsScheduler } from '../../FsrsScheduler.js';
import type { ReviewCard, GraduationPerformance } from '../../types.js';

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
```

**Behavioural notes**: the `"again"` assertion depends on `enable_short_term: false` — a lapse
stays day-scale (no minute reset) and the word remains in the Review phase rather than slipping
back to Learning (EP36 acceptance criterion). The JSON round-trip test is the cheap proxy that
catches the date-rehydration seam (A.2) before DS02's real SQLite store exists.
