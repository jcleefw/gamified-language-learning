import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postAnswer, postReviewAnswer } from '../useStore';

// EP40-ST01: both answer POSTs carry `x-correlation-id` as a header (a transport
// concern) when an id is supplied, and omit it entirely when absent.

function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  } as unknown as Response;
}

function headersOf(call: unknown[]): Record<string, string> {
  const init = call[1] as RequestInit;
  return init.headers as Record<string, string>;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postAnswer correlation header', () => {
  const wordState = {
    wordId: 'w1',
    seen: 1,
    correct: 1,
    mastery: 1,
    correctStreak: 1,
    wrongStreak: 0,
    lapses: 0,
  };

  it('sets x-correlation-id when an id is supplied', async () => {
    fetchMock.mockResolvedValue(okJson({ wordState, graduated: false }));
    await postAnswer({ wordId: 'w1', correct: true, latencyMs: 0 }, 'corr-abc');
    expect(headersOf(fetchMock.mock.calls[0])['x-correlation-id']).toBe('corr-abc');
  });

  it('omits the header when no id is supplied', async () => {
    fetchMock.mockResolvedValue(okJson({ wordState, graduated: false }));
    await postAnswer({ wordId: 'w1', correct: true, latencyMs: 0 });
    expect(headersOf(fetchMock.mock.calls[0])).not.toHaveProperty('x-correlation-id');
  });
});

describe('postReviewAnswer correlation header', () => {
  const resp = { wordId: 'w1', due: '2026-07-20T00:00:00.000Z', advanced: true };

  it('sets x-correlation-id when an id is supplied', async () => {
    fetchMock.mockResolvedValue(okJson(resp));
    await postReviewAnswer(
      { wordId: 'w1', correct: true, latencyMs: 100, questionType: 'mcq' },
      'corr-rev',
    );
    expect(headersOf(fetchMock.mock.calls[0])['x-correlation-id']).toBe('corr-rev');
  });

  it('omits the header when no id is supplied', async () => {
    fetchMock.mockResolvedValue(okJson(resp));
    await postReviewAnswer({ wordId: 'w1', correct: true, latencyMs: 100, questionType: 'mcq' });
    expect(headersOf(fetchMock.mock.calls[0])).not.toHaveProperty('x-correlation-id');
  });
});
