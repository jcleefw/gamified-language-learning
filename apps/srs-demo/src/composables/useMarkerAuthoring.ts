import { ref, type Ref } from 'vue';
import { buildVtt as buildVttText, parseVtt } from '@gll/api-contract';

// EP43-DS02 ST04 — the marker-authoring state, extracted from the view so the
// capture / seed / validity / VTT-emit logic is unit-testable without a DOM (the
// repo tests composables, not .vue files). MarkAudio.vue is the thin shell that
// wires the shared AudioPlayer's live `currentTime` into these operations. The
// component is VTT-in / VTT-out at its edges (WebVTT ADR §7): it hydrates from an
// existing VTT and emits a VTT bound to the audio binary by a sha256 stamp.

/** A row's in/out draft; `null` = that edge is not yet captured. */
export interface MarkerDraft {
  start: number | null;
  end: number | null;
}

/** Keyboard-nudge granularities (PRD §4.1): coarse ±0.05s, fine ±0.01s. */
export const NUDGE_COARSE = 0.05;
export const NUDGE_FINE = 0.01;

// Markers are seconds-float; capture off the play-head and repeated nudges both
// accumulate binary-float noise. Quantise to the centisecond the readout shows
// so an emitted/round-tripped marker is stable.
function quantize(t: number): number {
  return Math.round(t * 100) / 100;
}

export interface MarkerAuthoring {
  /** sentenceId → draft; reactive so the view rows stay live. */
  markers: Ref<Record<string, MarkerDraft>>;
  /** Reset every row from the deck's sentence ids, hydrating any existing VTT cues. */
  seed(sentenceIds: string[], existingVtt?: string): void;
  /** Capture the play-head into a row's in/out (quantised, clamped ≥ 0). */
  setIn(sentenceId: string, time: number): void;
  setOut(sentenceId: string, time: number): void;
  /** Nudge one edge by `delta` seconds (clamped ≥ 0); no-op if edge unset. */
  nudge(sentenceId: string, edge: 'start' | 'end', delta: number): void;
  /** A row is exportable iff both edges are set and `end > start`. */
  isComplete(sentenceId: string): boolean;
  /** Emit WebVTT (cue-ID = sentenceId, `NOTE audio-sha256` stamp) from complete rows only. */
  buildVtt(audioSha256: string): string;
}

export function useMarkerAuthoring(): MarkerAuthoring {
  const markers = ref<Record<string, MarkerDraft>>({});
  let order: string[] = [];

  function seed(sentenceIds: string[], existingVtt?: string): void {
    const parsed = existingVtt ? parseVtt(existingVtt) : {};
    const next: Record<string, MarkerDraft> = {};
    for (const sentenceId of sentenceIds) {
      const cue = parsed[sentenceId];
      next[sentenceId] = {
        start: cue ? quantize(cue.start) : null,
        end: cue ? quantize(cue.end) : null,
      };
    }
    markers.value = next;
    order = sentenceIds;
  }

  function setIn(sentenceId: string, time: number): void {
    const draft = markers.value[sentenceId];
    if (draft) draft.start = quantize(Math.max(0, time));
  }

  // EP43-ST07 marker-UX improvement: today's toil is clicking the same
  // play-head point twice (sentence N's out, then N+1's in). Pre-fill N+1's
  // start from N's committed end — but only if it's still unset, so the
  // curator's own edits are never silently clobbered.
  function setOut(sentenceId: string, time: number): void {
    const draft = markers.value[sentenceId];
    if (!draft) return;
    const quantized = quantize(Math.max(0, time));
    draft.end = quantized;

    const nextId = order[order.indexOf(sentenceId) + 1];
    const nextDraft = nextId ? markers.value[nextId] : undefined;
    if (nextDraft && nextDraft.start === null) {
      nextDraft.start = quantized;
    }
  }

  function nudge(sentenceId: string, edge: 'start' | 'end', delta: number): void {
    const draft = markers.value[sentenceId];
    if (!draft || draft[edge] === null) return;
    draft[edge] = quantize(Math.max(0, draft[edge]! + delta));
  }

  function isComplete(sentenceId: string): boolean {
    const draft = markers.value[sentenceId];
    return (
      !!draft &&
      draft.start !== null &&
      draft.end !== null &&
      draft.end > draft.start
    );
  }

  function buildVtt(audioSha256: string): string {
    const cues = Object.entries(markers.value)
      .filter(([, d]) => d.start !== null && d.end !== null && d.end > d.start)
      .map(([id, d]) => ({ id, start: d.start!, end: d.end! }));
    return buildVttText(cues, audioSha256);
  }

  return { markers, seed, setIn, setOut, nudge, isComplete, buildVtt };
}
