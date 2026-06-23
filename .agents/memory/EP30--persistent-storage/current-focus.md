# Current Focus — EP30 Persistent Storage

**Branch**: `feat/EP30--persistent-storage`  
**Last updated**: 2026-06-23

---

## Active Epic

**EP30** — Persistent Storage Layer — **Impl-Complete**

---

## What Was Completed

All EP30 stories delivered and verified manually:

- **ST01**: `SentenceRunState` returned from `runAdaptiveLoop`
- **ST02 + ST02b**: Drizzle schema (11 tables) + migration infrastructure in `@gll/db`
- **ST04**: `LearningStore` interface + `SqliteLearningStore` implementation
- **ST05**: Curriculum import — JSON → DB (`engine:import-curriculum`)
- **ST06**: DB-backed runner (`engine:real-db`) + DB tools (clear/reset/seed)
- **ST07**: Write-on-answer callbacks (`onWordAnswer`, `onSentenceAnswer`)
- **ST08**: Graduation hook (`onGraduation`, `GraduationHook` type)
- **Post-ST08 fix**: Runner resume — mastered words filtered from session word list so new sessions start on unmastered vocabulary, not recheck batch

32 tests passing across `@gll/db` and `cli-demo-db`. All acceptance criteria met.

---

## Next Up

**EP31** — Convert `srs-demo` (the web app) to use persistent storage.

EP30 established the persistence layer in the CLI (`apps/cli-demo-db`). EP31 wires the same `@gll/db` / `SqliteLearningStore` into the web-facing SRS demo, replacing any in-memory or mock-DB state it currently uses.
