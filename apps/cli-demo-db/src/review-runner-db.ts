import './env.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getDb, closeDb, SqliteReviewStore } from '@gll/db';
import type { IReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-engine/review';
import type { ReviewCard, ReviewScheduler } from '@gll/srs-engine/review';
import { composeWordBatch } from '@gll/srs-engine/learn';
import type { MCQQuestion } from '@gll/srs-engine/learn';
import { buildQuizItems } from './db-query.js';
import type { DbClient } from './db-tools.js';
import { AUTO_MODE } from './config.js';
import { inferReviewRating } from './review-rating.js';
import { CorrectAutoAnswerStrategy } from './auto-answer-strategy.js';

export type ReviewMode = 'deck' | 'pool';

export interface ReviewAnswer {
  correct: boolean;
  latencyMs: number;
}

/** Presents a question and returns how the user answered. Owns latency measurement. */
export interface ReviewAnswerProvider {
  answer(question: MCQQuestion): Promise<ReviewAnswer>;
}

export interface ReviewSessionDeps {
  dueCards: ReviewCard[];
  questionFor: (wordId: string) => MCQQuestion | null;
  provider: ReviewAnswerProvider;
  scheduler: ReviewScheduler;
  reviewStore: IReviewStore;
  userId: string;
  now?: () => Date;
  log?: (msg: string) => void;
}

/**
 * ST07: core review loop. For each due card, present a question, infer the rating
 * from the answer (ST08), reschedule, and persist immediately (write-on-answer).
 * A card with no vocab question is skipped. Errors propagate after already-answered
 * cards are safely persisted.
 */
export async function runReviewSession(deps: ReviewSessionDeps): Promise<{ reviewed: number }> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m: string) => console.log(m));

  if (deps.dueCards.length === 0) {
    log('Nothing due 🎉');
    return { reviewed: 0 };
  }

  let reviewed = 0;
  for (const card of deps.dueCards) {
    const question = deps.questionFor(card.wordId);
    if (!question) continue;

    const { correct, latencyMs } = await deps.provider.answer(question);
    const rating = inferReviewRating(correct, latencyMs);
    const next = deps.scheduler.schedule(card, rating, now());
    await deps.reviewStore.upsertReviewCard(deps.userId, next);
    reviewed++;
  }

  return { reviewed };
}

/** Dispatches to the deck-scoped or pool-global store method based on mode. */
export function loadDueCards(
  reviewStore: IReviewStore,
  mode: ReviewMode,
  userId: string,
  deckId: string,
  now: Date,
): Promise<ReviewCard[]> {
  return mode === 'deck'
    ? reviewStore.getDueReviewCardsForDeck(userId, deckId, now)
    : reviewStore.getDueReviewCards(userId, now);
}

// ── Answer providers ────────────────────────────────────────────────────────

/** AUTO_MODE provider: answers correctly with a simulated latency in the "good" band. */
const AUTO_LATENCY_MS = 6_000;
export class AutoReviewAnswerProvider implements ReviewAnswerProvider {
  private strategy = new CorrectAutoAnswerStrategy();
  answer(question: MCQQuestion): Promise<ReviewAnswer> {
    const idx = this.strategy.selectAnswer(question);
    const correct = question.choices[idx]?.isCorrect === true;
    return Promise.resolve({ correct, latencyMs: AUTO_LATENCY_MS });
  }
}

async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data: string) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      if (data === '\x03') process.exit();
      resolve(data.toLowerCase());
    });
  });
}

/** Interactive provider: presents the MCQ, reads a key, measures wall-clock latency. */
export class InteractiveReviewAnswerProvider implements ReviewAnswerProvider {
  async answer(question: MCQQuestion): Promise<ReviewAnswer> {
    console.log(`\n${question.prompt}`);
    for (const choice of question.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }
    process.stdout.write('Your answer: ');

    const shownAt = Date.now();
    let key: string;
    const labels = question.choices.map((c) => c.label as string);
    for (;;) {
      key = await readKey();
      if (labels.includes(key)) break;
    }
    const latencyMs = Date.now() - shownAt;

    const selected = question.choices.find((c) => c.label === key);
    const correct = selected?.isCorrect === true;
    console.log(correct ? 'Correct!' : 'Wrong.');
    return { correct, latencyMs };
  }
}

// ── Top-level script ─────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const DB_PATH = process.env.GLL_DB_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../../.data/learning-state.db');
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const CLI_USER_ID = 'cli-user';
  const DECK_ID = 'cli-deck';
  const mode: ReviewMode = process.env.REVIEW_MODE === 'deck' ? 'deck' : 'pool';

  const db = getDb(DB_PATH) as DbClient;
  const reviewStore = new SqliteReviewStore(db);
  const scheduler = new FsrsScheduler();

  const now = new Date();
  const dueCards = await loadDueCards(reviewStore, mode, CLI_USER_ID, DECK_ID, now);

  const pool = buildQuizItems(db);
  const byId = new Map(pool.map((w) => [w.id, w]));
  const questionFor = (wordId: string): MCQQuestion | null => {
    const item = byId.get(wordId);
    if (!item) return null;
    return composeWordBatch(item, pool)[0] ?? null;
  };

  const provider: ReviewAnswerProvider = AUTO_MODE
    ? new AutoReviewAnswerProvider()
    : new InteractiveReviewAnswerProvider();

  console.log(`[INFO] Review session (${mode} mode): ${String(dueCards.length)} due card(s).`);
  const { reviewed } = await runReviewSession({
    dueCards,
    questionFor,
    provider,
    scheduler,
    reviewStore,
    userId: CLI_USER_ID,
  });
  console.log(`[INFO] Reviewed ${String(reviewed)} card(s).`);

  closeDb();
}
