import { type Logger, NoopLogger } from '@gll/logger';
import * as schema from './schema.js';
import type {
  IAnswerEventStore,
  AnswerEventRecord,
} from './types/answer-event-store.js';
import type { DbClient } from './types/db-client.js';

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
          resolved_thresholds: JSON.stringify(record.resolvedThresholds),
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
