# EP31-BUG01: Fix Shelved Words Not Excluded from Active Pool on Session Resume

**Date**: 20260702T183000Z
**Status**: Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)
**Type**: Bug Fix

---

## 1. Problem Statement

When resuming a session, previously-shelved words loaded from the database were not being excluded from the active learning pool. This caused shelved words to reappear in quiz batches even though they should have been hidden.

### Root Cause

The `initSession()` function in `App.vue` and `runAdaptiveLoop()` in `learning-io.ts` received the shelved words set from the database but never filtered it out before initializing the adaptive session state. The shelved words remained in the active and queue pools, presenting them to the user in subsequent batches.

### Impact

- Shelved words reappeared in quizzes after session resume
- Stagnant words that were temporarily shelved due to lack of progress were shown again
- Violates the shelving contract: shelved words should be hidden until unshelved

---

## 2. Solution

Filter out shelved words before calling `initAdaptiveSession()`, ensuring they are never included in the active or queue pools.

### Changes

#### apps/srs-demo/src/App.vue
**Lines 277-282**: Updated word filtering in `initSession()`

```typescript
// Before
const words = allWords.filter((w) => {
  const ws = globalRunState.value.get(w.id);
  return ws == null || !isMastered(ws, CONFIG.value.masteryThreshold);
});

// After
const words = allWords.filter((w) => {
  const ws = globalRunState.value.get(w.id);
  const isMasteredWord = ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
  const isShelvedWord = shelvedSet.value.has(w.id);
  return !isMasteredWord && !isShelvedWord;
});
```

#### apps/cli-demo-db/src/learning-io.ts
**Lines 321-325**: Updated `runAdaptiveLoop()` to filter shelved words

```typescript
// Before
let state = initAdaptiveSession(words, config, recheckIds, initialRunState);

// After
const shelvedSet: Set<string> = new Set(initialShelvedIds ?? []);
const unshelvedWords = words.filter((w) => !shelvedSet.has(w.id));
let state = initAdaptiveSession(unshelvedWords, config, recheckIds, initialRunState);
```

---

## 3. Acceptance Criteria

- [x] Shelved words from database are excluded from active pool on session resume
- [x] No previously-shelved words appear in quiz batches after resume
- [x] Shelving state persists correctly across session boundaries
- [x] BDD test validates the fix

---

## 4. Testing

**Unit/Integration Test**: apps/cli-demo-db/src/__tests__/shelving-integration.test.ts
- New test: "Shelving persistence across sessions > shelved words loaded from DB are excluded from active pool on session resume"
- Verifies filtering logic works correctly
- All 8 shelving integration tests passing ✓

---

## 5. Commits

- `2aa5925` - Fix shelving persistence bug across sessions
- `c39c972` - Remove debug logging from shelving code
- `b480f96` - Add BDD test for shelving persistence across sessions

---

## 6. Related Issues

- **EP31-BUG02**: Enhanced error handling in shelving API calls
- Discovered during review-ui-implementation (EP31 concurrent work)
