# EP23 - SRS Engine v2: Batch Composition

**Created**: 20260321T192340Z
**Status**: In Progress

---

## 1. Feature Overview

This epic establishes the naming boundaries, type foundations, and sentence-level composer for the `srs-engine-v2` batch composition layer.

**DS01** renames existing composers to communicate their word-item input boundary and introduces the `MCQQuestion` / `QuizQuestion` union type that supports sentence-level question types.

**DS02** implements `composeSentenceBatch` — the sentence-level composer producing fill-in-the-blank and word-block questions — and wires it into the learning runner so sentence questions surface automatically once words have been seen enough times.

Composer registry, re-serve mechanics, and `assembleBatchQuestions` are out of scope — those belong to a separate EP.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| ----------- | -------- | --------- |
| `composeBatch` rename | `composeWordBatch` | Communicates word-item input boundary; prevents misuse as sentence composer entry point |
| `composeBatchMulti` rename | `composeWordBatchMulti` + `composeWordBatchItems` alias | Consistent naming; alias bridges registry wiring name per batch-execution-mechanics ADR |
| `QuizQuestion` type | `MCQQuestion \| SentenceQuestion` union | Discriminated union (`kind`) enables session and UI type-narrowing without guessing |
| `MCQQuestion` | Renamed from `QuizQuestion`, adds `kind: 'mcq'` | Honest name for the existing MCQ shape |
| `SentenceQuestion` stub | `kind: 'word-block'` + `SentenceTile[]` | Type boundary for `composeSentenceBatch` |
| `SentenceContext` type | New — `src/types/sentence.ts` | Pre-written corpus record; input shape that distinguishes sentence composers from word composers |
| `composeSentenceBatch` | Fill-in-the-blank + word-block (both directions) | Single composer per ADR boundary: input shape determines composer, not output format |
| Learning runner wiring | Direct call in `runBatch`; eligibility from `runState.seen >= MIN_SEEN_FOR_SENTENCE` | No registry; same direct-call pattern as word questions today |

---

## 3. ADRs

- `product-documentation/architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md`
- `product-documentation/architecture/20260512T230000Z-engineering-compose-word-batch-boundary.md`
- `product-documentation/architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md`
- `product-documentation/architecture/reference/data-pipeline-boundary.md`

---

## 4. Stories & Tasks

### DS01 — Word Batch Rename & `QuizQuestion` Type System

Changelog: `.agents/changelogs/EP23--batch-composition/20260513T233802Z-EP23-DS01-compose-word-batch-rename.md`

#### EP23-ST01: Rename `composeBatch` → `composeWordBatch` — **Complete ✅**

#### EP23-ST02: Introduce `MCQQuestion` + `QuizQuestion` union type — **Complete ✅**

---

### DS02 — `composeSentenceBatch` Implementation & Learning Runner Wiring

Changelog: `.agents/changelogs/EP23--batch-composition/20260514T000000Z-EP23-DS02-compose-sentence-batch.md`

#### EP23-ST03: Define `SentenceContext` type + mock corpus fixture — **Pending**

#### EP23-ST04: Fill-in-the-blank (a) engine + (b) runner wiring — **Pending**

#### EP23-ST05: Word-block `english-to-native` + `romanization-to-native` (a) engine + (b) runner wiring — **Pending**

#### EP23-ST06: Word-block `native-to-english` + `native-to-romanization` (a) engine + (b) runner wiring — **Pending**

#### EP23-ST07: `composeSentenceBatch` wrapper + export (a) engine + (b) runner consolidation — **Pending**
