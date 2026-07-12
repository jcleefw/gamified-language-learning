import { and, eq, inArray, asc } from 'drizzle-orm';
import { type Logger, NoopLogger } from '@gll/logger';
import * as schema from './schema.js';
import type { WordState } from '@gll/srs-engine-v2';
import type {
  IAnswerEventStore,
  AnswerEventRecord,
  ResolvedThresholds,
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

  async getAnswerEventsByCorrelationIds(
    userId: string,
    correlationIds: string[],
  ): Promise<AnswerEventRecord[]> {
    if (correlationIds.length === 0) return [];
    const rows = this.db
      .select()
      .from(schema.answer_events)
      .where(
        and(
          eq(schema.answer_events.user_id, userId),
          inArray(schema.answer_events.correlation_id, correlationIds),
        ),
      )
      .orderBy(asc(schema.answer_events.id))
      .all();

    return rows.map((row) => ({
      correlationId: row.correlation_id,
      userId: row.user_id,
      wordId: row.word_id,
      correct: row.correct,
      latencyMs: row.latency_ms,
      beforeState: row.before_state
        ? (JSON.parse(row.before_state) as WordState)
        : null,
      afterState: JSON.parse(row.after_state) as WordState,
      graduated: row.graduated,
      recheck: row.recheck,
      resolvedThresholds: JSON.parse(row.resolved_thresholds) as ResolvedThresholds,
      createdAt: row.created_at,
    }));
  }
}
