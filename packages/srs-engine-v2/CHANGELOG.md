# SRS Engine v2 Changelog

## EP20-ST10: Multi-deck support — WordPool + MockDeck + deck selection

**Date**: 2026-03-19

### Features

- **Global WordPool**: Introduced `wordPool` as the global source of truth for all unique words across conversations. Each word exists exactly once, enabling mastery carry-forward across decks.

- **MockDeck type**: New `MockDeck` structure with conversation context:
  - `lines`: Full conversation with per-line word components (enables future word_block questions)
  - `wordIds`: Reference into the global word pool (1:many relationship)
  - Preserves full dialogue structure from JSON source

- **Deck selection**: Interactive prompt to choose a deck before starting an adaptive loop run.

- **Cross-deck mastery persistence**: `RunState` now carries across deck switches via `runAdaptiveLoop` return value. A word mastered in deck 1 retains that mastery when entering deck 2.

- **Configurable max mastery**: Moved `MAX_MASTERY` constant to `StreakThresholds` config, allowing mastery scale (0–2, 0–5, etc.) to be set per session.

### Data

- **mock-word-pool.ts**: Global pool with 12 unique words (union of both test conversations)
- **mock-decks.ts**: Two decks with full conversation context:
  - Deck 1: "let's eat something" (6 words)
  - Deck 2: "The weather is hot today" (6 words)
  - Shared word: `กัน` (together) appears in both decks to test cross-deck mastery

### Types

- **deck.ts**:
  - `MockLine`: Speaker, native/english/romanization, per-line word components
  - `MockDeck`: id, topic, lines, wordIds
  - Replaced old flat `Deck` type

- **word-state.ts**:
  - `StreakThresholds` now includes `maxMastery` (configurable, was hardcoded 5)
  - `updateRunState` uses `thresholds.maxMastery` instead of constant

### Runner

- **interactive.ts**:
  - `selectDeck(decks)`: Deck selection with keypress input
  - `runAdaptiveLoop`: Now accepts optional `initialRunState` and returns final `RunState` for persistence
  - `printWordSummary`: Displays mastery as `N/maxMastery` using configured scale

### Main

- **main.ts**:
  - Loop-based flow: deck selection → adaptive loop → deck selection (repeat)
  - Single `RunState` persists across all deck runs in a session
  - Config includes `maxMastery` alongside other thresholds

### Tests

- **mock-decks.test.ts**: New 19-test suite validating deck shape, word pool references, no duplicates, shared word integrity

### Summary

ST10 establishes the structural foundation for multi-deck learning with persistent, pool-level mastery. Deck-specific context is preserved via `MockLine.words` for future question types. Users can now select decks sequentially and see previously mastered words carry forward automatically.
