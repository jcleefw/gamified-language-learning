import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postAnswer } from '../useStore';

function okAnswerResponse() {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        wordState: {
          wordId: 'w1',
          seen: 1,
          correct: 1,
          mastery: 0,
          correctStreak: 1,
          wrongStreak: 0,
          lapses: 0,
        },
        graduated: false,
      },
    }),
  } as unknown as Response;
}

describe('postAnswer — x-correlation-id transport (EP40-ST05b)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(okAnswerResponse());
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = { wordId: 'w1', correct: true, latencyMs: 0, recheck: false };

  it('sends x-correlation-id when a correlation id is supplied', async () => {
    await postAnswer(req, 'cid-123');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-correlation-id']).toBe('cid-123');
  });

  it('sends no x-correlation-id when omitted (regression: request byte-unchanged)', async () => {
    await postAnswer(req);
    const [, init] = fetchMock.mock.calls[0];
    expect('x-correlation-id' in (init.headers as Record<string, string>)).toBe(false);
  });

  it('sends no x-correlation-id when the id is null or empty (not recording)', async () => {
    await postAnswer(req, null);
    await postAnswer(req, '');
    for (const [, init] of fetchMock.mock.calls) {
      expect('x-correlation-id' in (init.headers as Record<string, string>)).toBe(false);
    }
  });
});
