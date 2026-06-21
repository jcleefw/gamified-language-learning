import type { WordState, RunState } from '@gll/srs-engine-v2';
import type { SentenceState, SentenceRunState } from '@gll/srs-engine-v2';

export interface LearningStore {
  getAllWordStates(userId: string): RunState;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): SentenceRunState;
  upsertSentenceState(userId: string, state: SentenceState): void;

  close(): void;
}
