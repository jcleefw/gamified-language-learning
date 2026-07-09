import { describe, it, expect } from 'vitest';
import { NoopLogger, PinoLogger } from '../index';

/** Collects each pino JSON line written to the destination. */
function capture(): { stream: { write(s: string): void }; lines: Array<Record<string, unknown>> } {
  const lines: Array<Record<string, unknown>> = [];
  return {
    stream: {
      write: (s: string) => {
        lines.push(JSON.parse(s) as Record<string, unknown>);
      },
    },
    lines,
  };
}

describe('NoopLogger', () => {
  it('is a no-op: every method does not throw', () => {
    const log = new NoopLogger();
    expect(() => {
      log.debug('msg');
      log.info('msg');
      log.warn('msg');
      log.error('msg', { correlationId: 'c1' });
    }).not.toThrow();
  });

  it('child() returns a NoopLogger', () => {
    const log = new NoopLogger();
    expect(log.child({ correlationId: 'c1' })).toBeInstanceOf(NoopLogger);
  });
});

describe('PinoLogger', () => {
  it('respects minLevel: warn suppresses debug/info, emits warn/error', () => {
    const { stream, lines } = capture();
    const log = new PinoLogger({ minLevel: 'warn', destination: stream });

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(lines.map((l) => l.msg)).toEqual(['w', 'e']);
  });

  it('child(context) stamps that context on every subsequent record', () => {
    const { stream, lines } = capture();
    const log = new PinoLogger({ minLevel: 'info', destination: stream }).child({
      correlationId: 'abc',
    });

    log.info('one');
    log.warn('two');

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.correlationId)).toEqual(['abc', 'abc']);
    expect(lines.map((l) => l.msg)).toEqual(['one', 'two']);
  });
});
