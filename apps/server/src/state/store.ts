import type { WordState } from '@gll/srs-engine';

export interface WordDetail {
  native: string;
  romanization: string;
  english: string;
  category: 'foundational' | 'curated';
}

export const deckId: string = crypto.randomUUID();
console.log(`[GLL] Deck ID: ${deckId}`);

export let wordStates: WordState[] = [];
export const wordDetails = new Map<string, WordDetail>();

export function seedStore(
  states: WordState[],
  details: Map<string, WordDetail>,
): void {
  wordStates = states;
  wordDetails.clear();
  for (const [key, value] of details) {
    wordDetails.set(key, value);
  }
}

export function setWordStates(states: WordState[]): void {
  wordStates = states;
}
