import { ref, shallowRef, watch, type Ref } from 'vue';
import WaveSurfer from 'wavesurfer.js';
import { parseVtt } from '@gll/shared-utils';

export interface SegmentPlayer {
  currentTime: Ref<number>;
  duration: Ref<number>;
  playing: Ref<boolean>;
  rate: Ref<1 | 0.75 | 0.5>;
  /** The id of the WebVTT cue currently under the play-head (= sentenceId), or null. */
  activeCueId: Ref<string | null>;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setRate(r: 1 | 0.75 | 0.5): void;
  /** Seek→play→pause-at-end over an arbitrary range (draft preview / marker tool). */
  playSegment(start: number, end: number): void;
  /** Play the VTT cue whose id === sentenceId (seek→play→pause at cue end). No-op if absent. */
  playCue(sentenceId: string): void;
}

interface Cue {
  id: string;
  start: number;
  end: number;
}

export function useSegmentPlayer(
  container: Ref<HTMLElement | null>,
  src: Ref<string>,
  vttUrl?: Ref<string | undefined>,
): SegmentPlayer & { wavesurfer: Ref<WaveSurfer | null> } {
  const currentTime = ref<number>(0);
  const duration = ref<number>(0);
  const playing = ref<boolean>(false);
  const rate = ref<1 | 0.75 | 0.5>(1);
  const activeCueId = ref<string | null>(null);
  const wavesurfer = shallowRef<WaveSurfer | null>(null);
  const cues = ref<Cue[]>([]);

  function play() {
    void wavesurfer.value?.play();
  }

  function pause() {
    wavesurfer.value?.pause();
  }

  function seek(t: number) {
    wavesurfer.value?.setTime(t);
  }

  function setRate(r: 1 | 0.75 | 0.5) {
    rate.value = r;
    wavesurfer.value?.setPlaybackRate(r, true);
  }

  // wavesurfer's WebAudio backend schedules its own precise stop
  // (WebAudioPlayer.stopAt(end), Web-Audio-clock-scheduled) — no polling
  // needed (EP43-BUG01 is fixed structurally by the backend, not by a
  // tighter poll interval; see the wavesurfer.js Pivot ADR).
  function playSegment(start: number, end: number) {
    void wavesurfer.value?.play(start, end);
  }

  // Timing is the served WebVTT track (WebVTT ADR §6, amended by the
  // wavesurfer.js Pivot ADR §2: parsed manually since there's no <audio>
  // element for a native <track> to attach to).
  function playCue(sentenceId: string) {
    const cue = cues.value.find((c) => c.id === sentenceId);
    if (!cue) return; // no cue for this sentence ⟹ silent no-op (playback ADR §6)
    playSegment(cue.start, cue.end);
  }

  watch(
    () => container.value,
    (el) => {
      if (!el || wavesurfer.value) return;
      const ws = WaveSurfer.create({
        container: el,
        url: src.value,
        backend: 'WebAudio',
      });
      wavesurfer.value = ws;

      ws.on('ready', () => {
        duration.value = ws.getDuration();
      });
      ws.on('timeupdate', (t: number) => {
        currentTime.value = t;
        const active = cues.value.find((c) => t >= c.start && t < c.end);
        activeCueId.value = active?.id ?? null;
      });
      ws.on('play', () => {
        playing.value = true;
      });
      ws.on('pause', () => {
        playing.value = false;
      });
    },
    { immediate: true, flush: 'post' },
  );

  watch(
    () => src.value,
    (newSrc) => {
      void wavesurfer.value?.load(newSrc);
    },
  );

  if (vttUrl) {
    watch(
      () => vttUrl.value,
      async (url) => {
        if (!url) {
          cues.value = [];
          return;
        }
        const text = await fetch(url).then((r) => r.text());
        const parsed = parseVtt(text);
        cues.value = Object.entries(parsed).map(([id, { start, end }]) => ({ id, start, end }));
      },
      { immediate: true },
    );
  }

  return {
    currentTime,
    duration,
    playing,
    rate,
    activeCueId,
    wavesurfer,
    play,
    pause,
    seek,
    setRate,
    playSegment,
    playCue,
  };
}
