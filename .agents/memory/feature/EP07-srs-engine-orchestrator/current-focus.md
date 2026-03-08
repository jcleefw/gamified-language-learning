# EP07 — Current Focus

**Branch**: feature/EP07-srs-engine-orchestrator
**Epic**: SRS Engine: Answer Processing + SrsEngine Orchestrator Class

## Status
Impl-Complete — PR open, waiting for human review and merge

## Files Owned
- `packages/srs-engine/src/srs-engine.ts` (new)
- `packages/srs-engine/src/__tests__/srs-engine.test.ts` (new — unit: config validation + composeBatch)
- `packages/srs-engine/__tests__/integration/srs-engine-orchestrator.test.ts` (new — 5 lifecycle scenarios)
- `packages/srs-engine/src/CODEMAP.md` (updated)
- `packages/srs-engine/src/index.ts` (updated)

## Design Decisions
- `SrsEngine` constructor validates config and throws descriptive errors on invalid values
- `composeBatch`: filters shelved words, applies active window via `getEligibleWords`, delegates to `batch.ts`
- `processAnswers`: applies mastery → FSRS scheduling (srsM2_review only, pre-update phase) → foundational wrong rule (learning phase only) → batchesSinceLastProgress tracking → stuck word shelving
- `applyFoundationalWrongRule` gated on `state.phase === 'learning'` (pre-update) to avoid double-penalising srsM2_review words
- `consecutiveWrongCount` reset to 0 on foundational correct answer
- SHELVE_DURATION_MS = 24 hours (constant, not configurable)
- `batchesSinceLastProgress` only tracked for learning-phase words in processAnswers
