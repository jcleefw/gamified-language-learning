import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useSegmentPlayer } from '../useSegmentPlayer';

/**
 * Fake WaveSurfer instance: enough surface for useSegmentPlayer to drive
 * playback and dispatch the events it listens to. `WaveSurfer.create` is
 * mocked to always return the same instance so a test can grab it via
 * `getLastInstance()` and dispatch events / assert calls.
 */
function makeFakeWaveSurfer() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const instance = {
    currentTime: 0,
    duration: 0,
    on: vi.fn((type: string, cb: (...args: unknown[]) => void) => {
      (listeners[type] ??= []).push(cb);
    }),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    setTime: vi.fn((t: number) => {
      instance.currentTime = t;
    }),
    setPlaybackRate: vi.fn(),
    getDuration: vi.fn(() => instance.duration),
    getCurrentTime: vi.fn(() => instance.currentTime),
    load: vi.fn(),
    destroy: vi.fn(),
    fire(type: string, ...args: unknown[]) {
      for (const l of listeners[type] ?? []) l(...args);
    },
  };
  return instance;
}

type FakeWaveSurfer = ReturnType<typeof makeFakeWaveSurfer>;

let lastInstance: FakeWaveSurfer | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createMock = vi.fn((config: unknown) => {
  lastInstance = makeFakeWaveSurfer();
  return lastInstance;
});

vi.mock('wavesurfer.js', () => ({
  default: { create: (config: unknown) => createMock(config) },
}));

vi.mock('@gll/shared-utils', () => ({
  parseVtt: (text: string) => JSON.parse(text) as Record<string, { start: number; end: number }>,
}));

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubFetch(vttResponse: Record<string, { start: number; end: number }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ text: async () => JSON.stringify(vttResponse) })),
  );
}

beforeEach(() => {
  lastInstance = null;
  createMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useSegmentPlayer — wavesurfer.js backend (wavesurfer.js Pivot ADR)', () => {
  it('creates a WaveSurfer instance with the WebAudio backend once the container mounts', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    useSegmentPlayer(container, src);

    expect(createMock).toHaveBeenCalledOnce();
    const args = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args.backend).toBe('WebAudio');
    expect(args.container).toBe(container.value);
    expect(args.url).toBe(src.value);
  });

  it('play/pause delegate to the wavesurfer instance', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const player = useSegmentPlayer(container, src);

    player.play();
    expect(lastInstance!.play).toHaveBeenCalledWith();

    player.pause();
    expect(lastInstance!.pause).toHaveBeenCalledOnce();
  });

  it('seek calls ws.setTime', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const player = useSegmentPlayer(container, src);

    player.seek(5.5);
    expect(lastInstance!.setTime).toHaveBeenCalledWith(5.5);
  });

  it('setRate calls ws.setPlaybackRate with preservePitch=true and updates rate', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const player = useSegmentPlayer(container, src);

    player.setRate(0.75);
    expect(lastInstance!.setPlaybackRate).toHaveBeenCalledWith(0.75, true);
    expect(player.rate.value).toBe(0.75);
  });

  it('playSegment calls ws.play(start, end) with no polling', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const player = useSegmentPlayer(container, src);

    player.playSegment(1.0, 2.0);
    expect(lastInstance!.play).toHaveBeenCalledWith(1.0, 2.0);
  });

  it('playCue resolves the sentence id via parsed VTT cues and plays that segment', async () => {
    stubFetch({ S1: { start: 1.0, end: 2.0 }, S2: { start: 2.0, end: 3.5 } });
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const vttUrl = ref<string | undefined>('https://example.com/deck.vtt');
    const player = useSegmentPlayer(container, src, vttUrl);

    // cues load asynchronously (fetch + parseVtt)
    await flushPromises();

    player.playCue('S2');
    expect(lastInstance!.play).toHaveBeenCalledWith(2.0, 3.5);
  });

  it('playCue no-ops silently for an unknown sentence id', async () => {
    stubFetch({ S1: { start: 1.0, end: 2.0 } });
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const vttUrl = ref<string | undefined>('https://example.com/deck.vtt');
    const player = useSegmentPlayer(container, src, vttUrl);

    await flushPromises();

    player.playCue('unknown');
    expect(lastInstance!.play).not.toHaveBeenCalled();
  });

  it('currentTime/duration/playing update from wavesurfer events', () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const player = useSegmentPlayer(container, src);

    lastInstance!.duration = 42;
    lastInstance!.fire('ready');
    expect(player.duration.value).toBe(42);

    lastInstance!.fire('timeupdate', 3.14);
    expect(player.currentTime.value).toBe(3.14);

    lastInstance!.fire('play');
    expect(player.playing.value).toBe(true);

    lastInstance!.fire('pause');
    expect(player.playing.value).toBe(false);
  });

  it('activeCueId reflects the cue containing currentTime on timeupdate, or null', async () => {
    stubFetch({ S1: { start: 0, end: 2 }, S2: { start: 2, end: 4 } });
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/audio.wav');
    const vttUrl = ref<string | undefined>('https://example.com/deck.vtt');
    const player = useSegmentPlayer(container, src, vttUrl);

    await flushPromises();

    lastInstance!.fire('timeupdate', 1.0);
    expect(player.activeCueId.value).toBe('S1');

    lastInstance!.fire('timeupdate', 2.5);
    expect(player.activeCueId.value).toBe('S2');

    lastInstance!.fire('timeupdate', 10);
    expect(player.activeCueId.value).toBeNull();
  });

  it('changing src loads the new source into the existing wavesurfer instance', async () => {
    const container = ref<HTMLElement | null>({} as HTMLElement);
    const src = ref('https://example.com/a.wav');
    useSegmentPlayer(container, src);

    src.value = 'https://example.com/b.wav';
    await Promise.resolve();

    expect(lastInstance!.load).toHaveBeenCalledWith('https://example.com/b.wav');
    expect(createMock).toHaveBeenCalledOnce();
  });
});
