import type { AppDeckPayload } from '@gll/api-contract';

// Playback ADR §5 — the engine and questions stay pure text; the Vue client
// resolves a sentence's DECK audio from the payload it already holds. Timing is
// the served VTT track (WebVTT ADR §6): the player targets the sentence by cue
// id via playCue(sentenceId), so we only need the deck's audioUrl + vttUrl here.
export interface DeckAudio {
  audioUrl: string;
  vttUrl: string;
}

/**
 * Finds the deck containing sentenceId; returns its { audioUrl, vttUrl } only
 * when the deck has BOTH (i.e. is segmentable). A deck with no vttUrl has no
 * per-sentence timing ⟹ null (no control; playback ADR §6 silent degrade).
 */
export function resolveSentenceAudio(
  decks: AppDeckPayload[],
  sentenceId: string,
): DeckAudio | null {
  for (const deck of decks) {
    if (!deck.audioUrl || !deck.vttUrl) continue;
    if (deck.lines.some((l) => l.sentenceId === sentenceId)) {
      return { audioUrl: deck.audioUrl, vttUrl: deck.vttUrl };
    }
  }
  return null;
}
