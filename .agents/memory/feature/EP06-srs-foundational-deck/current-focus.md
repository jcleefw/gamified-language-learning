# Current Focus

**Branch**: feature/EP06-srs-foundational-deck
**Worktree**: `.worktrees/ep06`
**Updated**: 20260306T000000Z

## Active Work

- **Epic**: EP06 — SRS Engine: Foundational Deck
- **Status**: Not started — this is the starting point for this conversation
- **Parallel epics**: EP04 (batch composition) and EP05 (active window) are running simultaneously in other worktrees — do not touch their files

## Starting Point — What to Do First

1. Read the epic plan: `.agents/plans/epics/EP06-srs-engine-foundational-deck.md`
2. Follow the standard workflow: Design Spec → human approval → ST01 → ST02
3. Create design spec at: `.agents/plans/design-specs/` (follow naming conventions in WORKFLOW.md)

## What This Epic Builds

`packages/srs-engine/src/foundational.ts` — foundational deck mechanics distinct from curated deck:

- `getActiveFoundationalWords(words, config)` — 3-active cap (separate from the 8-word curated active window)
- `applyFoundationalWrongRule(wordState, consecutiveWrong)` — mastery reset to 0 on 3rd consecutive wrong (Learning phase only; not a lapse)
- `getFoundationalAllocation(totalBatchSize, poolDepleted, config)` — 20% of batch slots normally; drops to 5% when pool is depleted

Two stories:
- **EP06-ST01**: `foundational.ts` — active limit + continuous wrong rule + unit tests
- **EP06-ST02**: Batch allocation logic + unit tests

## File Ownership (this epic only touches)

- `packages/srs-engine/src/foundational.ts` ← new file
- `packages/srs-engine/src/types.ts` ← add foundational flag + consecutive-wrong counter fields to `WordState` if not already present; check first
- `packages/srs-engine/src/index.ts` ← add exports for new types/functions
- `packages/srs-engine/__tests__/unit/foundational.test.ts` ← new test file

**Do NOT touch**: `batch.ts`, `active-window.ts`, `stuck-words.ts` — those belong to EP04/EP05.

## Key Design Decisions (already made)

- **Depleted** = all active foundational words have passed mastery threshold
- Continuous wrong rule applies to **Learning phase only** — foundational words in ANKI phase use the standard ANKI lapse path from EP02
- Foundational ANKI scheduling uses the same `FsrsScheduler` from EP02 — no new scheduler needed

## Key Technical Context (from EP02)

- All engine types live in `packages/srs-engine/src/types.ts` — `WordState`, `SrsConfig`, `MasteryPhase`, `WordCategory` are already defined there
- Import convention: own-file imports use `.js` extension (e.g., `import { WordState } from './types.js'`) — required for ESM/tsc emit
- Run tests: `pnpm test` from root, or `pnpm --filter @gll/srs-engine test`
- No `any` types — strict TypeScript throughout

## Predecessor Work (EP02 — completed)

EP01 + EP02 are fully merged to `main`. This worktree branches from that clean state.
EP02 delivered: `WordState`, `SrsConfig`, `MasteryPhase`, `WordCategory`, `updateMastery`, `FsrsScheduler`, `SpacedRepetitionScheduler` interface — all available from `@gll/srs-engine`.
`WordState` likely needs a `foundational: boolean` flag and `consecutiveWrong: number` counter — check current shape in `src/types.ts` before adding.
