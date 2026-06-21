---
name: srs-engine-v2-library-boundary
description: SRS Engine v2 is a library, not an application. Enforce clean separation.
metadata:
  type: feedback
---

## Rule: SRS Engine v2 Library Boundary

**@gll/srs-engine-v2 must remain DB-agnostic and application-layer free.**

### What BELONGS in srs-engine-v2:
- ✅ Engine types (`RunState`, `SentenceRunState`, `WordState`, `SentenceState`)
- ✅ Engine functions (`runAdaptiveLoop`, `initAdaptiveSession`, etc.)
- ✅ `LearningStore` interface definition (domain-owned abstraction)
- ✅ Callbacks passed to engine functions (`onWordAnswer`, `onSentenceAnswer`, `onGraduation`) — engine is a callable library
- ✅ Minimal type signatures for persistence intent (e.g., `LearningStore` methods)

### What does NOT belong in srs-engine-v2:
- ❌ Serialization helpers (`serialiseRunState`, `deserialiseRunState`, etc.) — these are app-layer glue code, not engine concerns
- ❌ DB implementation details (`SqliteLearningStore` implementation wiring, Drizzle integration)
- ❌ Application runners (`learning-runner-db.ts`, `db-tools.ts`, `db-fixtures.ts`) — these belong in a CLI or separate package
- ❌ Migration logic, DB initialization, schema management — these are @gll/db responsibilities
- ❌ File system operations beyond minimal test infrastructure

### Rationale:

**Why**:
- A library is used by applications. Applications own glue code (serialization, file I/O, DB setup).
- Serialization is inherently app-specific: JSON? MessagePack? Custom binary? Library shouldn't force a choice.
- `demo/` runners can be minimal examples, but production CLI/app runners belong outside the library.

**How to apply**:
- When adding to srs-engine-v2, ask: "Would another app using this library need this code?"
  - If no → move it to @gll/db or the CLI package
  - If yes → it's library-level, keep it
- `LearningStore` interface is OK because apps can implement it. `SqliteLearningStore` implementation belongs in @gll/db.
- Callbacks are OK because they're the app's hook to inject its own logic.

**Previous violation (EP30-ST03)**:
- Serialization helpers were proposed for `src/persistence/serialise.ts`
- This was caught and rejected
- Correct approach: keep serialization in @gll/db or the CLI runner, not in the library
