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

### EP23-ST02: Unified WordStore & Schema
**Scope**: SQLite implementation and initial migration.
- Implement `SrsStore` class in `src/persistence/srs-store.ts`.
- Implement `Schema` management (CREATE TABLE IF NOT EXISTS).
- Implement **Migration Logic**: On first start, parse `data/mock/mock-decks.ts` and `mock-word-pool.ts`. Insert into `decks` and `deck_words`.

### EP23-ST03: Session Seeding & Wiring
**Scope**: Progress persistence and write-on-answer.
- Inject `SrsStore` into `learning-runner.ts`.
- **Session Seed**: Before starting the interactive loop, check `word_states` for all words in the selected deck. Insert missing words with 0 mastery.
- Update `learning-io.ts` to fetch and update states from `SrsStore` instead of in-memory `Map`.

### EP23-ST04: Batch History & Truncation Tooling
**Scope**: Analytics and testing tools.
- Log every answer to `batch_history`.
- Implement `src/scripts/db-ops.ts`:
    - `pnpm db:clear`: Calls `DROP TABLE` on all tables.
    - `pnpm db:seed`: Repopulates `decks` and mandatory consonants.

## 5. Success Criteria

1. `pnpm learnv2` picks up exactly where the previous run left off (persisted mastery).
2. Clean folder structure under `src/learning/`.
3. `data/srs-v2.db` correctly contains tables and data after a run.
4. `pnpm db:clear` successfully resets the environment.
5. No dangling imports or type errors.
