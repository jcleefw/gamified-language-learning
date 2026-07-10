import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postAnswer, postReviewAnswer } from '../useStore';
import {
  getTraceSession,
  __resetTraceSessionForTests,
  type ApiChannelData,
} from '../useTraceSession';

// EP40-ST03: the two answer fetches record an `api` TraceEntry — method/path/
// status/ok, and `error` on non-ok or throw — keyed by the correlation id, only
// while a trace session is active. Control flow (throw on failure) is unchanged.

function okJson(data: unknown): Response {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) } as unknown as Response;
}
function failResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

const wordState = {
  wordId: 'w1', seen: 1, correct: 1, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetTraceSessionForTests();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const apiEntries = () =>
  getTraceSession().session.value!.entries.filter((e) => e.channel === 'api');

describe('API channel', () => {
  it('records one api entry for a traced answer, keyed by correlation id', async () => {
    fetchMock.mockResolvedValue(okJson({ wordState, graduated: false }));
    getTraceSession().start();

    await postAnswer({ wordId: 'w1', correct: true, latencyMs: 0 }, 'corr-1');

    const entries = apiEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].correlationId).toBe('corr-1');
    const data = entries[0].data as ApiChannelData;
    expect(data).toMatchObject({ method: 'POST', path: '/api/answer', status: 200, ok: true });
  });

  it('records an entry with error populated on a non-ok response, and still throws', async () => {
    fetchMock.mockResolvedValue(failResponse(500));
    getTraceSession().start();

    await expect(
      postReviewAnswer({ wordId: 'w1', correct: true, latencyMs: 0, questionType: 'mcq' }, 'corr-2'),
    ).rejects.toThrow();

    const entries = apiEntries();
    expect(entries).toHaveLength(1);
    const data = entries[0].data as ApiChannelData;
    expect(data.ok).toBe(false);
    expect(data.status).toBe(500);
    expect(data.error).toBeTruthy();
  });

  it('records an entry with error on a network throw, and rethrows', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    getTraceSession().start();

    await expect(
      postAnswer({ wordId: 'w1', correct: true, latencyMs: 0 }, 'corr-3'),
    ).rejects.toThrow('network down');

    const entries = apiEntries();
    expect(entries).toHaveLength(1);
    expect((entries[0].data as ApiChannelData).error).toBe('network down');
  });

  it('records nothing while the session is inactive (fail-open passthrough)', async () => {
    fetchMock.mockResolvedValue(okJson({ wordState, graduated: false }));
    // no start()
    await postAnswer({ wordId: 'w1', correct: true, latencyMs: 0 }, 'corr-4');
    expect(getTraceSession().session.value).toBeNull();
  });
});
