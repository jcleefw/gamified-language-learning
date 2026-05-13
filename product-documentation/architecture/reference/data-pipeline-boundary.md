# Reference: Data Pipeline Boundary

**Type:** Engineering Reference (not an ADR — no decision being made)

**Last updated:** 2026-05-13

---

## Purpose

This document describes the boundary between the data pipeline and the SRS engine. It exists to prevent engine code from absorbing data concerns, and to give future contributors a clear picture of where content originates and how it reaches the engine.

---

## Pipeline Overview

```
Conversation JSON
  └──▶ Ingestion Layer → Database
         ├── words             (wordId, native, romanization, english, type, language)
         ├── sentences         (sentenceId, nativeSentence, englishSentence,
         │                      nativeWordOrder: wordId[], englishWordOrder: string[],
         │                      blankPosition: number)
         └── sentence_words    (sentenceId, wordId, position) ← join table

Database → Query Layer
  └──▶ resolves words, pool, eligible SentenceContexts

Query Layer → Caller (demo app / host application)
  └──▶ passes [words], [pool], [sentenceContexts] into engine as inputs

Engine
  └──▶ stateless — operates only on what it receives, no DB access
```

---

## Source of Truth

The **conversation JSON** (see `packages/srs-engine-v2/data/mock/mock-decks.ts` for the current mock shape) is the canonical source for both:

- **Words** — each line in a conversation carries the words it contains, with `id`, `native`, `romanization`, `english`, `type`, `language`
- **Sentences** — each line is a sentence; the words it contains and their positions are implicit in the JSON structure

The ingestion layer derives `SentenceContext` records from the conversation JSON at import time. `nativeWordOrder` (ordered `wordId[]`) and `blankPosition` are computed during ingestion — they are not hand-authored.

---

## Engine Boundary

The SRS engine (`packages/srs-engine-v2`) has **no knowledge of**:

- The database schema or query layer
- The conversation JSON format
- How sentences are associated with words
- Which sentences are eligible for a given learner state

The engine receives:
- `words: QuizItem[]` — the words to learn in this session
- `pool: QuizItem[]` — the distractor pool
- `sentenceContexts: SentenceContext[]` — pre-resolved eligible sentences (caller's responsibility)
- `config: LearningConfig` — session configuration constants

The **caller** (demo app, or future host application) is responsible for:
- Loading words from the DB for the selected deck
- Querying eligible `SentenceContext` records (e.g. sentences where all `wordId`s have `seen >= MIN_SEEN_FOR_SENTENCE`)
- Passing these as inputs into `runAdaptiveLoop`

---

## Why This Boundary Exists

The engine is designed to be portable and testable in isolation. If it held DB access or content-loading logic, it could not be tested without a database, could not be reused in different host environments, and would conflate learning mechanics with content management.

Content (words, sentences, corpus) is a data concern. Learning mechanics (mastery, streaks, scheduling) is an engine concern. The boundary is the function signature of `runAdaptiveLoop`.

---

## Related

- ADR: `../20260513T000000Z-engineering-batch-execution-mechanics.md` — session inputs and composer registry
- ADR: `../20260512T235900Z-engineering-compose-sentence-batch-boundary.md` — `SentenceContext` fields and `composeSentenceBatch` interface
- PRD: `../../prds/20260513T000000Z-sentence-question-ep.md` — `SentenceContext` data model
- Mock data: `packages/srs-engine-v2/data/mock/mock-decks.ts` — current conversation JSON shape
