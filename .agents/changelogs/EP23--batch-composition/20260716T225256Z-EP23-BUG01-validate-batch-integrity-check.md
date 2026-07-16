# EP23-BUG01: validateBatch Integrity Checker

**Created**: 20260716T225256Z
**Epic**: [EP23 - SRS Engine v2 Batch Composition](../../plans/epics/EP23-srs-engine-v2-batch-composition.md)
**Status**: Complete ✅

## Summary

Added a pure `validateBatch` predicate to `srs-engine-v2` that inspects a finished batch for
safety violations. Proposed in
`product-documentation/rfcs/20260716T095048Z-engineering-domain-logic-protocol-vs-consumer-strategy.md`
as a companion to [[EP26-BUG01](../EP26--srs-shelving-policy/20260716T220822Z-EP26-BUG01-shelved-word-sentence-tile-leak.md)]:
that bug already closed the shelved-word-in-sentence-tile leak at the source
(`resolveEligibleContexts`), so `validateBatch` is insurance against the seam reopening — not a
fix for a live bug. Scoped to the two invariants that can be checked without importing consumer
strategy into the engine: excluded-word leakage and duplicate question identity. Speculative
invariants from the RFC (wordsPerBatch bound on sentences, canonical direction set) were left out
as out of scope, pending PO decision.

## Files Modified

### `packages/srs-engine-v2/src/engine/validate-batch.ts` (new)
- `validateBatch(questions, constraints): BatchValidation` — pure, non-throwing predicate over a
  `QuizQuestion[]` batch
- Rule 1: no word in `constraints.excludeIds` appears in the batch, either as a standalone MCQ or
  as a tile inside a sentence (`word-block`) question
- Rule 2: no duplicate question identity (`kind:subject:direction`) within the same batch — same
  word in two different directions is not a duplicate
- Exports `BatchConstraints`, `BatchValidation`, `BatchViolation` types

### `packages/srs-engine-v2/src/__tests__/unit/validate-batch.test.ts` (new)
- 11 tests covering: clean batches, excluded-word leak via MCQ, excluded-word leak via sentence
  tile, multiple excluded tiles in one sentence, no/empty `excludeIds` (rule skipped), duplicate
  MCQ, same word different directions (not a duplicate), duplicate sentence, combined violations,
  empty batch

### `packages/srs-engine-v2/src/index.ts`
- Barrel-exports `validateBatch` and its types alongside `assembleBatch`

## Behavior Preserved / New Behavior

- Purely additive — no existing composition or scheduling behavior changed
- `validateBatch` never repairs, reorders, or throws; callers decide what to do with violations
  (assert in dev/tests, log in production)
- All 228 `srs-engine-v2` tests pass (11 new); typecheck clean

## Next Steps

- Not yet wired into either consumer (`cli-demo-db`, `srs-demo`) as a dev-time assertion —
  available as a library function pending a PO decision on where/whether to enforce it
- Size-bound and permitted-direction invariants remain open per the RFC, deferred pending
  further design work
