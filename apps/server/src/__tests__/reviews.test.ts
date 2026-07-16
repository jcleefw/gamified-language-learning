import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler, type ReviewCard } from '@gll/srs-engine-v2/review';
import type {
  AnytimeReviewsResponse,
  ApiResponse,
  DueReviewsResponse,
  ReviewAnswerResponse,
} from '@gll/api-contract';
import { orderAnytimeBatch } from '../routes/reviews.js';

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

async function getAnytime(): Promise<Response> {
  return app.request('/api/reviews/anytime', { method: 'GET' });
}

/** Minimal ReviewCard for pure-helper tests — only wordId/due matter to the ordering. */
function cardOf(wordId: string, due: Date): ReviewCard {
  return { wordId, due, schedulerData: {} as ReviewCard['schedulerData'] };
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

  // --- EP39-ST02: due-gate (ADR §2 / NFR-005) ---

  it('advances a DUE card and reports advanced:true (EP38 behaviour + the new flag)', async () => {
    const card = await seedCard('due1', -1_000);

    const res = await postAnswer({
      wordId: 'due1',
      correct: true,
      latencyMs: 1000,
      questionType: 'mcq',
    });
    const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.advanced).toBe(true);
    const persisted = await new SqliteReviewStore(testDb).getReviewCard(USER_ID, 'due1');
    expect(persisted!.due.getTime()).toBeGreaterThan(card.due.getTime());
    expect(persisted!.due.toISOString()).toBe(body.data.due);
  });

  it('NFR-005: a NOT-DUE answer is read-only — due + scheduler_data byte-for-byte unchanged, advanced:false', async () => {
    await seedCard('eager1', 60 * 60_000); // due one hour from now
    const store = new SqliteReviewStore(testDb);
    const before = await store.getReviewCard(USER_ID, 'eager1');

    const res = await postAnswer({
      wordId: 'eager1',
      correct: true,
      latencyMs: 1000,
      questionType: 'mcq',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.advanced).toBe(false);
    expect(body.data.due).toBe(before!.due.toISOString()); // unchanged due echoed back

    const after = await store.getReviewCard(USER_ID, 'eager1');
    expect(after!.due.toISOString()).toBe(before!.due.toISOString());
    expect(after!.schedulerData).toEqual(before!.schedulerData);
  });

  it('a NOT-DUE answer still appends exactly one event row with rating NULL and the raw facts', async () => {
    await seedCard('eager2', 60 * 60_000);
    await postAnswer({
      wordId: 'eager2',
      correct: false,
      latencyMs: 4200,
      questionType: 'word-block',
    });

    const rows = testDb.select().from(schema.review_answer_events).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBeNull(); // durable read-only marker
    expect(rows[0].word_id).toBe('eager2');
    expect(rows[0].correct).toBe(false);
    expect(rows[0].latency_ms).toBe(4200);
    expect(rows[0].question_type).toBe('word-block');
  });

  it('a DUE answer appends one row with a non-null rating equal to what scheduled the card', async () => {
    await seedCard('due2', -1_000);
    await postAnswer({ wordId: 'due2', correct: false, latencyMs: 900, questionType: 'mcq' });

    const rows = testDb.select().from(schema.review_answer_events).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe('again');
  });
});

describe('GET /api/reviews/anytime', () => {
  it('returns ALL learned words — due AND not-due (unlike GET /api/reviews)', async () => {
    await seedCard('past', -60_000);
    await seedCard('future', 60 * 60_000);

    const res = await getAnytime();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
    if (!body.success) throw new Error('expected success');

    expect(new Set(body.data.reviews.map((r) => r.wordId))).toEqual(
      new Set(['past', 'future']),
    );
  });

  it('orders due cards first (most-overdue-first), then the not-due tail', async () => {
    await seedCard('future', 60 * 60_000);
    await seedCard('recentDue', -1_000);
    await seedCard('oldestDue', -100_000);

    const res = await getAnytime();
    const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.reviews.map((r) => r.wordId)).toEqual([
      'oldestDue',
      'recentDue',
      'future',
    ]);
  });

  it('caps the batch at 50 even with more learned words', async () => {
    for (let i = 0; i < 55; i++) await seedCard(`w${i}`, -(i + 1) * 1_000);

    const res = await getAnytime();
    const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.reviews).toHaveLength(50);
  });

  it('tolerates an orphaned card (no word row) and serialises `due` as ISO', async () => {
    await seedCard('orphan', -1_000);
    const res = await getAnytime();
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
    if (!body.success) throw new Error('expected success');
    const due = body.data.reviews[0].due;
    expect(new Date(due).toISOString()).toBe(due);
  });

  it('FR-016: after practising one not-due word it rotates behind the untouched one', async () => {
    await seedCard('a', 60 * 60_000);
    await seedCard('b', 60 * 60_000);

    // Practise 'a' (not-due → read-only, but recorded → most-recently-practised).
    await postAnswer({ wordId: 'a', correct: true, latencyMs: 1000, questionType: 'mcq' });

    const res = await getAnytime();
    const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
    if (!body.success) throw new Error('expected success');
    // 'b' (never practised) precedes 'a' (just practised) in the not-due tail.
    expect(body.data.reviews.map((r) => r.wordId)).toEqual(['b', 'a']);
  });
});

describe('orderAnytimeBatch (pure helper)', () => {
  const now = new Date('2026-07-10T00:00:00.000Z');
  const past = (ms: number) => new Date(now.getTime() - ms);
  const future = (ms: number) => new Date(now.getTime() + ms);

  it('puts due cards first, most-overdue-first', () => {
    const cards = [
      cardOf('recent', past(1_000)),
      cardOf('oldest', past(100_000)),
      cardOf('middle', past(50_000)),
    ];
    const out = orderAnytimeBatch(cards, new Map(), now);
    expect(out.map((c) => c.wordId)).toEqual(['oldest', 'middle', 'recent']);
  });

  it('ranks the not-due tail least-recently-practised first; never-practised sorts to the front', () => {
    const cards = [
      cardOf('recentlySeen', future(1_000)),
      cardOf('neverSeen', future(1_000)),
      cardOf('longAgo', future(1_000)),
    ];
    const lastSeen = new Map([
      ['recentlySeen', '2026-07-09T23:00:00.000Z'],
      ['longAgo', '2026-07-01T00:00:00.000Z'],
      // neverSeen absent → front of tail
    ]);
    const out = orderAnytimeBatch(cards, lastSeen, now);
    expect(out.map((c) => c.wordId)).toEqual(['neverSeen', 'longAgo', 'recentlySeen']);
  });

  it('due tail precedes the not-due tail regardless of recency', () => {
    const cards = [
      cardOf('futureNeverSeen', future(1_000)),
      cardOf('dueRecentlySeen', past(1_000)),
    ];
    const lastSeen = new Map([['dueRecentlySeen', '2026-07-09T23:59:00.000Z']]);
    const out = orderAnytimeBatch(cards, lastSeen, now);
    expect(out.map((c) => c.wordId)).toEqual(['dueRecentlySeen', 'futureNeverSeen']);
  });

  it('bounds the result to the limit', () => {
    const cards = Array.from({ length: 60 }, (_, i) => cardOf(`w${i}`, past(i + 1)));
    expect(orderAnytimeBatch(cards, new Map(), now, 50)).toHaveLength(50);
  });
});
