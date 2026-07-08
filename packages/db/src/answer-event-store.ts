import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { WordState } from '@gll/srs-engine-v2';
import { type Logger, NoopLogger } from '@gll/logger';
import * as schema from './schema.js';

type DbClient = BetterSQLite3Database<typeof schema> & {
  $client: BetterSqlite3.Database;
};

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

export class SqliteAnswerEventStore implements IAnswerEventStore {
  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger = new NoopLogger(),
  ) {}

  async appendAnswerEvent(record: AnswerEventRecord): Promise<void> {
    try {
      this.db
        .insert(schema.answer_events)
        .values({
          correlation_id: record.correlationId,
          user_id: record.userId,
          word_id: record.wordId,
          correct: record.correct,
          latency_ms: record.latencyMs,
          before_state: record.beforeState
            ? JSON.stringify(record.beforeState)
            : null,
          after_state: JSON.stringify(record.afterState),
          graduated: record.graduated,
          recheck: record.recheck,
          created_at: record.createdAt,
        })
        .run();
    } catch (err) {
      this.logger.error('appendAnswerEvent failed', {
        correlationId: record.correlationId ?? undefined,
        wordId: record.wordId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
