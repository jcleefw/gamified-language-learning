import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import type { DeckDoc } from '@gll/api-contract';

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

/** One user's config overrides (T1), stored as a JSON blob on the identity row.
 *  Every field is optional; a field's absence (or a NULL `config` column) means
 *  "no override", resolved to the server's base/preset default at the read path
 *  (DS02). `difficultyPreset` is a preset NAME — the name-only invariant is
 *  enforced by the write path (DS02), not by storage. */
export interface UserConfigJson {
  difficultyPreset?: string | null;
  wordsPerBatch?: number | null;
  sentenceDirections?: string[] | null;
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('learner'),
  created_at: text('created_at').notNull(),
  config: text('config', { mode: 'json' }).$type<UserConfigJson>(),
});

// ---------------------------------------------------------------------------
// Content — vocabulary
// ---------------------------------------------------------------------------

export const words = sqliteTable(
  'words',
  {
    id: text('id').primaryKey(),
    language: text('language').notNull(),
    text: text('text').notNull(),
    senses: text('senses').notNull().default('[]'),
  },
  (table) => [
    unique('words_language_text_unique').on(table.language, table.text),
  ],
);

export const foundational_words = sqliteTable(
  'foundational_words',
  {
    id: text('id').primaryKey(),
    language: text('language').notNull(),
    text: text('text').notNull(),
    romanization: text('romanization'),
    english: text('english'),
  },
  (table) => [
    unique('foundational_words_language_text_unique').on(table.language, table.text),
  ],
);

// ---------------------------------------------------------------------------
// Content — curriculum
// ---------------------------------------------------------------------------

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  language: text('language').notNull(),
  difficulty: text('difficulty'),
  register: text('register'),
  created_at: text('created_at').notNull(),
  doc: text('doc', { mode: 'json' }).$type<DeckDoc>().notNull(),
});

export const deck_words = sqliteTable(
  'deck_words',
  {
    deck_id: text('deck_id').notNull(),
    word_id: text('word_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.deck_id, table.word_id] })],
);

// ---------------------------------------------------------------------------
// Learner state
// ---------------------------------------------------------------------------

export const user_word_states = sqliteTable(
  'user_word_states',
  {
    user_id: text('user_id').notNull(),
    word_id: text('word_id').notNull(),
    seen: integer('seen').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    mastery: integer('mastery').notNull().default(0),
    correct_streak: integer('correct_streak').notNull().default(0),
    wrong_streak: integer('wrong_streak').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.word_id] })],
);

export const user_sentence_states = sqliteTable(
  'user_sentence_states',
  {
    user_id: text('user_id').notNull(),
    sentence_id: text('sentence_id').notNull(),
    sentence_streak: integer('sentence_streak').notNull().default(0),
    last_batch_seen: integer('last_batch_seen').notNull().default(-1),
    daily_count: integer('daily_count').notNull().default(0),
    session_wrong_streak: integer('session_wrong_streak').notNull().default(0),
    active: integer('active').notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.sentence_id] })],
);

// ---------------------------------------------------------------------------
// SRS scheduling
// ---------------------------------------------------------------------------

export const review_cards = sqliteTable(
  'review_cards',
  {
    user_id: text('user_id').notNull(),
    word_id: text('word_id').notNull(),
    due: text('due').notNull(),
    scheduler_data: text('scheduler_data').notNull(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.word_id] })],
);

// ---------------------------------------------------------------------------
// Transition channel — append-only per-answer Learning transition log
// ---------------------------------------------------------------------------

export const answer_events = sqliteTable('answer_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  correlation_id: text('correlation_id'),
  user_id: text('user_id').notNull(),
  word_id: text('word_id').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  latency_ms: integer('latency_ms').notNull(),
  before_state: text('before_state'),
  after_state: text('after_state').notNull(),
  graduated: integer('graduated', { mode: 'boolean' }).notNull(),
  recheck: integer('recheck', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Review-answer channel — append-only per-review-answer log (seed data for the
// deferred response-time-scoring feature; never feeds the rating).
// ---------------------------------------------------------------------------

export const review_answer_events = sqliteTable('review_answer_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  correlation_id: text('correlation_id'),
  user_id: text('user_id').notNull(),
  word_id: text('word_id').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  latency_ms: integer('latency_ms').notNull(),
  question_type: text('question_type').notNull(), // 'mcq' | 'word-block'
  rating: text('rating'),                          // inferred ReviewRating ('again'|'good'); NULL ⟺ eager/not-due answer (no FSRS rating)
  created_at: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// Revision transition channel (EP40-ST05) — append-only per-answer card-state
// transition log. Pure transition log (before/after card), separate from the
// review_answer_events answer log; joined to inputs by correlation_id. Written
// on the due (advance) branch only — brings Revision to answer_events fidelity.
// ---------------------------------------------------------------------------

export const review_transition_events = sqliteTable('review_transition_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  correlation_id: text('correlation_id'),
  user_id: text('user_id').notNull(),
  word_id: text('word_id').notNull(),
  before_card: text('before_card').notNull(), // JSON ReviewCard (pre-advance)
  after_card: text('after_card').notNull(),   // JSON ReviewCard (post-advance)
  created_at: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// SRS shelving
// ---------------------------------------------------------------------------

export const user_shelved_words = sqliteTable(
  'user_shelved_words',
  {
    user_id: text('user_id').notNull(),
    deck_id: text('deck_id').notNull(),
    word_id: text('word_id').notNull(),
    shelved_at_batch: integer('shelved_at_batch').notNull(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.deck_id, table.word_id] })],
);

export const user_deck_word_tracking = sqliteTable(
  'user_deck_word_tracking',
  {
    user_id: text('user_id').notNull(),
    deck_id: text('deck_id').notNull(),
    word_id: text('word_id').notNull(),
    stagnation_count: integer('stagnation_count').notNull().default(0),
    last_boundary_mastery: integer('last_boundary_mastery'),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.deck_id, table.word_id] })],
);
