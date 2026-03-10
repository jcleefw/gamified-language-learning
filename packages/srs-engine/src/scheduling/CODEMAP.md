# CODEMAP.md — `packages/srs-engine/src/scheduling/`

Scheduling subdomain: FSRS-based review scheduling implementation.

**Update this file when**: the scheduler interface changes, new scheduler implementations are added, or domain-private types change.

---

## Files

| File                     | Purpose                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `scheduler.interface.ts` | `SpacedRepetitionScheduler` interface — contract for all scheduler implementations; defines `scheduleReview(word, isCorrect): ReviewResult` |
| `types.ts`               | `ReviewResult` — domain-private result type (`nextIntervalDays`, `updatedFsrsState`); not exported from the package                         |
| `FsrsScheduler.ts`       | `FsrsScheduler` class — `SpacedRepetitionScheduler` impl wrapping `ts-fsrs`; 90-day interval cap, immutable (never mutates input state)     |
