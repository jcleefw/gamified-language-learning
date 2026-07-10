import { describe, it, expect } from 'vitest';
import { useTraceSession, type TraceEntry } from '../useTraceSession';

const entry = (o: Partial<Omit<TraceEntry, 'at'>> = {}): Omit<TraceEntry, 'at'> => ({
  correlationId: 'c1',
  channel: 'appearance',
  data: { kind: 'question-served', detail: {} },
  ...o,
});

describe('useTraceSession', () => {
  it('records nothing while inactive (before start)', () => {
    const t = useTraceSession();
    expect(t.active.value).toBe(false);
    t.record(entry());
    expect(t.session.value).toBeNull();
  });

  it('records nothing after stop', () => {
    const t = useTraceSession();
    t.start();
    t.stop();
    t.record(entry());
    expect(t.session.value!.entries).toHaveLength(0);
  });

  it('buffers entries recorded between start and stop, exposed on stop', () => {
    const t = useTraceSession();
    t.start();
    t.record(entry({ correlationId: 'c1' }));
    t.record(entry({ correlationId: 'c2', channel: 'api' }));
    const stopped = t.stop();
    expect(stopped!.active).toBe(false);
    expect(stopped!.stoppedAt).toBeTruthy();
    expect(stopped!.entries).toHaveLength(2);
    expect(stopped!.entries.map((e) => e.channel)).toEqual(['appearance', 'api']);
  });

  it('exposes the ordered, de-duplicated set of observed correlation ids', () => {
    const t = useTraceSession();
    t.start();
    t.record(entry({ correlationId: 'c1' }));
    t.record(entry({ correlationId: 'c1' })); // dup — same question, e.g. recheck
    t.record(entry({ correlationId: 'c2' }));
    const stopped = t.stop();
    expect(stopped!.correlationIds).toEqual(['c1', 'c2']);
  });

  it('stamps every entry with an ISO timestamp', () => {
    const t = useTraceSession();
    t.start();
    t.record(entry());
    const at = t.session.value!.entries[0].at;
    expect(new Date(at).toISOString()).toBe(at);
  });

  it('a null-correlation entry is buffered but adds no correlation id', () => {
    const t = useTraceSession();
    t.start();
    t.record(entry({ correlationId: null }));
    const s = t.session.value!;
    expect(s.entries).toHaveLength(1);
    expect(s.correlationIds).toEqual([]);
  });

  it('start after a stopped session begins a fresh empty buffer', () => {
    const t = useTraceSession();
    t.start();
    t.record(entry());
    t.stop();
    const first = t.session.value!.sessionId;
    t.start();
    expect(t.session.value!.sessionId).not.toBe(first);
    expect(t.session.value!.entries).toHaveLength(0);
    expect(t.active.value).toBe(true);
  });
});

describe('exportSession', () => {
  it('returns null when no session exists', () => {
    expect(useTraceSession().exportSession()).toBeNull();
  });

  it('orders entries by `at` and excludes transition entries', () => {
    const t = useTraceSession();
    t.start();
    t.record({ correlationId: 'c1', channel: 'appearance', at: '2026-07-10T00:00:03.000Z', data: {} });
    t.record({ correlationId: 'c1', channel: 'api', at: '2026-07-10T00:00:01.000Z', data: {} });
    t.record({ correlationId: 'c1', channel: 'transition', at: '2026-07-10T00:00:02.000Z', data: {} });
    t.stop();

    const exp = t.exportSession()!;
    expect(exp.entries.map((e) => e.channel)).toEqual(['api', 'appearance']); // sorted; transition dropped
    expect(exp.correlationIds).toEqual(['c1']);
    expect(exp.stoppedAt).toBeTruthy();
  });
});
