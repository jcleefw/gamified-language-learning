import type { WordState } from '@gll/srs-engine-v2';

/** One append to the transition channel: the raw answer plus before/after state. */
export interface AnswerEventRecord {
  correlationId: string | null;
  userId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  beforeState: WordState | null;
  afterState: WordState;
  graduated: boolean;
  recheck: boolean;
  createdAt: string;
}

export interface IAnswerEventStore {
  /** Append one transition record. Throws on failure (caller decides fail-open). */
  appendAnswerEvent(record: AnswerEventRecord): Promise<void>;
}
