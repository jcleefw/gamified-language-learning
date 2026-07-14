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

  // Cancels the in-flight segment's stop-watcher (see playSegment). Not a
  // `timeupdate` listener: `timeupdate` fires too sparsely/irregularly (spec
  // "roughly 4Hz", worse in practice for some WAV encodings) to reliably catch
  // a segment crossing its `end` — observed overshoot ranged from a fraction
  // of a second to multiple seconds, occasionally running through the next
  // marker entirely (EP43-BUG01). A rAF poll checks every displayed frame instead.
  let cancelPendingSegment: (() => void) | null = null;

  function clearPendingSegment() {
    cancelPendingSegment?.();
    cancelPendingSegment = null;
  }

  function play() {
    console.log('[AUDIO] play()', { currentTime: el.value?.currentTime });
    if (el.value) {
      el.value.play().catch((err) => {
        // Playback may fail silently (e.g., autoplay policy)
        console.log('[AUDIO] play() rejected', err);
      });
    }
  }

  function pause() {
    console.log('[AUDIO] pause()', { currentTime: el.value?.currentTime });
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
      const clamped = Math.max(0, Math.min(t, upper));
      console.log('[AUDIO] seek()', { requested: t, elementDuration: dur, clamped });
      el.value.currentTime = clamped;
    }
    clearPendingSegment();
  }

  function setRate(r: 1 | 0.75 | 0.5) {
    console.log('[AUDIO] setRate()', { rate: r, hadPendingSegment: !!cancelPendingSegment });
    rate.value = r;
    if (el.value) {
      el.value.playbackRate = r;
    }
    clearPendingSegment();
  }

  function playSegment(start: number, end: number) {
    console.log('[AUDIO] playSegment()', { start, end });
    clearPendingSegment();
    seek(start);

    // The seek above may still be in flight when polling starts, with the
    // element still at its OLD position. If that old position is past `end`
    // we'd pause instantly; if we never confirm we reached the window we
    // might not stop at all. So only arm the stop once playback has actually
    // entered [start, end). Polled every animation frame (~60Hz) rather than
    // via `timeupdate` (~4Hz and irregular) so the stop can't drift past a
    // subsequent marker's entire range before catching up (EP43-BUG01).
    let entered = false;
    let rafId: number | null = null;

    function tick() {
      if (!el.value) return;
      const t = el.value.currentTime;
      if (t >= start && t < end) entered = true;
      if (entered && t >= end) {
        console.log('[AUDIO] playSegment() reached end, pausing', { t, start, end });
        pause();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    cancelPendingSegment = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    rafId = requestAnimationFrame(tick);

    play();
  }

  // Timing is the served WebVTT track (WebVTT ADR §6). A cue's id is its
  // sentenceId; playing a sentence is playing its cue's [startTime, endTime].
  function playCue(sentenceId: string) {
    const cue = track.value?.cues?.getCueById(sentenceId) as
      | (TextTrackCue & { startTime: number; endTime: number })
      | null
      | undefined;
    console.log('[AUDIO] playCue()', {
      sentenceId,
      trackLoaded: !!track.value,
      cueCount: track.value?.cues?.length ?? null,
      found: !!cue,
      startTime: cue?.startTime,
      endTime: cue?.endTime,
    });
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
        console.log('[AUDIO] durationchange', { src: audio.src, duration: audio.duration });
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
      console.log('[AUDIO] track attached', { mode: t.mode, cueCount: t.cues?.length ?? null });
      t.addEventListener('cuechange', () => {
        const active = t.activeCues;
        activeCueId.value = active && active.length > 0 ? active[0].id : null;
        console.log('[AUDIO] cuechange', { activeCueId: activeCueId.value });
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
