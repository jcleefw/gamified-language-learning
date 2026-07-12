import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useDebugRecording,
  setDownloaderForTest,
  shouldFinalizeOnNav,
  crossesPhaseOrMidQuiz,
  dumpRecentAndDownload,
} from '../useDebugRecording';

describe('useDebugRecording — session state & id issuance (EP40-ST05a)', () => {
  beforeEach(() => {
    // Singleton: reset between tests so state does not leak.
    useDebugRecording().cancel();
  });

  it('is idle until started: issuance is a no-op', () => {
    const rec = useDebugRecording();
    expect(rec.isRecording.value).toBe(false);
    expect(rec.phase.value).toBe(null);
    expect(rec.nextCorrelationId()).toBe('');
    expect(rec.currentCorrelationId()).toBe(null);
    // A no-op issue must not flip state or buffer anything.
    expect(rec.isRecording.value).toBe(false);
  });

  it('start(phase) opens a session with a sessionId and captured phase', () => {
    const rec = useDebugRecording();
    rec.start('learning');
    expect(rec.isRecording.value).toBe(true);
    expect(rec.phase.value).toBe('learning');
    expect(rec.state.value).toBe('recording');
  });

  it('issues distinct correlation ids and remembers them in serve order', () => {
    const rec = useDebugRecording();
    rec.start('learning');
    const a = rec.nextCorrelationId();
    const b = rec.nextCorrelationId();
    const c = rec.nextCorrelationId();
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).not.toBe('');
    // currentCorrelationId tracks the most recently served question.
    expect(rec.currentCorrelationId()).toBe(c);
    expect(rec.issuedIds()).toEqual([a, b, c]);
  });

  it('start() clears buffers from a prior session', () => {
    const rec = useDebugRecording();
    rec.start('learning');
    rec.nextCorrelationId();
    rec.recordAppearance({ correlationId: rec.currentCorrelationId(), kind: 'pool-selected', data: {} });
    rec.start('review');
    expect(rec.phase.value).toBe('review');
    expect(rec.issuedIds()).toEqual([]);
    expect(rec.appearanceBuffer()).toEqual([]);
    expect(rec.currentCorrelationId()).toBe(null);
  });

  it('recordAppearance is a no-op unless recording', () => {
    const rec = useDebugRecording();
    rec.recordAppearance({ correlationId: null, kind: 'shelving', data: {} });
    rec.start('learning');
    rec.recordAppearance({ correlationId: null, kind: 'shelving', data: { ids: ['a'] } });
    const buf = rec.appearanceBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0].kind).toBe('shelving');
    expect(typeof buf[0].at).toBe('string');
  });

  it('cancel() resets to idle without a session', () => {
    const rec = useDebugRecording();
    rec.start('learning');
    rec.nextCorrelationId();
    rec.cancel();
    expect(rec.isRecording.value).toBe(false);
    expect(rec.phase.value).toBe(null);
    expect(rec.state.value).toBe('idle');
    expect(rec.issuedIds()).toEqual([]);
  });
});

describe('useDebugRecording — finalizeAndDownload (EP40-ST07b)', () => {
  const fetchMock = vi.fn();
  const downloadSpy = vi.fn();

  beforeEach(() => {
    useDebugRecording().cancel();
    fetchMock.mockReset();
    downloadSpy.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setDownloaderForTest(downloadSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  const slice = {
    thresholds: {
      masteryThreshold: 2,
      streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
    },
    baseline: [],
    inputs: [
      {
        correlationId: 'c1',
        wordId: 'w1',
        correct: true,
        latencyMs: 0,
        recheck: false,
        recordedAfter: { wordId: 'w1', seen: 1, correct: 1, mastery: 0, correctStreak: 1, wrongStreak: 0, lapses: 0 },
      },
    ],
  };

  it('returns "idle" when not recording', async () => {
    const rec = useDebugRecording();
    expect(await rec.finalizeAndDownload()).toBe('idle');
  });

  it('posts the ordered issued ids, assembles a v1 artifact, downloads, resets', async () => {
    let captured: unknown;
    fetchMock.mockImplementation((_url, init) => {
      captured = JSON.parse((init as RequestInit).body as string);
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: slice }) });
    });
    const rec = useDebugRecording();
    rec.start('learning');
    const a = rec.nextCorrelationId();
    const b = rec.nextCorrelationId();
    rec.recordAppearance({ correlationId: a, kind: 'question-served', data: { wordId: 'w1' } });

    const outcome = await rec.finalizeAndDownload();
    expect(outcome).toBe('downloaded');
    expect(captured).toEqual({ correlationIds: [a, b] });
    expect(downloadSpy).toHaveBeenCalledOnce();
    expect((downloadSpy.mock.calls[0][1] as { version: number }).version).toBe(1);
    // Session reset after a successful download.
    expect(rec.isRecording.value).toBe(false);
    expect(rec.state.value).toBe('idle');
  });

  it('downloads nothing and returns "empty" on a zero-transition session', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { thresholds: null, baseline: [], inputs: [] } }),
    });
    const rec = useDebugRecording();
    rec.start('learning');
    rec.nextCorrelationId();
    expect(await rec.finalizeAndDownload()).toBe('empty');
    expect(downloadSpy).not.toHaveBeenCalled();
    expect(rec.state.value).toBe('idle');
  });
});

