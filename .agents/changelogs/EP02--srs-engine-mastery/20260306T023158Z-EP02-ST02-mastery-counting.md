# EP02-ST02 Changelog: Mastery counting + phase transition

**Date**: 20260306T023158Z
**Branch**: feature/EP02-ST02-mastery-counting
**Story**: EP02-ST02 — Mastery counting + phase transition

---

## What changed

### Created
- `packages/srs-engine/src/mastery.ts` — `updateMastery(state, isCorrect, config)` pure function: mastery counting (+1 correct / -1 wrong, floor 0), configurable thresholds (curated 10, foundational 5), Learning → ANKI transition, 3-lapse ANKI → Learning reset
- `packages/srs-engine/__tests__/unit/mastery.test.ts` — 13 unit tests covering all paths (strict TDD)

### Modified
- `packages/srs-engine/src/index.ts` — added `updateMastery` export
- `CODEMAP.md` — added `src/mastery.ts` entry

---

## Acceptance criteria

- [x] Correct answer increments `masteryCount` by 1
- [x] Wrong answer decrements `masteryCount` by 1 (floor 0)
- [x] Mastery reaching curated threshold (10) transitions `learning → srsM2_review`
- [x] Mastery reaching foundational threshold (5) transitions `learning → srsM2_review`
- [x] 3 lapses in `srsM2_review` resets phase to `learning`, `masteryCount = 0`, `lapseCount = 0`
- [x] `updateMastery` is a pure function — does not mutate input state
- [x] All 13 unit tests pass; `pnpm test` exits 0
- [x] `pnpm build` exits 0 with no TypeScript errors
