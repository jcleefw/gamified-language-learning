import type { WordState, RunState } from '../types/word-state.js';
import type { SentenceState, SentenceRunState } from '../types/sentence-state.js';

export interface LearningStore {
  getAllWordStates(userId: string): RunState;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): SentenceRunState;
  upsertSentenceState(userId: string, state: SentenceState): void;

  close(): void;
}
