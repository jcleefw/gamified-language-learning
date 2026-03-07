# Current Focus

**Branch**: feature/EP06--srs-engine-foundational-deck
**Updated**: 20260308T033200Z

## Active Work

- **Epic**: EP06 — SRS Engine: Foundational Deck
- **Story**: EP06-ST01 ✅ Complete — active limit + continuous wrong rule
- **Next**: EP06-ST02 — Foundational batch allocation (`getFoundationalAllocation`)

## What Was Completed (ST01)

- `consecutiveWrongCount?: number` added to `WordState`
- `foundational.ts` created with `getActiveFoundationalWords` (3-active cap) + `applyFoundationalWrongRule` (mastery reset on 3rd consecutive wrong)
- 11 unit tests, all passing
- Exported from `index.ts`, CODEMAP updated

## What's Next (ST02)

- Implement `getFoundationalAllocation(totalBatchSize, foundationalWords, config)` in `foundational.ts`
- Returns slot count (20% active, 5% depleted) + depletion status
- Depletion = all foundational words at/above `config.masteryThreshold.foundational`
- Empty array = depleted
- Unit tests for both allocation modes + edge cases
