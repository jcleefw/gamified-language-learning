# EP24-ST02: `useSession` Composable — localStorage Persistence

**Date**: 20260511T230626Z
**Epic**: EP24 — Vue SRS Demo App
**Story**: EP24-ST02
**Status**: Completed

## What changed

**Files created**:
- `apps/srs-demo/src/composables/useSession.ts`

## Implementation

Three exported functions:

```ts
saveSession(deckId, activeItems, queue, runState, recheckPending, recheckReentered): void
loadSession(): { deckId, activeItems, queue, runState, recheckPending, recheckReentered } | null
clearSession(): void
```

`PersistedSession` interface serialises:
- `RunState` (`Map<string, WordState>`) → `[string, WordState][]` (array of entries)
- `recheckPending` / `recheckReentered` (`Set<string>`) → `string[]`

`loadSession` wraps `JSON.parse` in try/catch and returns `null` on missing or malformed data — no throws leak to callers.

## Decisions

- Plain functions rather than a composable factory — no Vue reactivity needed here; the composable just encapsulates the serialisation logic.
- Separate parameters instead of a single state object — keeps the call site explicit about what is persisted.
