<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import AudioPlayer from './AudioPlayer.vue';
import {
  useMarkerAuthoring,
  NUDGE_COARSE,
  NUDGE_FINE,
} from '../composables/useMarkerAuthoring';

// EP43-DS02 ST04 — curator marker-authoring screen. Env-gated by env.curatorMode
// in App.vue (same gate as CurateAudio); never in a production build. Reuses the
// boot-time decks list and EP43-DS01's shared AudioPlayer — no new fetch, no
// server write. Capture per-sentence [start,end] off the play-head, nudge with
// the keyboard, preview via the player's playSegment, then export a JSON marker
// map that `apply-markers` (ST05) ingests into decks.doc.sentences[].
const props = defineProps<{ decks: AppDeckPayload[] }>();
const emit = defineEmits<{ back: [] }>();

const selectedDeckId = ref<string>('');
const deck = computed(
  () => props.decks.find((d) => d.id === selectedDeckId.value) ?? null,
);
const markable = computed(() => !!deck.value?.audioUrl);

const player = ref<InstanceType<typeof AudioPlayer> | null>(null);
const authoring = useMarkerAuthoring();

function onSelectDeck() {
  authoring.seed(deck.value?.lines ?? []);
}

function setIn(sentenceId: string) {
  if (player.value) authoring.setIn(sentenceId, player.value.currentTime.value);
}

function setOut(sentenceId: string) {
  if (player.value) authoring.setOut(sentenceId, player.value.currentTime.value);
}

// Keyboard nudge on a focused marker field (PRD §4.1): ←/→ ±0.05s, Shift+←/→
// ±0.01s. preventDefault so the arrows nudge the marker rather than the caret.
function onNudge(sentenceId: string, edge: 'start' | 'end', e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const step = e.shiftKey ? NUDGE_FINE : NUDGE_COARSE;
  authoring.nudge(sentenceId, edge, e.key === 'ArrowRight' ? step : -step);
}

function preview(sentenceId: string) {
  const draft = authoring.markers.value[sentenceId];
  if (player.value && draft && draft.start !== null && draft.end !== null) {
    player.value.playSegment(draft.start, draft.end);
  }
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

function exportMarkers() {
  if (!deck.value) return;
  const map = authoring.buildMap(deck.value.id);
  const blob = new Blob([JSON.stringify(map, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.value.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="mark-audio">
    <button class="btn-back" @click="emit('back')">← Back</button>
    <h1>Mark Deck Audio</h1>
    <p class="hint">
      Capture each sentence's <code>[start, end]</code> from the play-head, then
      export a marker map for <code>apply-markers</code> to ingest.
    </p>

    <label class="field">
      <span>Deck</span>
      <select v-model="selectedDeckId" @change="onSelectDeck">
        <option value="" disabled>Choose a deck…</option>
        <option v-for="d in props.decks" :key="d.id" :value="d.id">
          {{ d.topic }}
        </option>
      </select>
    </label>

    <p v-if="deck && !markable" class="status error" role="status">
      This deck has no audio. Curate this deck's audio first (Curate audio →).
    </p>

    <template v-if="deck && markable">
      <AudioPlayer ref="player" :src="deck.audioUrl!" />

      <table class="lines">
        <thead>
          <tr>
            <th>Sentence</th>
            <th>In</th>
            <th>Out</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="line in deck.lines"
            :key="line.sentenceId"
            :class="{ complete: authoring.isComplete(line.sentenceId) }"
          >
            <td class="sentence">
              <div class="native">{{ line.native }}</div>
              <div class="roman">{{ line.romanization }}</div>
              <div class="english">{{ line.english }}</div>
            </td>
            <td class="marker">
              <span
                class="value"
                tabindex="0"
                @keydown="onNudge(line.sentenceId, 'start', $event)"
                >{{ fmt(authoring.markers.value[line.sentenceId]?.start ?? null) }}</span
              >
              <button class="btn-sm" @click="setIn(line.sentenceId)">Set In</button>
            </td>
            <td class="marker">
              <span
                class="value"
                tabindex="0"
                @keydown="onNudge(line.sentenceId, 'end', $event)"
                >{{ fmt(authoring.markers.value[line.sentenceId]?.end ?? null) }}</span
              >
              <button class="btn-sm" @click="setOut(line.sentenceId)">Set Out</button>
            </td>
            <td>
              <button
                class="btn-sm"
                :disabled="!authoring.isComplete(line.sentenceId)"
                @click="preview(line.sentenceId)"
              >
                Preview
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <button class="btn-primary" @click="exportMarkers">Export markers</button>
    </template>
  </div>
</template>

<style scoped>
.mark-audio {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: sans-serif;
}
.btn-back {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
}
.hint {
  color: #6b7280;
  font-size: 0.9rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 16px 0;
}
.field > span {
  font-weight: 600;
  color: #374151;
}
.field select {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}
.lines {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 0.9rem;
}
.lines th,
.lines td {
  border-bottom: 1px solid #e5e7eb;
  padding: 8px;
  text-align: left;
  vertical-align: top;
}
.lines tr.complete {
  background: #f0fdf4;
}
.sentence .native {
  font-weight: 600;
}
.sentence .roman,
.sentence .english {
  color: #6b7280;
  font-size: 0.85rem;
}
.marker .value {
  display: inline-block;
  min-width: 3.5em;
  font-variant-numeric: tabular-nums;
  padding: 2px 4px;
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  margin-right: 6px;
  cursor: text;
}
.marker .value:focus {
  outline: 2px solid #2563eb;
  border-style: solid;
}
.btn-sm {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: white;
  font: inherit;
  cursor: pointer;
}
.status {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}
.status.error {
  background: #fef2f2;
  color: #991b1b;
}
</style>
