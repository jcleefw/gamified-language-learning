# EP20-ST09: Word Streaks and Mastery

**Created**: 20260319T191136Z
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Commit**: 4dec848
**Status**: Complete ✅

## Summary

Replaced the binary `correct >= threshold` mastery model with a streak-driven integer
mastery system. `mastery` (0–5) rises with consecutive correct answers and falls with
consecutive wrong answers. Streaks are **not reset** after triggering a mastery change —
once a streak exceeds the threshold, each additional answer in the same direction triggers
another mastery change (fast climb / fast drop behaviour). Retirement is `mastery >= masteryThreshold`.

## Mastery Rules

| Event | Effect |
|---|---|
| Correct answer | `correctStreak += 1`, `wrongStreak = 0` |
| Correct, `correctStreak >= correctStreakThreshold` | `mastery = min(5, mastery + 1)` |
| Wrong answer | `wrongStreak += 1`, `correctStreak = 0` |
| Wrong, `wrongStreak >= wrongStreakThreshold` | `mastery = max(0, mastery - 1)` |
| Either, mastery at cap/floor | No change (capped at 5, floored at 0) |

`seen` and `correct` (cumulative totals) are unchanged by this story.

## Files Modified

### `packages/srs-engine-v2/src/types/word-state.ts`

- Added `MAX_MASTERY = 5` constant
- Added `mastery: number`, `correctStreak: number`, `wrongStreak: number` to `WordState`
- Added `StreakThresholds` interface `{ correctStreakThreshold, wrongStreakThreshold }`
- Updated `updateRunState` signature: 4th param `thresholds: StreakThresholds`
- Updated `isMastered`: now checks `ws.mastery >= threshold` (was `ws.correct >= threshold`)

### `packages/srs-engine-v2/src/__tests__/unit/word-state.test.ts`

Full replacement of old `isMastered` tests. New test groups:

- **Cumulative fields** — `seen` and `correct` unchanged (regression guard)
- **Streaks** — `correctStreak` increments on correct / resets on wrong; `wrongStreak` increments on wrong / resets on correct
- **Mastery increment** — below threshold: no change; at threshold: mastery +1; above threshold: +1 per answer (no reset); cap at 5
- **Mastery decrement** — below threshold: no change; at threshold: mastery -1; above threshold: -1 per answer (no reset); floor at 0
- **isMastered** — `mastery < threshold` → false; `mastery >= threshold` → true

### `packages/srs-engine-v2/src/__tests__/unit/adaptive-loop.test.ts`

- `makeState` helper updated to include `mastery`, `correctStreak`, `wrongStreak` fields (with defaults)
- Test entries that represent mastered words now set explicit `mastery: 3` (previously relied on `correct >= threshold` which no longer drives `isMastered`)

### `packages/srs-engine-v2/src/runner/interactive.ts`

- `runAdaptiveLoop` gains `streakThresholds: StreakThresholds` parameter; passed through to `updateRunState`
- `printWordSummary` now shows `mastery: N/5  streaks: +N/-N`

### `packages/srs-engine-v2/src/main.ts`

- Config cleaned up: removed stale top-level constants, `nonFoundationWordsCount` and `foundationalWordsCount` now live in `config` and drive the `words` array
- Added `masteryThreshold: 5`, `correctStreakThreshold: 3`, `wrongStreakThreshold: 2` to config

## Test Results

51/51 tests pass.
