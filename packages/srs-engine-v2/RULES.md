# @gll/srs-engine-v2 Rules

**@gll/srs-engine-v2 is a pure engine library. It has no knowledge of persistence, I/O, or deployment.**

## What this library IS

- Engine logic and functions (`runAdaptiveLoop`, `initAdaptiveSession`, etc.)
- Engine domain types (`RunState`, `SentenceRunState`, `WordState`, `SentenceState`, `GraduationHook`)
- Plain-function callbacks as extension points — typed against engine types only, no imported interfaces
- Test infrastructure (auto-answer strategies, scenario fixtures)

## What does NOT belong here

- Persistence interfaces or abstractions (`LearningStore` belongs in `@gll/db` — it implies a DB exists)
- Any import from `@gll/db` — dependency must never flow engine → db
- Serialization helpers — apps decide their own format
- File I/O, DB clients, migration logic
- CLI runners or application glue code
- Runtime dependencies beyond the engine itself (`dependencies` in package.json must stay empty)

## Exception: `demo/`

`demo/` contains a mock CLI runner (`learning-runner.ts`) used for manual testing and unit test scenarios. It reads/writes a local JSON file as a lightweight state shim — this is the only permitted I/O in this package. Do not extend it with real DB access; that belongs in `apps/cli-demo-db`.

## Decision rule

Callbacks are plain functions: `(state: WordState) => void`. The engine calls them; it does not define or import the interface that implements them. If you find yourself importing a type from outside the engine to describe a callback, the abstraction belongs outside.
