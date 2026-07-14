<script setup lang="ts">
// EP43-BUG01 spike — NOT wired into any real screen except behind
// `env.debugMode` (dev-only). Validates whether wavesurfer.js (Web Audio
// decode, sample-accurate seeking) actually fixes the reported bug before we
// commit to rewriting useSegmentPlayer.ts/AudioPlayer.vue around it: native
// <audio> WAV seeking (both the marker stop-check AND plain scrubber dragging)
// lands at the wrong position for this deck's WAV file.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';
import { parseVtt } from '@gll/api-contract';
import type { AppDeckPayload } from '@gll/api-contract';

const props = defineProps<{ deck: AppDeckPayload }>();

const containerEl = ref<HTMLDivElement | null>(null);
const log = ref<string[]>([]);
const ready = ref(false);

function report(msg: string, data?: unknown) {
  const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
  console.log('[WS-PROTO]', line);
  log.value = [...log.value, line].slice(-40);
}

let ws: WaveSurfer | null = null;
let regions: ReturnType<typeof RegionsPlugin.create> | null = null;
const cueRegions = ref<{ id: string; start: number; end: number; native: string }[]>([]);
const duration = ref(0);
const currentTime = ref(0);

onMounted(async () => {
  if (!containerEl.value || !props.deck.audioUrl) return;

  ws = WaveSurfer.create({
    container: containerEl.value,
    waveColor: '#93c5fd',
    progressColor: '#2563eb',
    height: 80,
    url: props.deck.audioUrl,
    // Default backend is 'MediaElement' — a wrapped native <audio>, i.e. the
    // SAME imprecise seek path as the original bug. 'WebAudio' decodes into an
    // AudioBuffer and plays via AudioBufferSourceNode (sample-accurate seek +
    // a native stopAt(), no polling needed) — that's the part we're testing.
    backend: 'WebAudio',
  });
  (window as unknown as Record<string, unknown>).__ws = ws; // for manual console poking
  regions = ws.registerPlugin(RegionsPlugin.create());

  ws.on('decode', () => {
    report('decode (duration reported by wavesurfer)', { duration: ws?.getDuration() });
  });

  ws.on('play', () => report('ws "play" event fired', { isPlaying: ws?.isPlaying() }));
  ws.on('pause', () => report('ws "pause" event fired', { currentTime: ws?.getCurrentTime() }));
  ws.on('error', (err) => report('ws "error" event', { err: String(err) }));
  ws.on('timeupdate', (t) => {
    currentTime.value = t;
  });

  ws.on('ready', async () => {
    ready.value = true;
    duration.value = ws?.getDuration() ?? 0;
    if (!props.deck.vttUrl) return;
    const vttText = await fetch(props.deck.vttUrl).then((r) => r.text());
    const cues = parseVtt(vttText);
    for (const line of props.deck.lines) {
      const cue = cues[line.sentenceId];
      if (!cue) continue;
      cueRegions.value.push({ id: line.sentenceId, start: cue.start, end: cue.end, native: line.native });
      regions?.addRegion({
        id: line.sentenceId,
        start: cue.start,
        end: cue.end,
        drag: false,
        resize: false,
        color: 'rgba(37, 99, 235, 0.1)',
      });
    }
    report('regions added from VTT', { count: cueRegions.value.length });
  });

  // NOT wired to ws.pause(): ws.play(start, end) already schedules a precise
  // stop via WebAudioPlayer.stopAt(end) internally (Web-Audio-clock-scheduled,
  // not polling). A manual region-out -> pause() here was both redundant AND
  // actively wrong: region-out fires for the PREVIOUS region too, the instant
  // playback crosses that region's own end (e.g. entering cue 2 immediately
  // fires cue 1's region-out), and pausing on ANY region-out cut playback off
  // within milliseconds of starting the correct cue. Logged only, for visibility.
  regions.on('region-out', (region) => {
    report('region-out (informational only, not acted on)', { id: region.id, actualTime: ws?.getCurrentTime() });
  });
});

onBeforeUnmount(() => {
  ws?.destroy();
});

// Call ws.play() directly (not region.play()) so we can await/catch the
// Promise ourselves — region.play() only emits an internal event, so a
// rejection inside the plugin's own handler would otherwise surface as a
// silent, uncaught rejection instead of something we can log.
function playCue(sentenceId: string, start: number, end: number) {
  if (!ws) return;
  report('playCue() requested', { sentenceId, start, end });
  ws.play(start, end)
    .then(() => report('play() resolved', { isPlaying: ws?.isPlaying() }))
    .catch((err) => report('play() REJECTED', { err: String(err) }));
}

// Direct scrub test — the user's second reported symptom: dragging the plain
// scrubber lands on the wrong audio, independent of any marker/region logic.
function onScrub(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  ws?.setTime(value);
  report('scrub requested', { requested: value, actualAfterSetTime: ws?.getCurrentTime() });
}
</script>

<template>
  <div class="ws-proto">
    <h3>Wavesurfer prototype — deck {{ deck.id }}</h3>
    <div ref="containerEl" class="waveform"></div>

    <div v-if="ready" class="controls">
      <input
        type="range"
        min="0"
        :max="duration"
        :value="currentTime"
        step="0.01"
        @input="onScrub"
      />
      <span class="readout">{{ currentTime.toFixed(2) }} / {{ duration.toFixed(2) }}</span>
      <div class="cue-buttons">
        <button
          v-for="c in cueRegions"
          :key="c.id"
          type="button"
          @click="playCue(c.id, c.start, c.end)"
        >
          ▶ [{{ c.start.toFixed(2) }}–{{ c.end.toFixed(2) }}] {{ c.native }}
        </button>
      </div>
    </div>

    <pre class="log">{{ log.join('\n') }}</pre>
  </div>
</template>

<style scoped>
.ws-proto {
  max-width: 640px;
  margin: 20px auto;
  padding: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}
.waveform {
  margin: 12px 0;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.controls input[type='range'] {
  width: 100%;
}
.cue-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cue-buttons button {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-family: monospace;
  font-size: 0.85rem;
}
.log {
  margin-top: 12px;
  background: #111827;
  color: #d1fae5;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
}
</style>
