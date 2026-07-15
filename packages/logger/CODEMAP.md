# packages/logger CODEMAP

Package: `@gll/logger`
Purpose: Structured logging port with pluggable implementations. Libraries default to NoopLogger; apps can inject PinoLogger for production logging.

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | Logger port interface, NoopLogger (discards all logs), and PinoLogger implementation (wraps pino). |

## Core Concepts

**Logger** — Structured logging interface:
```typescript
interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}
```
- All methods accept optional `LogContext` (a dict with optional `correlationId`).
- `child()` returns a logger that merges context into all subsequent calls.

**Implementations:**

| Class | Purpose |
|---|---|
| `NoopLogger` | Default. Discards all logs. Used by libraries and tests. |
| `PinoLogger` | Wraps `pino` library. Configurable log level and destination stream. |

## Design Notes

- **Port pattern**: Logger is an interface; apps inject an implementation. Libraries reference the port without importing concrete implementations.
- **pino containment**: PinoLogger encapsulates pino; swapping the transport only requires changes to this package.
- **Context merging**: `child()` enables request-scoped logging (e.g., correlationId) without plumbing context through every function.

## Dependencies

| Package | Source | Purpose |
|---|---|---|
| pino | `pino@^9` | Structured logging library (used by PinoLogger only). |
