import { getDb, SqliteLearningStore, SqliteReviewStore } from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2';
import type { BuiltScenario } from './scenario-builder.js';

/**
 * Write a built scenario to the DB: clear the user's existing learner state + review
 * cards, then insert the scenario's word states and review cards. Shared by the HTTP
 * scenario route and the seed CLI so both seed identically.
 */
export async function applyBuiltScenario(
  built: BuiltScenario,
  deps: { db: ReturnType<typeof getDb>; userId: string },
): Promise<void> {
  const { db, userId } = deps;
  const store = new SqliteLearningStore(db);
  const reviewStore = new SqliteReviewStore(db);

  // Clear all learner state (word states, shelving, stagnation via clearUserState)…
  await store.clearUserState(userId);
  // …and review cards (clearUserState does not own this table).
  db.$client.prepare('DELETE FROM review_cards WHERE user_id = ?').run(userId);

  for (const ws of built.wordStates) {
    const wordState: WordState = { ...ws };
    await store.upsertWordState(userId, wordState);
  }
  for (const card of built.reviewCards) {
    await reviewStore.upsertReviewCard(userId, card);
  }
}
