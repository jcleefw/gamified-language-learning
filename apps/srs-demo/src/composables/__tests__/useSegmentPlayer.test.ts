import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useSegmentPlayer } from '../useSegmentPlayer';

/**
 * A minimal fake HTMLAudioElement: enough surface for useSegmentPlayer to
 * drive playback, expose currentTime, and dispatch 'timeupdate'/'play'/'pause'
 * to registered listeners. Real <audio> element behaviour (actual decoding,
 * real time progression) is out of scope for a unit test — the ADR's segment
 * contract (seek→play→pause-at-end) is what's under test here.
 */
function makeFakeAudio() {
  const listeners: Record<string, Array<() => void>> = {};
  const audio = {
    currentTime: 0,
    duration: 100,
    playbackRate: 1,
    paused: true,
    addEventListener(type: string, cb: () => void) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type: string, cb: () => void) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    },
    play: vi.fn(async function (this: typeof audio) {
      this.paused = false;
      fire('play');
    }),
    pause: vi.fn(function (this: typeof audio) {
      this.paused = true;
      fire('pause');
    }),
    fire(type: string) {
      for (const l of listeners[type] ?? []) l();
    },
  };
  function fire(type: string) {
    audio.fire(type);
  }
  return audio;
}

type FakeAudio = ReturnType<typeof makeFakeAudio>;

describe('useSegmentPlayer — segment playback (playback ADR §4)', () => {
  it('playSegment seeks to start, plays, and pauses within one frame of end', () => {
    const audio = makeFakeAudio();
    const el = ref(audio as unknown as HTMLAudioElement);
    const player = useSegmentPlayer(el);

    player.playSegment(1.0, 2.0);

    expect(audio.currentTime).toBe(1.0);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.paused).toBe(false);

    // Simulate timeupdate ticks approaching but not reaching the end.
    audio.currentTime = 1.5;
    audio.fire('timeupdate');
    expect(audio.pause).not.toHaveBeenCalled();

    // Reaches end.
    audio.currentTime = 2.0;
    audio.fire('timeupdate');
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.paused).toBe(true);
  });

  it('the active rate persists across play/pause and speed control sets playbackRate', () => {
    const audio = makeFakeAudio();
    const el = ref(audio as unknown as HTMLAudioElement);
    const player = useSegmentPlayer(el);

    player.setRate(0.5);
    expect(audio.playbackRate).toBe(0.5);
    expect(player.rate.value).toBe(0.5);

    player.play();
    player.pause();
    expect(player.rate.value).toBe(0.5);
    expect(audio.playbackRate).toBe(0.5);
  });

  it('seeking or changing rate mid-segment disarms the pending auto-pause', () => {
    const audio = makeFakeAudio();
    const el = ref(audio as unknown as HTMLAudioElement);
    const player = useSegmentPlayer(el);

    player.playSegment(1.0, 2.0);

    // Scrub away mid-segment.
    player.seek(5.0);
    (audio.pause as ReturnType<typeof vi.fn>).mockClear();

    // Even if currentTime later reaches the old "end", the stale listener
    // must not fire — it was torn down by seek().
    audio.currentTime = 2.0;
    audio.fire('timeupdate');
    expect(audio.pause).not.toHaveBeenCalled();
  });

  it('changing rate mid-segment also disarms the pending auto-pause', () => {
    const audio = makeFakeAudio();
    const el = ref(audio as unknown as HTMLAudioElement);
    const player = useSegmentPlayer(el);

    player.playSegment(1.0, 2.0);
    player.setRate(0.75);
    (audio.pause as ReturnType<typeof vi.fn>).mockClear();

    audio.currentTime = 2.0;
    audio.fire('timeupdate');
    expect(audio.pause).not.toHaveBeenCalled();
  });
});
