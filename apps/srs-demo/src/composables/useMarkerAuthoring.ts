import { ref, type Ref } from 'vue';
import type { AppLinePayload, DeckMarkerMap } from '@gll/api-contract';

// EP43-DS02 ST04 — the marker-authoring state, extracted from the view so the
// capture / seed / validity / export logic is unit-testable without a DOM (the
// repo tests composables, not .vue files). MarkAudio.vue is the thin shell that
// wires the shared AudioPlayer's live `currentTime` into these operations.

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
// so an exported/round-tripped marker is stable and byte-identical on re-apply.
function quantize(t: number): number {
  return Math.round(t * 100) / 100;
}

export interface MarkerAuthoring {
  /** sentenceId → draft; reactive so the view rows stay live. */
  markers: Ref<Record<string, MarkerDraft>>;
  /** Reset every row from the deck's lines, pre-filling any existing markers. */
  seed(lines: AppLinePayload[]): void;
  /** Capture the play-head into a row's in/out (quantised, clamped ≥ 0). */
  setIn(sentenceId: string, time: number): void;
  setOut(sentenceId: string, time: number): void;
  /** Nudge one edge by `delta` seconds (clamped ≥ 0); no-op if edge unset. */
  nudge(sentenceId: string, edge: 'start' | 'end', delta: number): void;
  /** A row is exportable iff both edges are set and `end > start`. */
  isComplete(sentenceId: string): boolean;
  /** Build the hand-off map from the complete, valid rows only. */
  buildMap(deckId: string): DeckMarkerMap;
}

export function useMarkerAuthoring(): MarkerAuthoring {
  const markers = ref<Record<string, MarkerDraft>>({});

  function seed(lines: AppLinePayload[]): void {
    const next: Record<string, MarkerDraft> = {};
    for (const line of lines) {
      next[line.sentenceId] = {
        start: line.audioStart ?? null,
        end: line.audioEnd ?? null,
      };
    }
    markers.value = next;
  }

  function setIn(sentenceId: string, time: number): void {
    const draft = markers.value[sentenceId];
    if (draft) draft.start = quantize(Math.max(0, time));
  }

  function setOut(sentenceId: string, time: number): void {
    const draft = markers.value[sentenceId];
    if (draft) draft.end = quantize(Math.max(0, time));
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

  function buildMap(deckId: string): DeckMarkerMap {
    const out: DeckMarkerMap['markers'] = {};
    for (const [sentenceId, draft] of Object.entries(markers.value)) {
      if (draft.start !== null && draft.end !== null && draft.end > draft.start) {
        out[sentenceId] = { start: draft.start, end: draft.end };
      }
    }
    return { deckId, markers: out };
  }

  return { markers, seed, setIn, setOut, nudge, isComplete, buildMap };
}
