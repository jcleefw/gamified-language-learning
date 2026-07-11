/**
 * EP40-ST06 — Replay harness. Reads the durable transition rows (Learning
 * `answer_events`, Revision `review_transition_events`) and replays their inputs
 * through the SAME pure engines the server runs (`@gll/srs-engine-v2`,
 * `@gll/srs-review`) — no second implementation. A recomputed after-state that
 * diverges from the recorded one IS the bug; the run itself IS the regression
 * fixture (emit via `buildFixture`).
 *
 * Replay reads the DB (authoritative inputs), NOT the client export (human context).
 */
import { asc } from 'drizzle-orm';
import { schema, type DbClient } from '@gll/db';
import {
  processRecheckResult,
  type WordState,
  type RunState,
  type StreakThresholds,
} from '@gll/srs-engine-v2';
import { FsrsScheduler, type ReviewCard, type ReviewRating } from '@gll/srs-review';

export interface ReplayResult {
  correlationId: string | null;
  wordId: string;
  matched: boolean; // recomputed after-state == recorded after-state
  recomputed: unknown; // WordState (Learning) | ReviewCard (Revision)
  recorded: unknown;
}

export interface LearningReplayConfig {
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
}

// --- Learning (answer_events) ---------------------------------------------

interface LearningRow {
  correlationId: string | null;
  wordId: string;
  correct: boolean;
  recheck: boolean;
  beforeState: WordState | null;
  afterState: WordState;
}

/** Replay one Learning row exactly as `POST /api/answer` does: seed the word's
 *  run-state from `before`, fold the raw answer through the pure recheck branch,
 *  and compare the recomputed `after` to the recorded one. Row-independent —
 *  the server also reads `before` fresh per request. */
export function replayLearningRows(
  rows: LearningRow[],
  config: LearningReplayConfig,
): ReplayResult[] {
  return rows.map((row) => {
    const runState: RunState = new Map();
    if (row.beforeState) runState.set(row.wordId, row.beforeState);
    const { runState: next } = processRecheckResult(
      row.wordId,
      row.correct,
      runState,
      row.recheck ? new Set([row.wordId]) : new Set(),
      new Set(),
      config.masteryThreshold,
      config.streakThresholds,
    );
    const recomputed = next.get(row.wordId) ?? null;
    return {
      correlationId: row.correlationId,
      wordId: row.wordId,
      matched: deepEqual(recomputed, row.afterState),
      recomputed,
      recorded: row.afterState,
    };
  });
}

/** Load Learning transition rows (optionally filtered to a correlation-id set). */
export function loadLearningRows(
  db: DbClient,
  correlationIds?: string[],
): LearningRow[] {
  const rows = db
    .select()
    .from(schema.answer_events)
    .orderBy(asc(schema.answer_events.id))
    .all()
    .filter(
      (r) =>
        !correlationIds ||
        (r.correlation_id !== null && correlationIds.includes(r.correlation_id)),
    );
  return rows.map((r) => ({
    correlationId: r.correlation_id,
    wordId: r.word_id,
    correct: r.correct,
    recheck: r.recheck,
    beforeState: r.before_state ? (JSON.parse(r.before_state) as WordState) : null,
    afterState: JSON.parse(r.after_state) as WordState,
  }));
}

// --- Revision (review_transition_events + review_answer_events) ------------

const scheduler = new FsrsScheduler();

interface RevisionRow {
  correlationId: string | null;
  wordId: string;
  beforeCard: ReviewCard;
  afterCard: ReviewCard;
  createdAt: string;
  rating: ReviewRating | null; // joined from review_answer_events by correlation_id
}

/** Replay one Revision row as `POST /api/reviews/answer` does on the due branch:
 *  advance the recorded `before` card by the joined rating at the recorded time,
 *  and compare to the recorded `after` card (through the JSON storage boundary). */
export function replayRevisionRows(rows: RevisionRow[]): ReplayResult[] {
  return rows.map((row) => {
    // Cannot replay without the rating (lives in the answer log) — report, don't crash.
    if (row.rating === null) {
      return {
        correlationId: row.correlationId,
        wordId: row.wordId,
        matched: false,
        recomputed: null,
        recorded: row.afterCard,
      };
    }
    const before: ReviewCard = { ...row.beforeCard, due: new Date(row.beforeCard.due) };
    const advanced = scheduler.schedule(before, row.rating, new Date(row.createdAt));
    // Parity is byte-identity through the storage boundary.
    const recomputed = JSON.parse(JSON.stringify(advanced)) as unknown;
    return {
      correlationId: row.correlationId,
      wordId: row.wordId,
      matched: deepEqual(recomputed, row.afterCard),
      recomputed,
      recorded: row.afterCard,
    };
  });
}

/** Load Revision transition rows, joining the FSRS rating from the answer log by
 *  correlation_id (the transition log records only before/after cards). */
export function loadRevisionRows(
  db: DbClient,
  correlationIds?: string[],
): RevisionRow[] {
  const ratingByCorrelation = new Map<string, ReviewRating>();
  for (const a of db.select().from(schema.review_answer_events).all()) {
    if (a.correlation_id !== null && a.rating !== null) {
      ratingByCorrelation.set(a.correlation_id, a.rating as ReviewRating);
    }
  }
  const rows = db
    .select()
    .from(schema.review_transition_events)
    .orderBy(asc(schema.review_transition_events.id))
    .all()
    .filter(
      (r) =>
        !correlationIds ||
        (r.correlation_id !== null && correlationIds.includes(r.correlation_id)),
    );
  return rows.map((r) => ({
    correlationId: r.correlation_id,
    wordId: r.word_id,
    beforeCard: JSON.parse(r.before_card) as ReviewCard,
    afterCard: JSON.parse(r.after_card) as ReviewCard,
    createdAt: r.created_at,
    rating:
      r.correlation_id !== null
        ? ratingByCorrelation.get(r.correlation_id) ?? null
        : null,
  }));
}

// --- Fixture emission ------------------------------------------------------

export interface ReplayFixture {
  authority: 'learning' | 'revision';
  generatedAt: string;
  allMatched: boolean;
  firstDivergence: ReplayResult | null;
  results: ReplayResult[];
}

/** Turn a replay run into a deterministic regression fixture. `allMatched:false`
 *  with `firstDivergence` set pinpoints the first bad transition. */
export function buildFixture(
  authority: 'learning' | 'revision',
  results: ReplayResult[],
): ReplayFixture {
  const firstDivergence = results.find((r) => !r.matched) ?? null;
  return {
    authority,
    generatedAt: new Date().toISOString(),
    allMatched: firstDivergence === null,
    firstDivergence,
    results,
  };
}

// Structural equality via canonical JSON — sufficient for the plain WordState /
// serialised ReviewCard shapes these rows hold.
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
