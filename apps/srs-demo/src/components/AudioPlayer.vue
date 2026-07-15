<script setup lang="ts">
import { ref, toRef } from 'vue';
import {
  useSegmentPlayer,
  type SegmentPlayer,
} from '../composables/useSegmentPlayer';

const props = withDefaults(
  defineProps<{ src: string; vttUrl?: string; showWaveform?: boolean }>(),
  {
    showWaveform: false,
  },
);

const waveformEl = ref<HTMLDivElement | null>(null);
const player = useSegmentPlayer(
  waveformEl,
  toRef(props, 'src'),
  toRef(props, 'vttUrl'),
);

const RATES = [1, 0.75, 0.5] as const;

function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '0:00.0';
  const minutes = Math.floor(t / 60);
  const seconds = t - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function togglePlay() {
  if (player.playing.value) {
    player.pause();
  } else {
    player.play();
  }
}

function onScrub(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  player.seek(value);
}

defineExpose<SegmentPlayer & { wavesurfer: typeof player.wavesurfer }>(player);
</script>

<template>
  <div class="audio-player">
    <div
      ref="waveformEl"
      class="waveform-container"
      :class="{ visible: props.showWaveform }"
    ></div>

    <div class="transport">
      <button class="btn-play" type="button" @click="togglePlay">
        {{ player.playing.value ? '⏸' : '▶' }}
      </button>

      <input
        class="scrubber"
        type="range"
        min="0"
        :max="player.duration.value || 0"
        step="0.01"
        :value="player.currentTime.value"
        @input="onScrub"
      />

      <span class="readout">
        {{ formatTime(player.currentTime.value) }} /
        {{ formatTime(player.duration.value) }}
      </span>
    </div>

    <div class="speed-control" role="group" aria-label="Playback speed">
      <button
        v-for="r in RATES"
        :key="r"
        type="button"
        class="speed-btn"
        :class="{ active: player.rate.value === r }"
        @click="player.setRate(r)"
      >
        {{ r }}×
      </button>
    </div>
  </div>
</template>

<style scoped>
.audio-player {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
}

.waveform-container {
  height: 0;
  overflow: hidden;
}

.waveform-container.visible {
  height: 80px;
  overflow: visible;
  margin-bottom: 8px;
}

.transport {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-play {
  border: none;
  background: #2563eb;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
}

.scrubber {
  flex: 1;
  min-width: 0;
}

.readout {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: #4b5563;
  flex-shrink: 0;
}

.speed-control {
  display: flex;
  gap: 4px;
}

.speed-btn {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.speed-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
  font-weight: 600;
}
</style>
