# current-focus

**Branch**: feature/EP23--srs-engine-scheduling
**Last updated**: 20260514T000000Z

## Status

EP23 DS01 complete. DS02 designed (ST03–ST07) but blocked on corpus ingestion ADR — must be written before ST03 starts.

## Completed Epics
- EP20-ST13 support for other foundational words (vowels, etc)
- EP21 srs-engine-v2 library boundary + revision phase
- EP22 auto-script SRS quiz runner
- EP24 Vue SRS demo app (stories complete, queue filter bug fixed)

## EP23 DS01 — Complete ✅

ST01: `composeBatch` → `composeWordBatch` rename + `composeWordBatchItems` alias
ST02: `QuizQuestion` → `MCQQuestion` + `QuizQuestion` union type introduced
File rename: `compose-batch.ts` → `compose-word-batch.ts` (all import paths updated)

## EP23 DS02 — Blocked on ADR

`composeSentenceBatch` design is complete (ST03–ST07) but ST03 cannot start until the corpus ingestion ADR is written.

### Why blocked

`SentenceContext` is the engine-ready shape. We have not designed:
1. **Raw authored form** — what a content author actually writes
2. **Transform boundary** — who converts raw → `SentenceContext` (build-time, runtime, or manual)
3. **Corpus storage** — where authoritative data lives (flat files, DB, mock fixtures derived from it)
4. **Impact on `SentenceContext` shape** — ingestion design may change the engine type

The mock corpus fixture (ST03) will bake in assumptions if this is unresolved. The ADR must come first.

### Next action

Write ADR: corpus authoring format + ingestion pipeline boundary.
Suggested filename: `product-documentation/architecture/YYYYMMDDTHHMMSSZ-engineering-sentence-corpus-ingestion.md`

Questions to resolve in the ADR:
- What is the raw authored form? (one record per sentence, one per word, structured text?)
- Does one sentence produce one `SentenceContext` or multiple (one per testable word)?
- Where does the raw→engine transform happen?
- Does this change any fields on `SentenceContext`?
