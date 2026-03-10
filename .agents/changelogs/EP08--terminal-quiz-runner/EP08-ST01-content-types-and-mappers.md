# EP08-ST01: Content Types + Seed Data Mappers

**Created**: 20260310T002305Z
**Epic**: [EP08 - Terminal Quiz Runner + Seed Data](../../plans/epics/EP08-terminal-quiz-runner.md)
**Status**: Complete ✅

## Summary

Created the data layer for the SRS engine's real-content pipeline. Defined language-agnostic
content types and two pure mapper functions that convert raw Thai seed data into `WordState[]`.
A code review caught a spec deviation (`thai` field instead of `native`) which was fixed before
commit — all types, mappers, and tests use the language-agnostic `native` field throughout.

## Files Modified

### `packages/srs-engine/data/types.ts` _(created)_
- `FoundationalCharacter` — language-agnostic base type (id, char, name, romanization, language, type)
- `ConversationWord` — uses `native` field (not language-specific `thai`); source of truth for identity
- `Conversation` — deck with `uniqueWords: ConversationWord[]`; `id` and `createdAt` from raw JSON
- `ConversationLine` — defined for completeness; not consumed by any mapper in Stage 1

### `packages/srs-engine/data/mappers.ts` _(created)_
- `characterToWordState(character)` — maps `FoundationalCharacter` → fresh `WordState` with `wordId: foundational:{id}`, `category: 'foundational'`, all counters 0
- `conversationWordsToWordStates(words)` — maps `ConversationWord[]` → `WordState[]` with `wordId: curated:{word.native}`, deduplicates by `native` (first occurrence wins)

### `packages/srs-engine/data/__tests__/mappers.test.ts` _(created)_
- Unit tests: `characterToWordState` shape, wordId format for distinct characters
- Unit tests: `conversationWordsToWordStates` mapping, deduplication, empty input
- Integration tests: first 5 consonants (ก ข ค ง จ) map to valid foundational WordStates
- Integration tests: conversation uniqueWords produce no duplicate wordIds

### `packages/srs-engine/vitest.config.ts` _(modified)_
- Added `data/**/__tests__/**/*.test.ts` to `test.include`

### `packages/srs-engine/data/CODEMAP.md` _(created)_
- Documents `types.ts`, `mappers.ts`, `samples/`, `__tests__/`

## Behavior Preserved / New Behavior

- `ConversationWord.native` is language-agnostic — callers adapt their field (e.g. `raw.thai → native`) before passing in; sample JSON is unchanged
- Word IDs are machine-generated and never typed by users: `foundational:ko-kai`, `curated:หิว`
- Deduplication by `native` ensures one `WordState` per unique word across all conversations
- All 179 tests pass (`pnpm test`)

## Next Steps

- EP08-ST02: Terminal quiz runner (`scripts/quiz-runner.ts`)
