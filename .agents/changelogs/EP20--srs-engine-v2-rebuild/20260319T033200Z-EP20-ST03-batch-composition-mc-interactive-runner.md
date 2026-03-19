# EP20-ST03: Batch composition — 1 consonant, 4 MC questions, interactive runner

**Created**: 20260319T033200Z
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Given 1 consonant from `mockConsonants`, composes a batch of 4 multiple-choice questions (one per direction) and runs them interactively in the terminal. Each question shows immediate feedback; a final score is printed at the end.

## Files Modified

### packages/srs-engine-v2/src/types/quiz.ts (new)

- `QuizDirection` — named string union: `'native-to-english' | 'english-to-native' | 'native-to-romanization' | 'romanization-to-native'`
- `QuizChoice` — `{ label, value, isCorrect }`
- `QuizQuestion` — `{ direction, prompt, choices }`

### packages/srs-engine-v2/src/engine/compose-batch.ts (new)

- `composeBatch(consonant, pool)` → `QuizQuestion[]` — produces all 4 directions
- English always formatted as `"${english} (${class})"` (e.g. `k (middle)`)
- Prompt is bare word only — no question sentence
- 3 distractors picked randomly from remaining consonants; same field type as the correct answer (no mixing)

### packages/srs-engine-v2/src/runner/interactive.ts (new)

- `runInteractive(questions)` — readline loop: displays prompt + labelled choices, waits for `a/b/c/d` input, shows per-answer feedback, prints final score

### packages/srs-engine-v2/src/main.ts

- Updated to call `composeBatch(mockConsonants[0], mockConsonants)` then `runInteractive`

### packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts (new)

- 8 unit tests covering: 4 questions returned, 4 choices each, 1 correct per question, each direction's choices are the correct field type, correct answer always in choices

## Behavior Preserved / New Behavior

- `pnpm --filter @gll/srs-engine-v2 test` — 10 tests pass (2 smoke + 8 unit)
- `pnpm quizv2` — interactive terminal quiz: 4 questions, per-answer feedback, final score
- Distractor type rule: choices for a given direction are all the same field — no native/english/romanization mixing

## Next Steps

- ST04 — Batch composition for ST03 + 3 words
