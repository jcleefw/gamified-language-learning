// @gll/logger — Logger port + implementations.
import { pino, type Logger as PinoInstance, type DestinationStream } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

/** Structured logging port. Apps inject an implementation; libraries default to NoopLogger. */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that merges `context` into every subsequent call. */
  child(context: LogContext): Logger;
}

/** Discards everything. The default for library packages and tests. */
export class NoopLogger implements Logger {
  debug(_message: string, _context?: LogContext): void {}
  info(_message: string, _context?: LogContext): void {}
  warn(_message: string, _context?: LogContext): void {}
  error(_message: string, _context?: LogContext): void {}
  child(_context: LogContext): Logger {
    return new NoopLogger();
  }
}

export interface PinoLoggerOptions {
  minLevel?: LogLevel;
  destination?: DestinationStream;
}

/**
 * Wraps `pino` behind the Logger port. `pino` never leaks past this class.
 * Swapping the transport is a change to this file alone.
 */
export class PinoLogger implements Logger {
  private readonly logger: PinoInstance;

  constructor(options: PinoLoggerOptions = {}, existing?: PinoInstance) {
    this.logger =
      existing ?? pino({ level: options.minLevel ?? 'info' }, options.destination);
  }

  debug(message: string, context?: LogContext): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.emit('error', message, context);
  }

  child(context: LogContext): Logger {
    return new PinoLogger({}, this.logger.child(context));
  }

  private emit(level: LogLevel, message: string, context?: LogContext): void {
    if (context) {
      this.logger[level](context, message);
    } else {
      this.logger[level](message);
    }
  }
}
