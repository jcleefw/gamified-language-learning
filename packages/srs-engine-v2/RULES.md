# @gll/srs-engine-v2 Rules

**@gll/srs-engine-v2 is a library package, not an application. Do NOT add application-layer code.**

## Do NOT Add

- ❌ Serialization helpers (`serialiseRunState`, `deserialiseRunState`, etc.) — app decides serialization format (JSON, MessagePack, etc.)
- ❌ Database implementations (`SqliteLearningStore` impl, `initDb`, migrations, Drizzle config) — belongs in `@gll/db`
- ❌ Application runners and CLI tools (`learning-runner-db.ts`, `db-tools.ts`, `db-fixtures.ts`) — belongs in `@gll/db`
- ❌ File I/O operations beyond test infrastructure — reading/writing DB files, state persistence
- ❌ External dependencies for application concerns — `better-sqlite3` belongs in `@gll/db`, not here

## Library-Owned Code

✅ Engine logic, types, and functions (`RunState`, `runAdaptiveLoop`, etc.)
✅ Domain abstractions (`LearningStore` interface only — no implementation)
✅ Callbacks as extension points (`onWordAnswer`, `onSentenceAnswer`, `onGraduation`)
✅ Test infrastructure and mocks

## Decision Test

**"Would another application using this library need this code?"**
- YES → library-level, keep it
- NO → application-level, move to `@gll/db`
