import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import type { DeckDoc } from '@gll/api-contract';

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('learner'),
  created_at: text('created_at').notNull(),
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
