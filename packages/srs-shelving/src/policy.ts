import type { ShelvingConfig, ShelvingDecision } from './types.js';

/**
 * Evaluates which stagnant words should be shelved given the current shelving
 * state and config constraints.
 *
 * - Filters out candidates already in `currentlyShelved` (no re-shelving).
 * - Respects `config.maxShelved` cap — only fills available slots.
 * - Preserves input order when capping candidates.
 * - `toUnshelve` is always empty (unshelving is handled separately).
 *
 * @param stagnantWordIds  - word IDs detected as stagnant
 * @param currentlyShelved - set of word IDs currently on the shelf
 * @param config           - shelving configuration
 */
export function evaluateShelving(
  stagnantWordIds: string[],
  currentlyShelved: Set<string>,
  config: ShelvingConfig,
): ShelvingDecision {
  const availableSlots = config.maxShelved - currentlyShelved.size;

  if (availableSlots <= 0) {
    return { toShelve: [], toUnshelve: [] };
  }

  const candidates = stagnantWordIds.filter((id) => !currentlyShelved.has(id));
  const toShelve = candidates.slice(0, availableSlots);

  return { toShelve, toUnshelve: [] };
}

/**
 * Returns an empty set, representing the result of unshelving all words.
 * The caller is responsible for applying this to their shelved state.
 */
export function unshelveAll(): Set<string> {
  return new Set<string>();
}
