# EP13-ST01: API Contract Wire Type Additions + In-Memory State Module

**Created**: 20260312T000000Z
**Epic**: [EP13 - `apps/server` — SRS Routes + In-Memory State](.agents/plans/epics/EP13-srs-routes-in-memory-state.md)
**Status**: Complete ✅

## Summary

Extended `@gll/api-contract` with five missing wire-type fields identified in DS01. Created `apps/server/src/state/` with three modules: `store.ts` (mutable state singletons), `engine.ts` (`SrsEngine` singleton), and `batchRegistry.ts` (batch tracking map). Added `@gll/srs-engine` as a server dependency.

## Files Modified

### packages/api-contract/src/srs.ts
- `QuizQuestion`: added `targetText: string`
- `GetBatchRequest`: added `deckId: string`; updated comment from GET to POST
- `BatchPayload`: added `batchId: string`
- `SubmitAnswersRequest`: added `batchId: string`
- Added `SubmitAnswersResponse` interface (`processed: number`, `updatedWords: AnswerResultPayload[]`)

### apps/server/package.json
- Added `"@gll/srs-engine": "workspace:*"` to dependencies

### apps/server/CODEMAP.md
- Added `## State (src/state/)` section linking to sub-CODEMAP

## Files Created

### apps/server/src/state/store.ts
- Exports `deckId: string` — `crypto.randomUUID()` at module load, logged to console
- Exports `wordStates: WordState[]` — mutable, initially empty
- Exports `wordDetails: Map<string, WordDetail>` — initially empty
- Exports `seedStore(states, details)` — populates state (called at startup by server or tests)
- Exports `setWordStates(states)` — called by answers route after `processAnswers`
- Exports `WordDetail` interface: `{ native, romanization, english, category }`

### apps/server/src/state/engine.ts
- Exports `DEFAULT_SRS_CONFIG: SrsConfig` — matches `quiz-runner.ts` values (batchSize: 15, etc.)
- Exports `initEngine(config?: Partial<SrsConfig>)` — reinitialises singleton with override
- Exports `getEngine(): SrsEngine` — returns the active singleton

### apps/server/src/state/batchRegistry.ts
- Exports `register(batchId: string, questions: QuizQuestion[])` — stores batch in Map
- Exports `get(batchId: string): QuizQuestion[] | undefined` — retrieves batch
- Exports `clearRegistry()` — test helper, clears all entries

### apps/server/src/state/CODEMAP.md
- Documents all three state module files and their exports

### apps/server/src/state/__tests__/store.test.ts
- Tests: `seedStore` populates `wordStates`, `wordDetails` has entries, `deckId` is non-empty string

### apps/server/src/state/__tests__/batchRegistry.test.ts
- Tests: `get` returns registered questions, unknown id returns `undefined`, independent batches don't interfere

## Behavior Preserved / New Behavior

- `pnpm test` green (8 tests, 4 files) for `@gll/server`
- `pnpm typecheck` clean for `@gll/api-contract` and `@gll/server`
- `deckId` printed to console on module import
- State starts empty — caller (`src/index.ts` or test) calls `seedStore` to populate

## Next Steps

- EP13-ST02: `POST /api/srs/batch` route
