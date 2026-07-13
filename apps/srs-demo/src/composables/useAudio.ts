import type { AppDeckPayload } from '@gll/api-contract';

// Playback ADR §5 — the engine and questions stay pure text; the Vue client
// resolves sentenceId → audio from the deck payload it already holds.
export interface SentenceAudio {
  url: string;
  start: number;
  end: number;
}

/**
 * Finds the line by sentenceId across decks; returns null unless the deck has
 * audioUrl AND the line has BOTH audioStart and audioEnd (a half-marker ⟹ null).
 * Absent ⟹ no control (playback ADR §6 silent degrade).
 */
export function resolveSentenceAudio(
  decks: AppDeckPayload[],
  sentenceId: string,
): SentenceAudio | null {
  for (const deck of decks) {
    if (!deck.audioUrl) continue;
    const line = deck.lines.find((l) => l.sentenceId === sentenceId);
    if (!line) continue;
    if (line.audioStart === undefined || line.audioEnd === undefined) return null;
    return { url: deck.audioUrl, start: line.audioStart, end: line.audioEnd };
  }
  return null;
}
