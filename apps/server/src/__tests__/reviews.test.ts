import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler, type ReviewCard } from '@gll/srs-review';
import type {
  ApiResponse,
  DueReviewsResponse,
  ReviewAnswerResponse,
} from '@gll/api-contract';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

beforeEach(() => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  testDb = drizzle(sqlite, { schema }) as TestDb;
});

const { default: app } = await import('../app.js');

const USER_ID = 'demo-user';
const scheduler = new FsrsScheduler();

/** Seed a review card directly into the store, `due` offset by `dueOffsetMs` from now. */
async function seedCard(wordId: string, dueOffsetMs: number): Promise<ReviewCard> {
  const now = new Date();
  // Build a real FSRS card, then override its due for deterministic ordering/filtering.
  const seeded = scheduler.seed(
    wordId,
    { correctStreak: 3, lapses: 0, correctRatio: 1 },
    now,
  );
  const card: ReviewCard = {
    ...seeded,
    due: new Date(now.getTime() + dueOffsetMs),
  };
  await new SqliteReviewStore(testDb).upsertReviewCard(USER_ID, card);
  return card;
}

async function getReviews(): Promise<Response> {
  return app.request('/api/reviews', { method: 'GET' });
}

async function postAnswer(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request('/api/reviews/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('GET /api/reviews', () => {
  it('returns past-due cards and omits not-yet-due ones', async () => {
    await seedCard('past', -60_000);
    await seedCard('future', 60 * 60_000);

    const res = await getReviews();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.reviews.map((r) => r.wordId)).toEqual(['past']);
  });

  it('returns due cards most-overdue-first', async () => {
    await seedCard('recent', -1_000);
    await seedCard('oldest', -100_000);
    await seedCard('middle', -50_000);

    const res = await getReviews();
    const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.reviews.map((r) => r.wordId)).toEqual([
      'oldest',
      'middle',
      'recent',
    ]);
  });

  it('tolerates an orphaned card (no word row) without crashing', async () => {
    await seedCard('orphan', -1_000); // no words table entry needed; route does no word lookup
    const res = await getReviews();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.reviews.map((r) => r.wordId)).toEqual(['orphan']);
  });

  it('serialises `due` as an ISO string', async () => {
    await seedCard('w', -1_000);
    const res = await getReviews();
    const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
    if (!body.success) throw new Error('expected success');
    const due = body.data.reviews[0].due;
    expect(typeof due).toBe('string');
    expect(new Date(due).toISOString()).toBe(due);
  });
});

