# @gll/srs-engine Rules

**@gll/srs-engine is a pure engine library. It has no knowledge of persistence, I/O, or deployment.**

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

## Internal module boundaries

- **`shelving/` and `review/` never import `learn/`** — except `GraduationPerformance`, a primitive snapshot the _host_ derives from `WordState` and passes in; `shelving/` and `review/` never import `WordState` itself.
- **`shelving/`'s public functions take primitives only.** `evaluateShelving`/`unshelveAll` take `string[]`/`Set<string>`/`ShelvingConfig` — never a `learn/` type.
- **`ReviewCard.schedulerData` is opaque.** Only `FsrsScheduler.ts` may read or write its internal shape (the serialized ts-fsrs `Card`). No other file — including tests — may destructure it or assert on a property inside it; treat it as an opaque blob passed through unchanged.
- **No barrel export.** `package.json` `exports` must have no bare `"."` entry — only `/learn`, `/shelving`, `/review`, and `/data/*`.
- **Sub-path purity.** Each module's `index.ts` only exports from within its own folder (plus `config/` for language settings) — never re-exports a sibling phase's internals as a shortcut.

## External consumer boundary

- Blacklist approach — every other consumer is permitted unless it's added here as a new frontend app.
- **`apps/srs-demo` may not import `@gll/srs-engine/review` directly.**. `review` scheduling is a server-side concern.
