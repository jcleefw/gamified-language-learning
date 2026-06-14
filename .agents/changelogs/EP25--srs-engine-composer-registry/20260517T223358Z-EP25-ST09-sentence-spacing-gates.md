# EP25-ST09: Eligibility gates — active + batch gap

**Created**: 20260517T223358Z
**Epic**: [EP25--srs-engine-composer-registry](file:///.agents/changelogs/EP25--srs-engine-composer-registry)
**Status**: Complete ✅

## Summary

Wired `SentenceRunState` into the adaptive session learning loop (`runAdaptiveLoop` and `runBatch` orchestration layers). Implemented the active status eligibility gate and the batch-gap spacing gate inside `resolveEligibleContexts` to prevent sentences from appearing back-to-back. Mathematically resolved and verified Open Question 2 (OQ2).

## Files Modified

### [packages/srs-engine-v2/demo/config.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/demo/config.ts)

- Added `sentenceBatchGap: 1` to the static `LEARNING_CONFIG` parameters to configure the minimum batch count that must pass before a sentence is eligible to reappear.

### [packages/srs-engine-v2/demo/learning-io.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/demo/learning-io.ts)

- Updated `resolveEligibleContexts` to accept `sentenceRunState` and `batchNum`, gating sentence contexts on `active === true` and enforcing `batchNum - lastBatchSeen > sentenceBatchGap`.
- Refactored `runBatch` to accept and thread `sentenceRunState` to the eligible context resolver.
- Initialized `sentenceRunState` inside `runAdaptiveLoop` and wired the results processing logic to update `lastBatchSeen` to the current batch number immediately after `runBatch` executes.

### [packages/srs-engine-v2/src/__tests__/unit/sentence-spacing.test.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/__tests__/unit/sentence-spacing.test.ts)

- **NEW**: Created 4 comprehensive unit test cases verifying:
  1. Sentences never seen before (`lastBatchSeen = -1`) successfully pass the spacing gate.
  2. Sentences served in the immediate previous batch fail the spacing gate (consecutive back-to-back failure).
  3. Sentences served with an adequate batch gap successfully pass the spacing gate.
  4. Inactive sentences (`active = false`) are always excluded from eligible pools regardless of spacing gaps.

### [.agents/changelogs/EP25--srs-engine-composer-registry/20260515T091946Z-EP25-DS03-sentence-state-spacing.md](file:///.agents/changelogs/EP25--srs-engine-composer-registry/20260515T091946Z-EP25-DS03-sentence-state-spacing.md)

- Updated the status of **OQ2** to **Resolved** with mathematical proof showing that spacing gates correctly evaluate at the start of batch $N+1$ when updating states immediately after batch $N$ returns.

## Behavior Preserved / New Behavior

- **Consecutive Avoidance**: Sentences are guaranteed to be spaced out by exactly `sentenceBatchGap` batches (default: 1), ensuring that users are never served the same sentence back-to-back.
- **Deactivated Censorship**: Graduated or shelved sentences (defined as `active: false`) are completely blocked from being returned as eligible contexts, even if the word seen thresholds are still satisfied.
- **Word Ingestion**: The existing `minSeenForSentence` word seen checks remain fully active and evaluate before spacing checks.

## Next Steps

- **EP25-ST10**: Implement streak tracking, consecutive correct graduation exits, and wrong streak shelving state mutations inside results updates.
