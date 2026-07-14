<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';
import AudioPlayer from './AudioPlayer.vue';
import {
  useMarkerAuthoring,
  NUDGE_COARSE,
  NUDGE_FINE,
} from '../composables/useMarkerAuthoring';
import { commitDeckVtt, fetchDeckVtt } from '../composables/useStore';

// EP43-DS02 ST04 — curator marker-authoring screen. Env-gated by env.curationMode
// in App.vue (same gate as CurateAudio); never in a production build. Reuses the
// boot-time decks list and EP43-DS01's shared AudioPlayer. Capture per-sentence
// [start,end] off the play-head, nudge with the keyboard, preview via the
// player's playSegment, then COMMIT as WebVTT through the gated server endpoint
// (writes the audio.vtt DB column + the durable bucket .vtt). VTT-in / VTT-out.
const props = defineProps<{ decks: AppDeckPayload[] }>();
const emit = defineEmits<{ back: []; committed: [] }>();

const selectedDeckId = ref<string>('');
const deck = computed(
  () => props.decks.find((d) => d.id === selectedDeckId.value) ?? null,
);
const markable = computed(() => !!deck.value?.audioUrl);

// The VTT is stamped with the audio binary's content hash (WebVTT ADR §4). The
// hash is the stem of the content-addressed audio key, readable from audioUrl.
const audioSha256 = computed(
  () => deck.value?.audioUrl?.match(/\/([0-9a-f]+)\.(?:mp3|wav)$/)?.[1] ?? '',
);

const player = ref<InstanceType<typeof AudioPlayer> | null>(null);
const authoring = useMarkerAuthoring();
const status = ref<{ kind: 'ok' | 'error'; message: string } | null>(null);

// EP43-ST07 — the waveform augments the table, it doesn't replace it: one
// draggable Region per fully-marked sentence, two-way synced with
// `authoring.markers` (the single source of truth). AudioPlayer.vue stays
// curator-agnostic — it exposes the raw WaveSurfer instance but never
// imports Regions itself; this component owns all Regions wiring.
let regions: ReturnType<typeof RegionsPlugin.create> | null = null;

watch(
  () => player.value?.wavesurfer,
  (ws) => {
    if (!ws || regions) return;
    regions = ws.registerPlugin(RegionsPlugin.create());
    // Dragging a region calls the SAME setters the table's Set In/Out
    // buttons call — one source of truth, no separate drag-state model.
    // setOut may auto-populate the NEXT row's start (ST07 UX improvement).
    regions.on('region-updated', (region) => {
      authoring.setIn(region.id, region.start);
      authoring.setOut(region.id, region.end);
    });
    regions.on('region-clicked', (region) => {
      player.value?.playSegment(region.start, region.end);
    });
    syncRegions();
  },
);

// Reconciles regions from `authoring.markers`: one Region per complete row,
// updated via `setOptions()` (not remove+recreate, so an in-progress drag
// isn't fought) — confirmed against the installed Regions plugin that
// `setOptions()` never re-emits `region-updated` (it only fires from a
// region's own drag/resize `update-end`), so this can't loop.
function syncRegions() {
  if (!regions) return;
  const currentIds = new Set(Object.keys(authoring.markers.value));
  for (const region of regions.getRegions()) {
    if (!currentIds.has(region.id) || !authoring.isComplete(region.id)) {
      region.remove();
    }
  }
  for (const [sentenceId, draft] of Object.entries(authoring.markers.value)) {
    if (!authoring.isComplete(sentenceId)) continue;
    const existing = regions.getRegions().find((r) => r.id === sentenceId);
    if (existing) {
      existing.setOptions({ start: draft.start!, end: draft.end! });
    } else {
      regions.addRegion({
        id: sentenceId,
        start: draft.start!,
        end: draft.end!,
        drag: true,
        resize: true,
      });
    }
  }
}

watch(() => authoring.markers.value, syncRegions, { deep: true });

async function onSelectDeck() {
  status.value = null;
  const d = deck.value;
  if (!d) return;
  const sentenceIds = d.lines.map((l) => l.sentenceId);
  // Hydrate from an existing committed VTT so the curator fine-tunes rather than
  // re-marks from scratch.
  const existing = d.vttUrl ? await fetchDeckVtt(d.id).catch(() => null) : null;
  authoring.seed(sentenceIds, existing ?? undefined);
}

function setIn(sentenceId: string) {
  if (player.value) authoring.setIn(sentenceId, player.value.currentTime);
}

function setOut(sentenceId: string) {
  if (player.value) authoring.setOut(sentenceId, player.value.currentTime);
}

// Keyboard nudge on a focused marker field (PRD §4.1): ←/→ ±0.05s, Shift+←/→
// ±0.01s. preventDefault so the arrows nudge the marker rather than the caret.
function onNudge(sentenceId: string, edge: 'start' | 'end', e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const step = e.shiftKey ? NUDGE_FINE : NUDGE_COARSE;
  authoring.nudge(sentenceId, edge, e.key === 'ArrowRight' ? step : -step);
}

function reset() {
  if (!deck.value) return;
  // Discards uncommitted work — confirm before clearing every captured marker.
  if (!window.confirm('Clear all markers for this deck? Uncommitted changes are lost.')) return;
  authoring.seed(deck.value.lines.map((l) => l.sentenceId));
  status.value = null;
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

async function commit() {
  if (!deck.value) return;
  status.value = null;
  const vtt = authoring.buildVtt(audioSha256.value);
  try {
    await commitDeckVtt(deck.value.id, vtt);
    status.value = { kind: 'ok', message: '✓ Committed — learners now hear these segments.' };
    // Refresh App.vue's deck list so the new vttUrl propagates without reload.
    emit('committed');
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message };
  }
}

function download() {
  if (!deck.value) return;
  const vtt = authoring.buildVtt(audioSha256.value);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.value.id}.vtt`;
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
      <strong>commit</strong> — the timing is saved as a WebVTT track bound to
      this deck's audio and served to learners.
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
      <!-- EP43-ST08: action row sits directly above the waveform, right-aligned,
           all three buttons the same fixed size regardless of label length. -->
      <div class="actions">
        <button class="btn-action btn-primary" @click="commit">Commit</button>
        <button class="btn-action" @click="download">Download .vtt</button>
        <button class="btn-action btn-reset" @click="reset">Reset</button>
      </div>

      <AudioPlayer ref="player" :src="deck.audioUrl!" :show-waveform="true" />

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

      <p
        v-if="status"
        class="status"
        :class="status.kind === 'error' ? 'error' : 'ok'"
        role="status"
      >
        {{ status.message }}
      </p>
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
.btn-reset {
  color: #991b1b;
  border-color: #fecaca;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
/* EP43-ST08: one fixed size for the action row regardless of label length —
   .btn-primary/.btn-reset above only vary color, not dimensions. */
.btn-action {
  width: 140px;
  padding: 10px 0;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  font: inherit;
  font-size: 0.9rem;
  text-align: center;
  cursor: pointer;
}
.btn-action.btn-primary {
  border: none;
  background: #2563eb;
  color: white;
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
.status.ok {
  background: #f0fdf4;
  color: #166534;
}
</style>
