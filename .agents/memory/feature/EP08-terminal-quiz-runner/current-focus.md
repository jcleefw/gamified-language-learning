# EP08 — Current Focus

**Branch**: feature/EP08-terminal-quiz-runner
**Epic**: Terminal Quiz Runner + Real Seed Data

## Status
DS01 reviewed and updated. TDD plan approved. Ready to execute ST01 implementation (`tdd-implement`).

## Next Step
ST01: Content types + seed data mappers — run `tdd-implement` with the approved plan below.

## Key Decisions (from DS01 review)
- **Language-agnostic types**: `FoundationalCharacter` (not `ThaiCharacter`), `metadata: Record<string, unknown>` for Stage 1
- Conversation types keep `thai` field name as-is (matches real sample data); renamed to `text` in Stage 2 DB schema
- Word IDs: `foundational:ko-kai` (uses pre-set ASCII `id` field), `curated:หิว` (native Thai character as ID key)
- `slugifyWord` removed — romanization stripping loses tone information; native character is the source of truth for uniqueness; IDs are machine-generated, never typed by users
- Only 5 consonants for foundational deck (ก ข ค ง จ)
- Dedup conversation words by `thai` field
- Types in `packages/srs-engine/data/types.ts`, mappers in `data/mappers.ts`
- Tests in `data/__tests__/mappers.test.ts` — requires adding `data/**/__tests__/**/*.test.ts` to vitest include
- `data/samples/foundations-consonants.ts` import needs fixing: `@/types/characters` → `../types.js`, type `ThaiCharacter` → `FoundationalCharacter`

## Approved TDD Plan for ST01
### Files to create
- `packages/srs-engine/data/types.ts`
- `packages/srs-engine/data/mappers.ts`
- `packages/srs-engine/data/__tests__/mappers.test.ts`

### Files to modify
- `packages/srs-engine/data/samples/foundations-consonants.ts` — fix import + rename type
- `packages/srs-engine/vitest.config.ts` — add `data/**/__tests__/**/*.test.ts`

### Test plan (in order)
1. `characterToWordState` — produces valid foundational WordState (category, phase, counters 0)
2. `characterToWordState` — wordId format `foundational:{id}`
3. `conversationWordsToWordStates` — maps to curated WordStates, wordId = `curated:{word.thai}`
4. `conversationWordsToWordStates` — deduplicates by `thai` field
5. `conversationWordsToWordStates` — empty array → empty array
6. Integration: first 5 consonants map to valid WordStates
7. Integration: conversation `uniqueWords` map with no duplicate wordIds

### Implementation steps (in order)
1. Create `data/types.ts`
2. Update `data/samples/foundations-consonants.ts` (import + type rename)
3. Create `data/mappers.ts`
4. Add `data/**/__tests__/**/*.test.ts` to vitest include
5. Create `data/__tests__/mappers.test.ts`
6. Run `pnpm test` — all green
7. Create/update `packages/srs-engine/data/CODEMAP.md`

## Files Modified This Session
- `.agents/plans/epics/EP08-terminal-quiz-runner.md` — updated scope: real data, language-agnostic types, 5 consonants
- `.agents/changelogs/EP08--terminal-quiz-runner/EP08-DS01-terminal-quiz-runner.md` — created + reviewed + updated: FoundationalCharacter, native char as ID key, slugifyWord removed
