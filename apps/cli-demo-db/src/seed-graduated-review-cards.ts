import type { RunState } from '@gll/srs-engine-v2';
import type { ReviewScheduler } from '@gll/srs-review';
import type { ReviewStore } from '@gll/db';
import { toGraduationPerformance } from './graduation-performance.js';

/**
 * ST06: for each graduated word, derive its GraduationPerformance from the final
 * WordState, seed a ReviewCard via the scheduler, and persist it (write-on-graduation).
 * Words absent from runState are skipped.
 */
export async function seedGraduatedReviewCards(
  graduatedWordIds: string[],
  runState: RunState,
  scheduler: ReviewScheduler,
  reviewStore: ReviewStore,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  for (const wordId of graduatedWordIds) {
    const ws = runState.get(wordId);
    if (!ws) continue;
    const card = scheduler.seed(wordId, toGraduationPerformance(ws), now);
    await reviewStore.upsertReviewCard(userId, card);
  }
}