describe('dumpRecentAndDownload — post-hoc dump (EP40)', () => {
  const fetchMock = vi.fn();
  const downloadSpy = vi.fn();

  beforeEach(() => {
    useDebugRecording().cancel();
    fetchMock.mockReset();
    downloadSpy.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setDownloaderForTest(downloadSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  const slice = {
    thresholds: {
      masteryThreshold: 2,
      streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
    },
    baseline: [],
    inputs: [
      {
        correlationId: '',
        wordId: 'w1',
        correct: true,
        latencyMs: 0,
        recheck: false,
        recordedAfter: { wordId: 'w1', seen: 1, correct: 1, mastery: 0, correctStreak: 1, wrongStreak: 0, lapses: 0 },
      },
    ],
  };

  it('posts lastN, downloads a v1 artifact with an EMPTY appearance array', async () => {
    let captured: unknown;
    fetchMock.mockImplementation((url, init) => {
      expect(url).toBe('/api/debug/transitions-recent');
      captured = JSON.parse((init as RequestInit).body as string);
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: slice }) });
    });

    const outcome = await dumpRecentAndDownload(50);
    expect(outcome).toBe('downloaded');
    expect(captured).toEqual({ lastN: 50 });
    expect(downloadSpy).toHaveBeenCalledOnce();
    const artifact = downloadSpy.mock.calls[0][1] as {
      version: number;
      appearance: unknown[];
      meta: { phase: string; sessionId: string };
      inputs: unknown[];
    };
    expect(artifact.version).toBe(1);
    // The defining difference from an armed recording: no appearance context.
    expect(artifact.appearance).toEqual([]);
    expect(artifact.meta.phase).toBe('learning');
    expect(artifact.meta.sessionId).toMatch(/^posthoc-/);
    expect(artifact.inputs).toHaveLength(1);
  });

  it('does not touch the recorder session state (independent of arming)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: slice }) });
    const rec = useDebugRecording();
    await dumpRecentAndDownload(10);
    expect(rec.isRecording.value).toBe(false);
    expect(rec.state.value).toBe('idle');
  });

  it('returns "empty" and downloads nothing when there are no recent transitions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { thresholds: null, baseline: [], inputs: [] } }),
    });
    expect(await dumpRecentAndDownload()).toBe('empty');
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('throws on a non-ok response so the caller can surface an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(dumpRecentAndDownload()).rejects.toThrow();
    expect(downloadSpy).not.toHaveBeenCalled();
  });
});

describe('crossesPhaseOrMidQuiz — nav-confirm trigger, recording-agnostic (EP40-ST08 generalized)', () => {
  it('triggers on a Learning↔Review crossing regardless of recording', () => {
    expect(crossesPhaseOrMidQuiz('learning', 'review', false)).toBe(true);
    expect(crossesPhaseOrMidQuiz('review', 'learning', false)).toBe(true);
  });

  it('triggers when mid-quiz, even within the same phase', () => {
    expect(crossesPhaseOrMidQuiz('learning', 'learning', true)).toBe(true);
  });

  it('does not trigger on a same-phase nav outside a quiz', () => {
    expect(crossesPhaseOrMidQuiz('learning', 'learning', false)).toBe(false);
  });

  it('a null fromPhase (e.g. home) never crosses on its own', () => {
    expect(crossesPhaseOrMidQuiz(null, 'learning', false)).toBe(false);
    expect(crossesPhaseOrMidQuiz(null, 'review', false)).toBe(false);
  });
});

describe('shouldFinalizeOnNav — recorder finalize decision (EP40-ST08)', () => {
  it('never finalizes when not recording, regardless of the trigger condition', () => {
    expect(shouldFinalizeOnNav(false, 'learning', 'review', true)).toBe(false);
    expect(shouldFinalizeOnNav(false, null, 'learning', true)).toBe(false);
  });

  it('finalizes when the target crosses the Learning↔Review boundary', () => {
    expect(shouldFinalizeOnNav(true, 'learning', 'review', false)).toBe(true);
    expect(shouldFinalizeOnNav(true, 'review', 'learning', false)).toBe(true);
  });

  it('finalizes when leaving an in-progress quiz batch, even within the same phase', () => {
    expect(shouldFinalizeOnNav(true, 'learning', 'learning', true)).toBe(true);
  });

  it('does not finalize a same-phase navigation outside a quiz', () => {
    expect(shouldFinalizeOnNav(true, 'learning', 'learning', false)).toBe(false);
  });
});
