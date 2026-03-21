# EP20-ST13: Extended foundational types - vowels, tones, and configurable directions

**Created**: 20260322T023116Z
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](file:///Users/jc.lee/projects/experiments/gamified-language-learning/.agents/plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Introduced full support for all three Thai foundational categories (Consonants, Vowels, and Tones) within the SRS engine. This required migrating from an implicit, structural check for foundational items to an explicit tagged-union model using the new `foundationalType` discriminant. 

A new engine capability allows per-category quiz direction configuration. While consonants and vowels still receive all 4 standard MC directions, tones are now restricted to 2 directions (mark ↔ sound name). This restriction prevents low-signal multiple-choice questions where distinguishing between tiny diacritic marks by themselves was visually difficult in the terminal.

For the terminal runner, a placeholder character `อ` (Or Ang) was added to standalone combining marks in the mock data to improve readability and address terminal font rendering constraints.

## Files Modified

### packages/srs-engine-v2/data/mock/mock-consonants.ts
- Added `foundationalType: 'consonant'` to the interface and all mock items.

### packages/srs-engine-v2/src/types/foundational.ts (NEW)
- Defined `MockVowel`, `MockTone`, and the unified `MockFoundational` union type.

### packages/srs-engine-v2/data/mock/mock-vowels.ts (NEW)
- Created seed data for 5 core Thai vowels with placeholder marks.

### packages/srs-engine-v2/data/mock/mock-tones.ts (NEW)
- Created seed data for 5 Thai tone marks with placeholder marks.

### packages/srs-engine-v2/src/engine/compose-batch.ts
- Updated `QuizItem` to include foundational types.
- Implemented `FOUNDATIONAL_DIRECTIONS` configuration table.
- Refactored `composeBatch` and `getEnglishLabel` to utilize the new explicit discriminant.

### packages/srs-engine-v2/src/learning/learning-io.ts
- Updated `runBatch` to differentiate between foundational items and standard words using the `foundationalType` property instead of a property check for `class`.

### packages/srs-engine-v2/src/learning/learning-runner.ts
- Refactored to include a unified `mockFoundational` pool.
- Updated the word selection logic to explicitly include 1 consonant, 1 vowel, and 1 tone first to ensure test coverage.

### packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts
- Added test blocks for vowels and tones.
- Verified that tone questions are correctly restricted to 2 directions.

## Behavior Preserved / New Behavior

- **Direction Control**: Different foundational types now generate a subset of directions based on configuration.
- **Improved Discriminant**: Engine logic no longer relies on checking for the presence of the `class` property to identify a foundational item.
- **Terminal Readability**: Standalone combining marks now use a carrier character placeholder.
- **Standard Quizzing**: Native-to-English and English-to-Native loops remain the core for all foundational categories.

## Next Steps

- Proceed with FSRS scheduling integration (deferred scope).
- Wire the new foundational pool into the deck/batch composition logic (more advanced scenarios).
