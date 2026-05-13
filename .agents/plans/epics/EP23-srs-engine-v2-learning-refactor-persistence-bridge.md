# EP23 - SRS Engine v2: Batch Composition

**Created**: 20260321T192340Z
**Status**: In Progress

---

## 1. Feature Overview

This epic establishes the naming boundaries and type foundations for the `srs-engine-v2` batch composition layer. It renames existing composers to communicate their true input-shape boundary, introduces the `MCQQuestion` / `QuizQuestion` union type that will support sentence-level question types, and lays the groundwork for a composer registry pattern.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| ----------- | -------- | --------- |
| `composeBatch` rename | `composeWordBatch` | Communicates word-item input boundary; prevents misuse as sentence composer entry point |
| `composeBatchMulti` rename | `composeWordBatchMulti` + `composeWordBatchItems` alias | Consistent naming; alias bridges registry wiring name per batch-execution-mechanics ADR |
| `QuizQuestion` type | `MCQQuestion \| SentenceQuestion` union | Discriminated union (`kind`) enables session and UI type-narrowing without guessing |
| `MCQQuestion` | Renamed from `QuizQuestion`, adds `kind: 'mcq'` | Honest name for the existing MCQ shape |
| `SentenceQuestion` stub | `kind: 'word-block'` + `SentenceTile[]` | Type boundary for future `composeSentenceBatch` work |

## 3. ADRs

- `product-documentation/architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md`
- `product-documentation/architecture/20260512T230000Z-engineering-compose-word-batch-boundary.md`
- `product-documentation/architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md`
- `product-documentation/architecture/reference/data-pipeline-boundary.md`

## 4. Stories & Tasks

### EP23-ST01: Rename `composeBatch` → `composeWordBatch` — **Complete ✅**

See DS01: `.agents/changelogs/EP23--srs-engine-scheduling/20260513T233802Z-EP23-DS01-compose-word-batch-rename.md`

### EP23-ST02: Introduce `MCQQuestion` + `QuizQuestion` union type — **Complete ✅**

See DS01: `.agents/changelogs/EP23--srs-engine-scheduling/20260513T233802Z-EP23-DS01-compose-word-batch-rename.md`
