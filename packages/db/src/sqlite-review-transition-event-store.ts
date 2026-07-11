import { type Logger, NoopLogger } from '@gll/logger';
import * as schema from './schema.js';
import type {
  IReviewTransitionEventStore,
  ReviewTransitionEventRecord,
} from './types/review-transition-event-store.js';
import type { DbClient } from './types/db-client.js';

export class SqliteReviewTransitionEventStore
  implements IReviewTransitionEventStore
{
  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger = new NoopLogger(),
  ) {}

  async appendReviewTransitionEvent(
    record: ReviewTransitionEventRecord,
  ): Promise<void> {
    try {
      this.db
        .insert(schema.review_transition_events)
        .values({
          correlation_id: record.correlationId,
          user_id: record.userId,
          word_id: record.wordId,
          before_card: JSON.stringify(record.beforeCard),
          after_card: JSON.stringify(record.afterCard),
          created_at: record.createdAt,
        })
        .run();
    } catch (err) {
      this.logger.error('appendReviewTransitionEvent failed', {
        correlationId: record.correlationId ?? undefined,
        wordId: record.wordId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
