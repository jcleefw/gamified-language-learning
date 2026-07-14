import { ref, watch, type Ref } from 'vue';

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

export function useSegmentPlayer(
  el: Ref<HTMLAudioElement | null>,
  track: Ref<TextTrack | null> = ref(null),
): SegmentPlayer {
  const currentTime = ref<number>(0);
  const duration = ref<number>(0);
  const playing = ref<boolean>(false);
  const rate = ref<1 | 0.75 | 0.5>(1);
  const activeCueId = ref<string | null>(null);

  let timeUpdateListener: (() => void) | null = null;

  function clearPendingSegment() {
    if (timeUpdateListener && el.value) {
      el.value.removeEventListener('timeupdate', timeUpdateListener);
    }
    timeUpdateListener = null;
  }

  function play() {
    if (el.value) {
      el.value.play().catch(() => {
        // Playback may fail silently (e.g., autoplay policy)
      });
    }
  }

  function pause() {
    if (el.value) {
      el.value.pause();
    }
    clearPendingSegment();
  }

  function seek(t: number) {
    if (el.value) {
      // Only clamp to duration when it's a finite number. For WAV (and any file
      // the browser can't measure up front) `duration` is NaN/Infinity — the old
      // `duration || 0` collapsed that to 0, so every seek landed at the file
      // start and segments played from 0 instead of `t`.
      const dur = el.value.duration;
      const upper = Number.isFinite(dur) ? dur : t;
      el.value.currentTime = Math.max(0, Math.min(t, upper));
    }
    clearPendingSegment();
  }

  function setRate(r: 1 | 0.75 | 0.5) {
    rate.value = r;
    if (el.value) {
      el.value.playbackRate = r;
    }
    clearPendingSegment();
  }

  function playSegment(start: number, end: number) {
    clearPendingSegment();
    seek(start);

    // A `timeupdate` can fire while the seek is still in flight, with the element
    // still at its OLD position. If that old position is past `end` we'd pause
    // instantly; if we never confirm we reached the window we might not stop at
    // all. So only arm the stop once playback has actually entered [start, end).
    let entered = false;
    timeUpdateListener = () => {
      if (!el.value) return;
      const t = el.value.currentTime;
      if (t >= start && t < end) entered = true;
      if (entered && t >= end) pause();
    };

    if (el.value) {
      el.value.addEventListener('timeupdate', timeUpdateListener);
    }

    play();
  }

  // Timing is the served WebVTT track (WebVTT ADR §6). A cue's id is its
  // sentenceId; playing a sentence is playing its cue's [startTime, endTime].
  function playCue(sentenceId: string) {
    const cue = track.value?.cues?.getCueById(sentenceId) as
      | (TextTrackCue & { startTime: number; endTime: number })
      | null
      | undefined;
    if (!cue) return; // no cue for this sentence ⟹ silent no-op (playback ADR §6)
    playSegment(cue.startTime, cue.endTime);
  }

  // Bind local state to the audio element as soon as it mounts (or re-mounts,
  // since `el` can flip across a v-if). `immediate: true` covers the case where
  // the ref is already set by the time this composable runs.
  watch(
    () => el.value,
    (audio) => {
      if (!audio) return;
      audio.addEventListener('timeupdate', () => {
        currentTime.value = audio.currentTime;
      });
      audio.addEventListener('durationchange', () => {
        duration.value = audio.duration;
      });
      audio.addEventListener('play', () => {
        playing.value = true;
      });
      audio.addEventListener('pause', () => {
        playing.value = false;
      });
      audio.playbackRate = rate.value;
    },
    { immediate: true, flush: 'post' },
  );

  // The browser's subtitle engine drives "which sentence is playing" — we read
  // the first active cue's id on each cuechange, no manual currentTime math.
  watch(
    () => track.value,
    (t) => {
      if (!t) {
        activeCueId.value = null;
        return;
      }
      t.addEventListener('cuechange', () => {
        const active = t.activeCues;
        activeCueId.value = active && active.length > 0 ? active[0].id : null;
      });
    },
    { immediate: true, flush: 'post' },
  );

  return {
    currentTime,
    duration,
    playing,
    rate,
    activeCueId,
    play,
    pause,
    seek,
    setRate,
    playSegment,
    playCue,
  };
}
