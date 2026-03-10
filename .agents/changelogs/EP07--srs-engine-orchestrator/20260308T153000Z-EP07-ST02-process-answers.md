# EP07-ST02: processAnswers + Integration Tests

**Created**: 20260308T152200Z
**Epic**: [EP07 - SRS Engine: Answer Processing + SrsEngine Class](../../plans/epics/EP07-srs-engine-orchestrator.md)
**Status**: Complete ✅

## Summary

Implemented `processAnswers` on `SrsEngine` — orchestrates mastery update, FSRS scheduling, foundational wrong rule, stuck-word detection, and shelving. Added 32 tests split across unit and integration per RULES.md package structure conventions.

## Files Modified

### `packages/srs-engine/src/srs-engine.ts`

- `processAnswers(answers, wordStates)` — per answered word:
  1. `updateMastery` — mastery count + phase transition
  2. FSRS `scheduleReview` — only when word was `srsM2_review` **before** the answer (avoids scheduling freshly promoted words)
  3. `applyFoundationalWrongRule` — only when word was `foundational` + `learning` **before** the answer (avoids double-penalising srsM2_review demotions)
  4. Reset `consecutiveWrongCount → 0` on foundational correct
  5. `batchesSinceLastProgress` tracking — learning-phase words only; reset to 0 on mastery progress, increment otherwise
  6. `detectStuckWords` on full updated array → shelve eligible words (24h duration constant)

### `packages/srs-engine/src/__tests__/srs-engine.test.ts` (new)

- **Config validation**: 14 unit tests covering all invalid config fields
- **composeBatch**: 3 unit tests (basic batch, shelved exclusion, newWordsPerBatch limit)

### `packages/srs-engine/__tests__/integration/srs-engine-orchestrator.test.ts` (new)

- **Scenario 1** — Learning → srsM2_review: promotion at threshold, no FSRS on fresh promotion
- **Scenario 2** — 3-lapse srsM2_review → Learning: demotion after lapseThreshold, FSRS applied, lapse accumulation
- **Scenario 3** — Stuck word shelving: shelved after threshold, not shelved on progress, maxShelved cap respected
- **Scenario 4** — Shelved word re-entry: excluded from composeBatch, expired shelve re-enters
- **Scenario 5** — Foundational continuous wrong: reset at threshold, increment before threshold, reset on correct, no rule in srsM2_review
- **Pass-through**: unanswered words returned unchanged

## Behavior

- **New**: `engine.processAnswers(answers, wordStates)` returns `WordState[]` with all SRS rules applied in correct composition order
- **New**: FSRS scheduling is gated on pre-answer phase to prevent scheduling words that just graduated
- **New**: Foundational wrong rule is gated on pre-answer phase to prevent penalising srsM2_review lapses
- **Preserved**: All 172 tests pass (140 existing + 32 new)

## Acceptance Criteria Met

- [x] `new SrsEngine(config)` throws a descriptive error if config is invalid
- [x] `engine.composeBatch(wordStates)` returns a valid `Batch` of `batchSize` questions
- [x] `engine.processAnswers(answers, states)` returns updated states with correct mastery, phase, and scheduling changes
- [x] Integration tests pass: Learning→ANKI transition, 3-lapse reset, stuck word shelving, shelved word re-entry, foundational continuous wrong reset
- [x] `pnpm test` exits green (172/172)
