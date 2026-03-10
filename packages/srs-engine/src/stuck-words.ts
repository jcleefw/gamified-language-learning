import type { WordState, SrsConfig } from './types.js';

export interface StuckWordsResult {
  stuck: WordState[]; // Words identified as stuck (3+ batches, no progress)
  toShelve: WordState[]; // Words to be shelved (respects max-2 cap)
  canReShelve: boolean; // true if shelved count < 2; can accept more
}

/**
 * Detects words with no mastery progress over N consecutive batches (N = config.shelveAfterBatches).
 * Returns stuck words, prioritized for shelving (respecting max-2 cap), and availability for more.
 */
export function detectStuckWords(
  wordStates: WordState[],
  config: SrsConfig,
): StuckWordsResult {
  const currentlyShelved = wordStates.filter((w) => isShelved(w));
  const stuck = wordStates.filter(
    (w) => (w.batchesSinceLastProgress ?? 0) >= config.shelveAfterBatches,
  );

  // Determine how many more words we can shelve
  const shelveCapacity = config.maxShelved - currentlyShelved.length;

  // If we can shelve more, take as many stuck words as capacity allows
  // Otherwise, take only the newest stuck word (last in array) if we have exactly reached cap
  const toShelve =
    shelveCapacity > 0
      ? stuck.slice(0, Math.min(shelveCapacity, stuck.length))
      : stuck.length > 0
        ? [stuck[stuck.length - 1]]
        : [];

  const canReShelve = currentlyShelved.length < config.maxShelved;

  return { stuck, toShelve, canReShelve };
}

/**
 * Marks a word as shelved until the specified duration elapses.
 * Returns a new immutable state with shelvedUntil timestamp.
 */
export function shelveWord(word: WordState, durationMs: number): WordState {
  return {
    ...word,
    shelvedUntil: new Date(Date.now() + durationMs),
  };
}

/**
 * Removes the shelved status from a word.
 * Returns a new immutable state with shelvedUntil cleared.
 */
export function unshelveWord(word: WordState): WordState {
  return {
    ...word,
    shelvedUntil: null,
  };
}

/**
 * Checks if a word is currently shelved (shelvedUntil is set and in the future).
 */
export function isShelved(word: WordState): boolean {
  return (
    word.shelvedUntil !== null &&
    word.shelvedUntil !== undefined &&
    Date.now() < word.shelvedUntil.getTime()
  );
}
