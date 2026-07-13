import { ref, watch, type Ref } from 'vue';

export interface SegmentPlayer {
  currentTime: Ref<number>;
  duration: Ref<number>;
  playing: Ref<boolean>;
  rate: Ref<1 | 0.75 | 0.5>;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setRate(r: 1 | 0.75 | 0.5): void;
  playSegment(start: number, end: number): void;
}

export function useSegmentPlayer(el: Ref<HTMLAudioElement | null>): SegmentPlayer {
  const currentTime = ref<number>(0);
  const duration = ref<number>(0);
  const playing = ref<boolean>(false);
  const rate = ref<1 | 0.75 | 0.5>(1);

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
      el.value.currentTime = Math.max(0, Math.min(t, el.value.duration || 0));
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

    timeUpdateListener = () => {
      if (el.value && el.value.currentTime >= end) {
        pause();
      }
    };

    if (el.value) {
      el.value.addEventListener('timeupdate', timeUpdateListener);
    }

    play();
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

  return {
    currentTime,
    duration,
    playing,
    rate,
    play,
    pause,
    seek,
    setRate,
    playSegment,
  };
}
