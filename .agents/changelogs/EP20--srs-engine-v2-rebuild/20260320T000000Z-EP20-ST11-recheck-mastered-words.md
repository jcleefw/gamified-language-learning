# EP20-ST11: Re-check mastered words on new deck entry

**Created**: 2026-03-20T00:00:00Z
**Epic**: [EP20 - SRS Engine v2 Rebuild](.agents/plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

When a deck is loaded and some of its words are already mastered from a previous deck run,
those words now receive a one-time re-check in the first batch. A correct answer confirms
mastery and the word is retired; a wrong answer re-enters the word into the active pool
without touching its streak or mastery state. Normal wrong-streak rules apply from the
second attempt onward.

## Files Modified

### `packages/srs-engine-v2/src/runner/interactive.ts`

- `nextActivePool` — added optional `recheckExempt: Set<string>` param; words in the set are
  exempt from mastery-based retirement
- `processRecheckResult` — new exported pure function encapsulating all re-check state
  transitions; handles `recheckPending` (first attempt) and `recheckReentered` (first wrong,
  back in pool) sets; always records `seen`/`correct` for pending words but suppresses
  streak/mastery changes
- `runAdaptiveLoop` — added optional `recheckIds: Set<string>` param; seeds re-check words
  directly into `active` (bypassing queue); passes `recheckPending ∪ recheckReentered` to
  every `nextActivePool` call; uses `processRecheckResult` instead of raw `updateRunState`
  in the results loop

### `packages/srs-engine-v2/src/main.ts`

- Computes `recheckIds` at deck-load time by filtering `deck.wordIds` against the current
  `RunState` for already-mastered words; passes set to `runAdaptiveLoop`
- Imports `isMastered` from `word-state`

### `packages/srs-engine-v2/src/__tests__/unit/recheck.test.ts` (new)

- 13 unit tests covering: `nextActivePool` exemption, correct/wrong first attempt,
  wrong second attempt (normal rules), mastery drop removing from `recheckReentered`,
  non-recheck words unaffected, empty `recheckIds` leaves existing behaviour unchanged

## Behaviour Added

- Re-check words seeded into `active` before first batch (count within `questionLimit`)
- Correct on first re-check → `seen`/`correct` increment; mastery/streaks unchanged; word retired next batch
- Wrong on first re-check → `seen` increments; mastery/streaks unchanged; word re-enters active pool
- Wrong on second attempt → `updateRunState` called normally; mastery decrements if wrong-streak threshold reached
- Word exits `recheckReentered` once mastery drops below threshold (normal retirement resumes)
- Zero re-check words → identical behaviour to pre-ST11

## Next Steps

- ST11 is the last planned story in EP20
- Deferred: FSRS/ANKI scheduling, stuck-word shelving, Hono route wiring
