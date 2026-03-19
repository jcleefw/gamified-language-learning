# EP20-ST05: Non-foundational words in the mix

**Created**: 20260319
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Extended the quiz engine to handle `MockWord` alongside `MockConsonant` via a `QuizItem`
union type. Words display plain english (no class suffix). Distractor pools remain
homogeneous per call. All IDs updated to a language-namespaced format (`th::native`).
Config extracted to a single object in `main.ts`. Two `composeBatchMulti` calls (split
question limit) produce a combined shuffled quiz.

## Files Modified

### `packages/srs-engine-v2/data/mock/mock-consonants.ts`

- Updated all 5 IDs from kebab-romanization (`ko-kai`) to `th::native` format (`th::ก`)

### `packages/srs-engine-v2/data/mock/mock-words.ts`

- Added `id: string` to `MockWord` interface
- Populated `id: 'th::native'` for all 15 entries (e.g. `th::หิว`, `th::ไป`)

### `packages/srs-engine-v2/src/engine/compose-batch.ts`

- Imported `MockWord`
- Defined `export type QuizItem = MockConsonant | MockWord`
- Replaced `englishWithClass` with `getEnglishLabel(item: QuizItem)`:
  - Consonant (`'class' in item`): `"${english} (${class})"`
  - Word: plain `english`
- Generalised `composeBatch` and `composeBatchMulti` signatures to `QuizItem`

### `packages/srs-engine-v2/src/main.ts`

- Replaced separate constants with a `config` object (`foundationalWordCount`, `nonFoundationalWordCount`, `questionLimit`)
- Imported `mockWords`; calls `composeBatchMulti` twice (consonant half + word half)
- Combined results shuffled before passing to `runInteractive`

### `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`

- Added `describe('composeBatch with MockWord')` — 1 test: choices are exact english values
- Added `describe('composeBatchMulti with word pool')` — 5 tests:
  - Returns exactly `questionLimit` questions
  - Every input word appears in at least 1 question
  - Each question has exactly 4 choices, exactly 1 correct
  - No duplicate word+direction pairs
  - `native-to-english` choices are plain english (no class suffix)

## Behavior Preserved / New Behavior

- All 21 tests pass (2 smoke + 14 ST03–ST04 + 6 new ST05)
- Consonant questions still use `"sound (class)"` format
- Word questions use plain english — `"hungry"` not `"hungry (undefined)"`
- Distractors never cross pools (words distract from word pool only)
- Changing any value in `config` requires editing one line
