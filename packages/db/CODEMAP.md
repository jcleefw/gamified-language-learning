# packages/db CODEMAP

Package: `@gll/db`
Purpose: SQLite schema, initialization, and port implementations. Provides interfaces (LearningStore, ContentStore, ReviewStore, etc.) with SQLite implementations.

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | Public exports: schema, stores, types, db connection. |
| `src/db.ts` | Database client singleton: getDb(), closeDb(). |
| `src/init-db.ts` | Schema initialization on startup. |
| `src/schema.ts` | Drizzle schema tables (users, words, decks, word_state, review_cards, etc.). |

## Ports (Interfaces)

| File | Purpose |
|---|---|
| `src/types/learning-store.ts` | LearningStore: fetch/update word state, graduation logic. |
| `src/types/content-store.ts` | ContentStore: import decks, fetch deck metadata. |
| `src/types/review-store.ts` | ReviewStore: fetch/update review cards, schedule by due date. |
| `src/types/answer-event-store.ts` | AnswerEventStore: record answer events for learning, detect stagnation. |
| `src/types/review-answer-event-store.ts` | ReviewAnswerEventStore: record review answer events. |
| `src/types/user-config-store.ts` | UserConfigStore: read/write user configuration (difficulty preset, words per batch, etc.). |

## Implementations (SQLite)

| File | Port | Purpose |
|---|---|---|
| `src/sqlite-learning-store.ts` | ILearningStore | Query/update word_state, compute graduation thresholds, record learning answers. |
| `src/sqlite-content-store.ts` | IContentStore | Import curriculum JSON to decks/words tables, fetch with audio URLs. |
| `src/sqlite-review-store.ts` | IReviewStore | Fetch due review cards, update after scheduling. |
| `src/sqlite-answer-event-store.ts` | IAnswerEventStore | Record answer events, compute performance metrics. |
| `src/sqlite-review-answer-event-store.ts` | IReviewAnswerEventStore | Record review answer events. |
| `src/sqlite-user-config-store.ts` | IUserConfigStore | Read/write user config JSON blobs. |

## Schema Overview

| Table | Purpose |
|---|---|
| `users` | User identity and config (JSON). |
| `words` | Vocabulary: language, text, senses (JSON). |
| `foundational_words` | Foundational word list with translations. |
| `decks` | Curricula: topic, difficulty, register, language. |
| `deck_words` | Deck ↔ word mapping with position. |
| `word_state` | Learning state per word per user: interval, repetitions, lapses, next_review. |
| `sentences` | Sentences with audio timing metadata. |
| `sentence_words` | Sentence ↔ word mapping. |
| `review_cards` | Review stage records: word, user, due date, scheduler data. |
| `answer_events` | Learning answer events: user, word, batch, rating, streak, lapses, correctRatio. |
| `review_answer_events` | Review answer events: user, word, rating, due_before, due_after. |
| `audio` | Audio files: deck or sentence subject, format, size, VTT cue data. |

## Dependencies

| Package | Source | Purpose |
|---|---|---|
| Drizzle ORM | `drizzle-orm@^0.45.2` | Type-safe query builder for SQLite. |
| better-sqlite3 | `better-sqlite3@^12.11.1` | Synchronous SQLite driver. |
| @gll/api-contract | `workspace:*` | Type contracts (DeckDoc, etc.). |
| @gll/logger | `workspace:*` | Structured logging. |
| @gll/srs-engine | `workspace:*` | WordState type context. |
| @gll/srs-review | `workspace:*` | ReviewCard type context. |
| @gll/srs-shelving | `workspace:*` | ShelvedWord type context. |

## Notes

- **Drizzle migrations**: `db:generate` (drizzle-kit generate), `db:push` (drizzle-kit push).
- **Schema normalization**: Separate event tables for learning and review answer events; word_state is the canonical current state.
- **Audio metadata**: VTT cue data (WebVTT ADR) stored in the audio table; sidecar links are computed at read time.
