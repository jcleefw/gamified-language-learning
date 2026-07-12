import type { WordState, StreakThresholds } from '@gll/srs-engine-v2';

/**
 * The per-user config a transition was computed under. Owned here (not in an app) so the
 * transition record can carry it without an app→package import; the replay tool re-imports this.
 */
export interface ResolvedThresholds {
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
}

/** One append to the transition channel: the raw answer plus before/after state and the config it used. */
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
  resolvedThresholds: ResolvedThresholds;
  createdAt: string;
}

/** Append-only log of answer transitions, kept alongside (not instead of) current-state tables. */
export interface IAnswerEventStore {
  /** Append one transition record. Throws on failure (caller decides fail-open). */
  appendAnswerEvent(record: AnswerEventRecord): Promise<void>;

  /**
   * Read the transition records for the given correlation ids belonging to `userId`,
   * in application order (answer_events insertion / id ascending). Ids with no row are
   * simply absent from the result. Feeds the debug-trace artifact assembly (EP40-DS02).
   */
  getAnswerEventsByCorrelationIds(
    userId: string,
    correlationIds: string[],
  ): Promise<AnswerEventRecord[]>;

  /**
   * Read the most recent `limit` transition records for `userId`, returned in application
   * order (id ascending). Powers post-hoc debug-trace assembly (EP40): every `/api/answer`
   * persists its transition unconditionally, so a session that was never armed with a
   * recording is still recoverable from these rows (correlationId is null on un-armed rows).
   */
  getRecentAnswerEvents(userId: string, limit: number): Promise<AnswerEventRecord[]>;
}
