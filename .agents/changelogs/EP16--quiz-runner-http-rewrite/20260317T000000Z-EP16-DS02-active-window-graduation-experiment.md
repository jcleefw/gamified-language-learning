# EP16-DS02: Active-Window Graduation — Mastered Phase

**Date**: 20260317T000000Z
**Status**: Draft
**Epic**: [EP16 - Quiz Runner: HTTP-Based Interactive Quiz](.agents/plans/epics/EP16-quiz-runner-http-rewrite.md)

---

## 1. Feature Overview

The `activeWordLimit` window never drains because `srsM2_review` is a terminal state — words that graduate from `learning` occupy a slot forever, blocking new words from entering. This change adds a `mastered` phase to fix that.

Scoped to EP16: no new API contract changes, no persistent storage, no UI changes. Uses the existing `scripts/quiz-runner.ts` and default server.

**Observed problem**: once `activeWordLimit` (8) words reach `srsM2_review`, `newSlots = max(0, 8 − 8) = 0` for every subsequent batch — no new words ever enter the session.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| `mastered` phase scope | Engine-internal only (`@gll/srs-engine` types); NOT added to `@gll/api-contract` wire types | Avoids a breaking API contract change; server maps `mastered → 'anki_review'` on the wire |
| Graduation threshold | `graduationThreshold: 3` correct answers in `srsM2_review`, set in `DEFAULT_SRS_CONFIG` | Low enough to observe graduation in a short session (≈3 batches per word at batchSize 15) |
| No new scripts or ports | Graduation is active by default in the engine config; `pnpm dev` + `pnpm quiz` unchanged | No separate server instances or runner scripts needed |
| Tests | Unit tests for graduation transition, mastered exclusion from active window, lapse demotion | Engine is the only new logic |

---

## 3. Data Structures

```typescript
// ── packages/srs-engine/src/types.ts ────────────────────────────────────────

// BEFORE
export type MasteryPhase = 'learning' | 'srsM2_review';

// AFTER (engine-internal only — NOT exported from @gll/api-contract)
export type MasteryPhase = 'learning' | 'srsM2_review' | 'mastered';

// SrsConfig addition (optional — backward compatible)
export interface SrsConfig {
  // ... existing fields unchanged ...

  // Words graduate out of the active window after this many correct answers in
  // srsM2_review. Absent = no graduation (original behaviour).
  graduationThreshold?: number;
}

// ── apps/server/src/state/engine.ts — DEFAULT_SRS_CONFIG (excerpt) ──────────
export const DEFAULT_SRS_CONFIG: SrsConfig = {
  // ... existing fields ...
  graduationThreshold: 3,   // 3 correct answers in srsM2_review → mastered
};
```

---

## 4. User Workflows

### Running the quiz

```
Terminal A             Terminal B
─────────────────      ─────────────────
$ pnpm dev             $ pnpm quiz
  → server :3000         → quiz against localhost:3000
```

### Word lifecycle

```
learning (masteryCount 0–9)
  → correct ×10 → srsM2_review       [enters active window]
  → correct ×3  → mastered           [exits active window, frees slot]
  → mastered, FSRS due today → appears in batch (lowest priority)
  → mastered + lapseCount ≥ lapseThreshold → demoted to srsM2_review
```

---

## 5. Stories

### EP16-ST02: Engine — mastered-phase graduation

**Scope**: Add `'mastered'` phase and `graduationThreshold` config to the engine. When a word in `srsM2_review` reaches `graduationThreshold` correct answers, it transitions to `'mastered'`. Mastered words are excluded from `activeWordLimit` counting and from the `eligible` new-word pool. They appear in batches only when their FSRS interval says they are due. Lapses in `mastered` demote the word back to `srsM2_review`.

**Read List**:
- `packages/srs-engine/src/types.ts`
- `packages/srs-engine/src/mastery.ts`
- `packages/srs-engine/src/active-window.ts`
- `packages/srs-engine/src/batch.ts`
- `packages/srs-engine/src/srs-engine.ts`
- `packages/srs-engine/src/__tests__/active-window.test.ts`
- `packages/srs-engine/src/__tests__/mastery.test.ts`

**Tasks**:

- [ ] `types.ts` — add `'mastered'` to `MasteryPhase`; add optional `graduationThreshold?: number` to `SrsConfig`
- [ ] `mastery.ts` — in the `srsM2_review` correct branch: if `config.graduationThreshold` is set and `newMasteryCount >= config.graduationThreshold`, transition to `phase: 'mastered'`; if `graduationThreshold` not set, existing behaviour unchanged
- [ ] `mastery.ts` — in the `mastered` incorrect branch: increment `lapseCount`; if `lapseCount >= lapseThreshold`, demote to `srsM2_review` with `lapseCount: 0, masteryCount: 0`
- [ ] `active-window.ts` — change `eligible` filter from `phase !== 'srsM2_review'` to `phase === 'learning'` so `mastered` words are excluded from new-word slots
- [ ] `batch.ts` — add lowest-priority bucket: `mastered` words where `fsrsState.lastReview + scheduledDays * 86_400_000 <= Date.now()` (due for review). Append after `foundationalLearning` in priority order
- [ ] `srs-engine.ts` — extend FSRS scheduling to also apply to `phase === 'mastered'` words
- [ ] `srs-engine.ts` — pass `mastered` words through to `composeBatch` alongside `active` and `eligible`
- [ ] `apps/server/src/routes/srs.ts` — add `mastered: 'anki_review'` to `ENGINE_TO_WIRE_PHASE` map
- [ ] `apps/server/src/state/engine.ts` — add `graduationThreshold: 3` to `DEFAULT_SRS_CONFIG`
- [ ] Add unit tests: graduation transition at threshold; no graduation when `graduationThreshold` absent; `mastered` excluded from `active` count; `mastered` lapse demotion; `mastered` due word appears in batch; `mastered` not-due word excluded from batch

**Acceptance Criteria**:
- [ ] With `graduationThreshold: 3`, a word that answers correctly 3× in `srsM2_review` transitions to `mastered`
- [ ] `mastered` word does not count against `activeWordLimit` — new words can enter
- [ ] `mastered` word appears in the next batch only when `lastReview + scheduledDays ≤ now`
- [ ] `mastered` word with `lapseCount >= lapseThreshold` is demoted back to `srsM2_review`
- [ ] Without `graduationThreshold` in config, all existing engine tests still pass
- [ ] `pnpm typecheck` green across the monorepo

---

## 6. Success Criteria

1. After running several batches with `pnpm quiz`, a word that answered correctly 3× in `srsM2_review` no longer appears every batch — and a new `learning` word takes its slot
2. `pnpm typecheck` green across the monorepo
3. Existing `packages/srs-engine` tests all pass
