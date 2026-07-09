# @gll/logger

Structured-logging port with two implementations. Libraries depend on the `Logger` interface and default to `NoopLogger`; apps inject `PinoLogger` at the composition root. `pino` never leaks past this package — swapping the transport is a change to this file alone.

## Public API

```ts
import { NoopLogger, PinoLogger } from '@gll/logger';
import type { Logger, LogContext, LogLevel, PinoLoggerOptions } from '@gll/logger';
```

- **`Logger`** — the port: `debug` / `info` / `warn` / `error` (each takes `message` + optional `LogContext`) and `child(context)`, which merges `context` into every subsequent call.
- **`NoopLogger`** — discards everything. Default for library packages and tests.
- **`PinoLogger`** — wraps `pino`. Options: `{ minLevel?, destination? }`.
- **`LogContext`** — `{ correlationId?, [key: string]: unknown }`.

## Usage

```ts
// App root:
const logger = new PinoLogger({ minLevel: 'info' });
const reqLog = logger.child({ correlationId });
reqLog.info('answer accepted', { wordId });

// Library default:
constructor(private readonly logger: Logger = new NoopLogger()) {}
```
