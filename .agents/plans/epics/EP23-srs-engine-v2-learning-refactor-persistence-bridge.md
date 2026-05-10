# EP23 - SRS Engine v2: Learning Phase Refactor & Persistence Bridge

**Created**: 20260321T192340Z
**Status**: Draft

---

## 1. Feature Overview

This specification covers the full scope of EP23: refactoring the `srs-engine-v2` package to isolate the Learning phase and introducing a unified SQLite persistence layer for word states, decks, and batch history. This bridge ensures that learning progress is preserved between sessions and provides the data foundation for the Revision phase.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| ----------- | -------- | --------- |
| Phase Scoping | `src/learning/` | Isolation of learning logic from shared engine logic and future revision logic. |
| Persistence | `better-sqlite3` | Unified SQLite DB (`data/srs-v2.db`) for all phases. |
| Store Injection | Wiring Layer | `LearningRunner` (main) owns the store and injects it into the IO layer. |
| Write-on-Answer | Immediate Ops | Every result is persisted immediately to prevent progress loss. |
| Seed/Migration | Mock-Driven | First run parses `mock-decks.ts` to populate DB; fallback seeding on session start. |

## 3. Data Structures

### Unified Database Schema (`data/srs-v2.db`)

#### Table: `word_states`
- `word_id` (TEXT PK)
- `mastery` (INTEGER)
- `correct_streak` (INTEGER)
- `wrong_streak` (INTEGER)
- `lapses` (INTEGER)
- `seen` (INTEGER)
- `correct` (INTEGER)

#### Table: `decks`
- `deck_id` (TEXT PK)
- `topic` (TEXT)

#### Table: `deck_words`
- `deck_id` (TEXT)
- `word_id` (TEXT)
- PK(`deck_id`, `word_id`)

#### Table: `batch_history`
- `batch_id` (INTEGER PK AUTOINCREMENT)
- `timestamp` (TEXT)
- `word_id` (TEXT)
- `was_correct` (BOOLEAN)

## 4. Stories & Tasks

### EP23-ST01: Structural Refactor & Naming — **Complete ✅**
**Scope**: Logical isolation in `src/learning/`.
- Move `src/main.ts` → `src/learning/learning-runner.ts` (Entry Point).
- Move `src/runner/interactive.ts` → `src/learning/learning-io.ts` (IO/Orchestration).
- Move `src/runner/auto-answerer.ts` → `src/learning/auto-answerer.ts`.
- Rename `AnswerStrategy` → `AutoAnswerStrategy`.
- Extract constants to `src/learning/config.ts`.
- Update `package.json` with `learnv2` script.



