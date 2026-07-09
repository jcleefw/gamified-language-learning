# ADR: Logging Strategy — Dedicated `@gll/logger` with an Injected Logger Port

**Date**: 20260708T143342Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: Introduced by the Learning-authority epic (EP37, Phase 0); consumed thereafter by all app-layer code and the debug-trace epic
**RFC**: N/A

---

## Context

The codebase has no logging abstraction. Diagnostics are ad-hoc: `hono/logger` middleware for HTTP
request lines, and bare `console.log`/`console.error` sprinkled through app code (`server/index.ts`,
`App.vue`). The library-boundary packages avoid `console` entirely — correct for the *pure-logic*
packages (`srs-engine-v2`, `srs-review`, `srs-shelving`), where a side-effect would undermine
determinism and unit-testability.

But `@gll/db` is an **I/O package** — it touches SQLite. The failures worth diagnosing (failed
writes, constraint violations, slow/locked queries, the state-write-succeeds-but-event-append-fails
case introduced by the transition channel) all happen *inside* that layer, where a bare thrown
`Error` strips the context the caller needs. Reaching for `console` there is wrong (couples a
low-level package to a concrete sink and to stdout), and staying silent is wrong (operational
failures vanish).

EP37 also makes the server the authority for Learning transitions, which raises the value of
structured, correlated diagnostics: we want to trace an answer → transition → persistence by
`correlationId`, and the debug-trace epic builds directly on that. This is the moment to introduce a
real logger rather than defer it — the "build it in early" call.

RULES.md §4 ("No Generic Patterns / avoid just-in-case utilities") is noted and explicitly overridden
here: the need is concrete (an I/O layer that must report failures) and imminent (EP37-PH01's event
store), not hypothetical.

## Decision

Introduce a dedicated **`@gll/logger`** package exposing a small **`Logger` port** and inject it;
never let low-level packages reach for `console` directly.

**The port:**

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext { correlationId?: string; [key: string]: unknown; }

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that merges `context` into every subsequent call. */
  child(context: LogContext): Logger;
}
```

**Implementations shipped in the package:**

- `PinoLogger` — wraps [`pino`](https://github.com/pinojs/pino) behind the port. Structured JSON
  output; `child(context)` delegates to `pino.child(context)`; level maps to pino's `level`. **`pino`
  is a dependency of `@gll/logger` only** — its types never leak past the `Logger` port, so no app or
  `@gll/db` code imports pino directly. Swapping the transport later touches this one file.
- `NoopLogger` — does nothing, no dependency. **The default** injected into library packages and used
  in tests, so pure-logic purity and silent test runs are preserved.

**Why pino:** structured JSON, levels, `child()` bindings, redaction, and low-overhead async logging
out of the box — battle-tested rather than hand-rolled. Wrapping it (not exposing it) keeps the call
sites decoupled from the library.

**Injection rules:**

- I/O packages (starting with `@gll/db`) accept `logger: Logger = new NoopLogger()` (constructor
  param). They log operational detail through it and still **throw typed errors** for control flow —
  logging is diagnostics, not error handling.
- Apps (`@gll/server`, CLI, future mobile backend) construct a `PinoLogger` and inject it; routes
  create request-scoped children via `logger.child({ correlationId })`.
- Pure-logic packages (`srs-engine-v2`, `srs-review`, `srs-shelving`) take **no** logger — they stay
  side-effect-free. Their callers log.

**Boundary note:** `@gll/logger` holds only the port + implementations (no domain types), so it does
not conflict with RULES.md §"No cross-package type imports" (which governs *engine domain types*).
`@gll/db` already depends on sibling `@gll/*` packages, so the new dependency is consistent.

## Consequences

**Positive**:

- `@gll/db` can report *why* an operation failed without coupling to `console` or stdout; the app
  chooses the sink.
- Structured, `correlationId`-carrying logs align with the transition channel and give the debug-trace
  epic a ready foundation (`child({ correlationId })`).
- `NoopLogger` default keeps unit tests silent and pure-logic packages untouched.
- One consistent logging shape across server, CLI, and any future frontend backend.

**Negative**:

- A new package and a small amount of ceremony (construct + inject) versus bare `console`.
- Consciously overrides RULES.md §4's "no speculative utilities" — justified by concrete, imminent
  need, but it is a deliberate exception, not a precedent for other speculative abstractions.

**Neutral**:

- `hono/logger` middleware stays for HTTP request lines; `@gll/logger` covers application/domain
  diagnostics. The two are complementary.
- `PinoLogger` writes to stdout by default; pino transports (pretty-print in dev, file/remote in prod)
  are configured at construction in the app, behind the port — no call-site changes.
