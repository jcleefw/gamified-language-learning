# EP25-ST08: Sentence State & Spacing Types

**Created**: 20260517T214447Z
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](file:///Users/jc-everest/projects/experiments/gamified-language-learning/.agents/plans/epics/EP25-srs-engine-composer-registry.md)
**Status**: Complete ✅

## Summary

Created the basic types (`SentenceState`, `SentenceRunState`) and the default initializer factory (`defaultSentenceState`) for sentence scheduling as planned under DS03, and exported them from the package public API.

## Files Modified

### [sentence-state.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/sentence-state.ts)

- Created new file defining `SentenceState` structure, `SentenceRunState` Map, and `defaultSentenceState(sentenceId: string)` factory function.

### [index.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/index.ts)

- Exported `defaultSentenceState`, `SentenceState`, and `SentenceRunState` to expose these types in the `@gll/srs-engine-v2` package entrypoint.

### [sentence-state.test.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/__tests__/unit/sentence-state.test.ts)

- Created new unit test file to cover correct zero-states and type behavior for default sentence states.

## Behavior Preserved / New Behavior

- Preserved all existing 181 word-level SRS engine unit tests, recheck paths, MCQ selection, and adaptive loop simulation behaviors.
- Introduced `defaultSentenceState` returns correct default values for a given `sentenceId` (streak = 0, lastBatchSeen = -1, dailyCount = 0, sessionWrongStreak = 0, active = true).

## Next Steps

- Proceed to **EP25-ST09** to wire `SentenceRunState` into `runAdaptiveLoop` and configure spacing/eligibility gates (`active` and `lastBatchSeen`).
