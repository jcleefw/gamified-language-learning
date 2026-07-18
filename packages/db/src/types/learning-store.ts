import type { WordState, RunState } from '@gll/srs-engine-v2/learn';
import type { SentenceState, SentenceRunState } from '@gll/srs-engine-v2/learn';
import type { ShelvedWord } from '@gll/srs-engine-v2/shelving';

/** Per-user Learning-phase state: word/sentence progress, stagnation tracking, and shelving. */
export interface ILearningStore {
  getAllWordStates(userId: string): Promise<RunState>;
  upsertWordState(userId: string, state: WordState): Promise<void>;

  getAllSentenceStates(userId: string): Promise<SentenceRunState>;
  upsertSentenceState(userId: string, state: SentenceState): Promise<void>;

  /** Delete all word states, sentence states, stagnation counters, and shelved words for the given user. */
  clearUserState(userId: string): Promise<void>;

  // --- Stagnation tracking ---

  /**
   * Called at batch boundary. For each active word:
   * - Reads current mastery from user_word_states
   * - Compares to last_boundary_mastery in user_deck_word_tracking
   * - If unchanged: increments stagnation_count
   * - If changed: resets stagnation_count to 0, updates last_boundary_mastery
   */
  updateStagnationCounters(userId: string, deckId: string, activeWordIds: string[]): Promise<void>;

  /** Returns word IDs where stagnation_count >= threshold. */
  getStagnantWords(userId: string, deckId: string, threshold: number): Promise<string[]>;

  /** Resets all stagnation counters for a user+deck (called at session start). */
  resetStagnationCounters(userId: string, deckId: string): Promise<void>;

  /** Resets stagnation counters for specific word IDs only (called on manual unshelve). */
  resetStagnationCountersForWords(userId: string, deckId: string, wordIds: string[]): Promise<void>;

  // --- Shelving ---

  getShelvedWords(userId: string, deckId: string): Promise<ShelvedWord[]>;
  shelveWord(userId: string, deckId: string, wordId: string, batchNum: number): Promise<void>;
  unshelveWord(userId: string, deckId: string, wordId: string): Promise<void>;
  unshelveAllWords(userId: string, deckId: string): Promise<void>;

  close(): Promise<void>;
}
