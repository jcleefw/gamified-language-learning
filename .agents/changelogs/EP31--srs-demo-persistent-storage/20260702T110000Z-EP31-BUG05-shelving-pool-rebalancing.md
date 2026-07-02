# EP31-BUG05: Fix Active Pool Not Rebalancing After Shelving

**Date**: 20260702T110000Z
**Status**: Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)
**Type**: Bug Fix

---

## 1. Problem Statement

When words were shelved during a batch, they were excluded from batch assembly but the active session pool wasn't updated. Subsequent batches would have fewer than the configured number of words (1-2 instead of 3), degrading the quiz experience.

### Root Cause

After calling `applyShelving()`, the code removed shelved words locally (`shelvedSet.add(id)`) but didn't update the session state's active and queue pools. The shelved words remained in `sessionState.value.active` and `sessionState.value.queue`, reducing available words for future batches.

### Impact

- Active pool size dropped after shelving
- Batches had incomplete word count
- Poor UX: fewer quiz questions per batch when shelving occurred
- Violates the "active pool maintains configured size" requirement

---

## 2. Solution

After shelving, rebalance the active pool by removing shelved words and pulling new words from the queue to maintain the configured batch size.

### Changes

#### apps/srs-demo/src/App.vue
**Lines 370-382**: Added pool rebalancing after shelving

```typescript
if (decision.toShelve.length > 0) {
  await applyShelving({ deckId: deckId.value, toShelve: toShelvePayload });
  console.log('[SHELVING] Successfully persisted to DB');
  decision.toShelve.forEach((id: string) => shelvedSet.value.add(id));

  // Rebalance active pool: remove shelved words and pull new ones from queue
  const shelvingSet = new Set(decision.toShelve);
  const newActive = sessionState.value.active.filter((w) => !shelvingSet.has(w.id));
  const newQueue = sessionState.value.queue.filter((w) => !shelvingSet.has(w.id));

  const { active, queue } = nextActivePool(
    newActive,
    newQueue,
    CONFIG.value.wordsPerBatch,
    sessionState.value.runState,
    CONFIG.value.masteryThreshold,
    new Set([...sessionState.value.recheckPending, ...sessionState.value.recheckReentered]),
  );

  sessionState.value.active = active;
  sessionState.value.queue = queue;
}
```

---

## 3. Acceptance Criteria

- [x] After shelving, active pool size equals configured `wordsPerBatch`
- [x] New words are pulled from queue to fill gaps left by shelved words
- [x] Session state active/queue pools are updated correctly
- [x] E2E test validates batch maintains expected word count after shelving

---

## 4. Testing

**E2E Test**: apps/srs-demo/e2e/features/shelving.feature
- Scenario: "Active pool rebalances after shelving (batch window maintains size)"
- Validates: active pool size maintained after shelving
- Validates: shelved words don't appear in subsequent batches

---

## 5. Commits

- `7d656c7` - Fix shelving bug: rebalance active pool when words are shelved
- `3b8f857` - Add e2e test for shelving + batching pool rebalancing fix

---

## 6. Related Issues

- **EP31-BUG01, BUG02, BUG03, BUG04**: Related shelving persistence bugs
- Discovered during shelving implementation and e2e testing
