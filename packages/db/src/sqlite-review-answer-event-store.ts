import { type Logger, NoopLogger } from '@gll/logger';
import * as schema from './schema.js';
import type {
  IReviewAnswerEventStore,
  ReviewAnswerEventRecord,
} from './types/review-answer-event-store.js';
import type { DbClient } from './types/db-client.js';

export class SqliteReviewAnswerEventStore implements IReviewAnswerEventStore {
  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger = new NoopLogger(),
  ) {}

  async appendReviewAnswerEvent(record: ReviewAnswerEventRecord): Promise<void> {
    try {
      this.db
        .insert(schema.review_answer_events)
        .values({
          correlation_id: record.correlationId,
          user_id: record.userId,
          word_id: record.wordId,
          correct: record.correct,
          latency_ms: record.latencyMs,
          question_type: record.questionType,
          rating: record.rating,
          created_at: record.createdAt,
        })
        .run();
    } catch (err) {
      this.logger.error('appendReviewAnswerEvent failed', {
        correlationId: record.correlationId ?? undefined,
        wordId: record.wordId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