describe('POST /api/reviews/answer', () => {
  it('advances a correct answer with rating "good" and persists it (write-on-answer)', async () => {
    const card = await seedCard('w1', -1_000);

    const res = await postAnswer({
      wordId: 'w1',
      correct: true,
      latencyMs: 1200,
      questionType: 'mcq',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
    if (!body.success) throw new Error('expected success');

    const persisted = await new SqliteReviewStore(testDb).getReviewCard(
      USER_ID,
      'w1',
    );
    // Response matches the persisted advance.
    expect(persisted!.due.toISOString()).toBe(body.data.due);
    // The advance moved the due date forward from the seeded value.
    expect(persisted!.due.getTime()).toBeGreaterThan(card.due.getTime());
  });

  it('maps a wrong answer to "again", distinct from "good"', async () => {
    await seedCard('good1', -1_000);
    await seedCard('again1', -1_000);

    const goodRes = await postAnswer({
      wordId: 'good1',
      correct: true,
      latencyMs: 1000,
      questionType: 'mcq',
    });
    const againRes = await postAnswer({
      wordId: 'again1',
      correct: false,
      latencyMs: 1000,
      questionType: 'mcq',
    });

    const good = (await goodRes.json()) as ApiResponse<ReviewAnswerResponse>;
    const again = (await againRes.json()) as ApiResponse<ReviewAnswerResponse>;
    if (!good.success || !again.success) throw new Error('expected success');

    // 'again' schedules sooner than 'good'.
    expect(new Date(again.data.due).getTime()).toBeLessThan(
      new Date(good.data.due).getTime(),
    );
  });

  it('ignores latency: slow-but-correct advances identically to fast-correct', async () => {
    await seedCard('slow', -1_000);
    await seedCard('fast', -1_000);
    // Identical seed (same performance/now offset) → identical advance for equal rating.
    const store = new SqliteReviewStore(testDb);
    const slowSeed = await store.getReviewCard(USER_ID, 'slow');
    const fastSeed = await store.getReviewCard(USER_ID, 'fast');
    // Guard: the two seeds share scheduler state (difficulty/stability), only wordId/due differ.
    expect((slowSeed!.schedulerData as { stability: number }).stability).toBe(
      (fastSeed!.schedulerData as { stability: number }).stability,
    );

    await postAnswer({ wordId: 'slow', correct: true, latencyMs: 60_000, questionType: 'mcq' });
    await postAnswer({ wordId: 'fast', correct: true, latencyMs: 300, questionType: 'mcq' });

    const slow = await store.getReviewCard(USER_ID, 'slow');
    const fast = await store.getReviewCard(USER_ID, 'fast');
    expect((slow!.schedulerData as { stability: number }).stability).toBe(
      (fast!.schedulerData as { stability: number }).stability,
    );
  });

  it('rejects malformed bodies with 400 and leaves the card unchanged', async () => {
    await seedCard('w2', -1_000);
    // Baseline from a store read-back (post round-trip) so we compare like-for-like.
    const store = new SqliteReviewStore(testDb);
    const before = await store.getReviewCard(USER_ID, 'w2');

    const invalid: unknown[] = [
      { wordId: '', correct: true, latencyMs: 100, questionType: 'mcq' },
      { wordId: 'w2', correct: 'yes', latencyMs: 100, questionType: 'mcq' },
      { wordId: 'w2', correct: true, latencyMs: -1, questionType: 'mcq' },
      { wordId: 'w2', correct: true, latencyMs: Number.NaN, questionType: 'mcq' },
      { wordId: 'w2', correct: true, latencyMs: 100, questionType: 'flashcard' },
      { wordId: 'w2', correct: true, latencyMs: 100 },
      { correct: true, latencyMs: 100, questionType: 'mcq' },
    ];

    for (const body of invalid) {
      const res = await postAnswer(body);
      expect(res.status).toBe(400);
    }

    const persisted = await store.getReviewCard(USER_ID, 'w2');
    expect(persisted!.due.toISOString()).toBe(before!.due.toISOString());
    expect(persisted!.schedulerData).toEqual(before!.schedulerData);
  });

  it('returns 404 for an unknown wordId and creates no card', async () => {
    const res = await postAnswer({
      wordId: 'ghost',
      correct: true,
      latencyMs: 100,
      questionType: 'mcq',
    });
    expect(res.status).toBe(404);

    const cards = await new SqliteReviewStore(testDb).getAllReviewCards(USER_ID);
    expect(cards).toEqual([]);
  });

  // --- ST04: durable review-answer record ---

  it('appends exactly one review_answer_events row carrying all facts + rating + correlation id', async () => {
    await seedCard('rec1', -1_000);
    await postAnswer(
      { wordId: 'rec1', correct: false, latencyMs: 4200, questionType: 'word-block' },
      { 'x-correlation-id': 'corr-xyz' },
    );

    const rows = testDb
      .select()
      .from(schema.review_answer_events)
      .orderBy(asc(schema.review_answer_events.id))
      .all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.correlation_id).toBe('corr-xyz');
    expect(row.user_id).toBe(USER_ID);
    expect(row.word_id).toBe('rec1');
    expect(row.correct).toBe(false);
    expect(row.latency_ms).toBe(4200);
    expect(row.question_type).toBe('word-block');
    expect(row.rating).toBe('again'); // recorded rating == the rating that advanced the card
    expect(typeof row.created_at).toBe('string');
  });

  it('records rating "good" for a correct answer', async () => {
    await seedCard('rec2', -1_000);
    await postAnswer({ wordId: 'rec2', correct: true, latencyMs: 900, questionType: 'mcq' });

    const rows = testDb.select().from(schema.review_answer_events).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe('good');
  });

  it('fails open when the record append fails: 200 and the advance is intact', async () => {
    const card = await seedCard('rec3', -1_000);
    testDb.$client.exec('DROP TABLE review_answer_events');

    const res = await postAnswer({
      wordId: 'rec3',
      correct: true,
      latencyMs: 900,
      questionType: 'mcq',
    });
    expect(res.status).toBe(200);

    const persisted = await new SqliteReviewStore(testDb).getReviewCard(
      USER_ID,
      'rec3',
    );
    // The advance stands despite the record failure.
    expect(persisted!.due.getTime()).toBeGreaterThan(card.due.getTime());
  });
});
