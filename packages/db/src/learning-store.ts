import type { WordState, RunState } from '@gll/srs-engine-v2';
import type { SentenceState, SentenceRunState } from '@gll/srs-engine-v2';
import type { ShelvedWord } from '@gll/srs-shelving';

export interface LearningStore {
  getAllWordStates(userId: string): RunState;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): SentenceRunState;
  upsertSentenceState(userId: string, state: SentenceState): void;

  /** Delete all word states, sentence states, stagnation counters, and shelved words for the given user. */
  clearUserState(userId: string): void;

  // --- Stagnation tracking ---

  /**
   * Called at batch boundary. For each active word:
   * - Reads current mastery from user_word_states
   * - Compares to last_boundary_mastery in user_deck_word_tracking
   * - If unchanged: increments stagnation_count
   * - If changed: resets stagnation_count to 0, updates last_boundary_mastery
   */
  updateStagnationCounters(userId: string, deckId: string, activeWordIds: string[]): void;

  /** Returns word IDs where stagnation_count >= threshold. */
  getStagnantWords(userId: string, deckId: string, threshold: number): string[];

  /** Resets all stagnation counters for a user+deck (called at session start). */
  resetStagnationCounters(userId: string, deckId: string): void;

  // --- Shelving ---

  getShelvedWords(userId: string, deckId: string): ShelvedWord[];
  shelveWord(userId: string, deckId: string, wordId: string, batchNum: number): void;
  unshelveWord(userId: string, deckId: string, wordId: string): void;
  unshelveAllWords(userId: string, deckId: string): void;

  close(): void;
}
