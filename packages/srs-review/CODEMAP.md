# packages/srs-review CODEMAP

Package: `@gll/srs-review`
Purpose: Review scheduling for words graduating from Learning. Wraps the `ts-fsrs` library (spaced repetition algorithm) with a domain contract that's swappable for other schedulers.

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | Public exports: types and FsrsScheduler implementation. |
| `src/types.ts` | Type contracts: ReviewScheduler interface, ReviewCard, ReviewRating, GraduationPerformance. |
| `src/FsrsScheduler.ts` | FSRS (Free Spaced Repetition System) scheduler: seed cards on graduation, schedule advances after reviews, check due status. |

## Core Concepts

**ReviewScheduler** — Interface with three methods:
- `seed(wordId, performance, now)`: Create a ReviewCard when a word graduates from Learning, using GraduationPerformance hints to set initial difficulty.
- `schedule(card, rating, now)`: Advance a card after the user reviews it (rating: 'again', 'hard', 'good', 'easy').
- `isDue(card, now)`: Check if a card is due for review.

**ReviewCard** — Persisted record per word in Review stage:
- `wordId`: Unique identifier.
- `due`: Next review date (only field the runner reads; others are opaque to the scheduler).
- `schedulerData`: Opaque blob (ts-fsrs Card in binary form).

**GraduationPerformance** — Snapshot when a word graduates from Learning:
- `correctStreak`: How many correct answers in a row at graduation.
- `lapses`: Times mastery was lost (dropped to Learning) before graduating.
- `correctRatio`: Overall success rate (correct / seen).

## Dependencies

| Package | Source | Purpose |
|---|---|---|
| ts-fsrs | `ts-fsrs@^5` | Spaced repetition algorithm; engine.next() schedules cards. |

## Design Notes

- **Decoupled from domain state**: This package never imports WordState or LearningStore. It only works with primitives (dates, strings, numbers) and opaque schedulerData blobs.
- **Swappable**: The ReviewScheduler interface allows other implementations (e.g., SM-2) to replace FsrsScheduler without touching dependents.
- **Seed heuristic**: FsrsScheduler infers an initial FSRS grade from GraduationPerformance (easy/good/hard) — generous thresholds to front-load successful reviews.
