import './env.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getDb, closeDb, SqliteReviewStore } from '@gll/db';
import type { IReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-engine-v2/review';
import type { ReviewScheduler } from '@gll/srs-engine-v2/review';
import { buildQuizItems } from './db-query.js';
import type { DbClient } from './db-tools.js';

/** How many real curriculum words the CLI seeder turns into due-now cards. */
export const MOCK_REVIEW_COUNT = 3;

const MOCK_PERFORMANCE = { correctStreak: 3, lapses: 0, correctRatio: 1 };

/**
 * ST09: seed the given word ids as review cards, then force their `due` to `now`
 * so the runner presents them immediately. `schedulerData` from `seed` is left intact
 * so `FsrsScheduler.schedule` accepts the cards. Ids must be real curriculum words for
 * the runner to build a question — the CLI script derives them from the DB.
 */
export async function seedMockReviews(
  scheduler: ReviewScheduler,
  reviewStore: IReviewStore,
  userId: string,
  wordIds: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  for (const wordId of wordIds) {
    const seeded = scheduler.seed(wordId, MOCK_PERFORMANCE, now);
    await reviewStore.upsertReviewCard(userId, { ...seeded, due: now });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const DB_PATH = process.env.GLL_DB_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../../.data/learning-state.db');
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const CLI_USER_ID = 'cli-user';

  const db = getDb(DB_PATH) as DbClient;
  const reviewStore = new SqliteReviewStore(db);
  const scheduler = new FsrsScheduler();

  const wordIds = buildQuizItems(db).slice(0, MOCK_REVIEW_COUNT).map((w) => w.id);
  if (wordIds.length === 0) {
    console.error('[ERROR] No curriculum words found — run engine:import-curriculum first.');
    closeDb();
    process.exit(1);
  }

  await seedMockReviews(scheduler, reviewStore, CLI_USER_ID, wordIds);
  console.log(`[INFO] Seeded ${String(wordIds.length)} due-now mock review card(s) for ${CLI_USER_ID}: ${wordIds.join(', ')}`);

  closeDb();
}
