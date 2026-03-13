# EP15-ST05: Add `native_to_romanization` Question Direction

**Created**: 20260314T000000Z
**Epic**: [EP15 - Quiz Contract: Server-Side Answer Authority](../../plans/epics/EP15-quiz-contract-server-authority.md)
**Design**: [EP15-DS03](./20260314T000000Z-EP15-DS03-native-to-romanization-direction.md)
**Status**: Complete ✅

## Summary

Added a third MC question direction: `native_to_romanization` (see Thai character, pick the consonant's full romanization name). This tests a distinct skill from `native_to_english` — many consonants share the same English sound (`"kh"` maps to ข, ค, ฆ, ฅ), making romanization the only unambiguous label. The direction picker was changed from a 50/50 coin flip to a uniform 1-of-3 selection via a `DIRECTIONS` constant array.

## Files Modified

### `packages/api-contract/src/srs.ts`

- Expanded `QuestionDirection` union: `'english_to_native' | 'native_to_english' | 'native_to_romanization'`
- Rebuilt `dist/` via `pnpm --filter @gll/api-contract build` to propagate type to consumers

### `apps/server/src/routes/srs.ts`

- Added `DIRECTIONS` constant array: `['english_to_native', 'native_to_english', 'native_to_romanization']`
- `buildMcChoices`: replaced `isEngToNative` boolean with explicit `if/else if/else` branches; added `native_to_romanization` branch — `targetText = .native`, `correctText = .romanization`, distractors from `.romanization`; refactored shared distractor logic behind a `distractorField` callback
- `/batch` handler: replaced `Math.random() < 0.5 ? ... : ...` picker with `DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]!`

### `apps/server/src/routes/__tests__/srs.test.ts`

- Updated direction test: added `allRomanizations` set; added `'native_to_romanization'` to `validDirections`; added `else if` branch — asserts `targetText` is in native set and all choice values are in romanization set

## Behavior Preserved / New Behavior

- All 19 server tests pass
- `pnpm typecheck` green across monorepo
- Each MC question is now uniformly drawn from three directions; `native_to_romanization` shows a Thai character as prompt with 4 romanization strings as choices
- `correctKey` determination and `/answers` flow unchanged across all three directions
- No changes to `batchRegistry`, `store`, seed files, or `/answers` handler
