# EP31-BUG02: Enhanced Error Handling in Shelving API Calls

**Date**: 20260702T183100Z
**Status**: Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)
**Type**: Bug Fix

---

## 1. Problem Statement

The `applyShelving()` function in `useShelving.ts` had weak error handling that could mask API failures. Only HTTP status code was validated; response body success flag was not checked. Errors were also caught and silently logged via `.catch(console.error)` without visibility.

### Root Cause

- No validation of response `success` field
- No error body inspection on HTTP failure
- Silent error swallowing made debugging difficult

### Impact

- Shelving API failures went unnoticed
- Shelved words might not persist to database despite apparent success
- Difficult to debug issues when shelving doesn't work

---

## 2. Solution

Add comprehensive response validation and improve error logging.

### Changes

#### apps/srs-demo/src/composables/useShelving.ts
**Lines 27-31**: Enhanced error validation

```typescript
// Before
export async function applyShelving(request: ApplyShelvingRequest): Promise<void> {
  const res = await fetch('/api/shelving/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/shelving/apply failed: ${res.status}`);
}

// After
export async function applyShelving(request: ApplyShelvingRequest): Promise<void> {
  const res = await fetch('/api/shelving/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/shelving/apply failed: ${res.status} ${text}`);
  }
  const body = await res.json() as { success: boolean };
  if (!body.success) throw new Error('POST /api/shelving/apply returned success:false');
}
```

#### apps/srs-demo/src/App.vue
**Lines 368-372**: Improved error logging for shelving operations

```typescript
// Before
await applyShelving({ deckId: deckId.value, toShelve: ... }).catch(console.error);

// After
const toShelvePayload = decision.toShelve.map((id: string) => ({ wordId: id, batchNum: batchNum.value }));
console.log('[SHELVING] Applying shelving:', { deckId: deckId.value, toShelve: toShelvePayload });
try {
  await applyShelving({ deckId: deckId.value, toShelve: toShelvePayload });
  console.log('[SHELVING] Successfully persisted to DB');
} catch (err) {
  console.error('[SHELVING] Failed to persist:', err);
}
```

---

## 3. Acceptance Criteria

- [x] HTTP errors return detailed error messages with status and body
- [x] Response body `success: false` is detected and throws
- [x] Shelving operations log what they're attempting and whether they succeed
- [x] Errors are visible in browser console for debugging

---

## 4. Testing

**Manual Testing**:
- Shelving API calls now include debug logs
- Network errors and failed responses are explicitly reported
- Made it easier to diagnose EP31-BUG01 bug

---

## 5. Commits

- `2aa5925` - Fix shelving persistence bug across sessions (includes error handling)

---

## 6. Related Issues

- **EP31-BUG01**: Shelved words pool exclusion bug (helped diagnose this issue)
