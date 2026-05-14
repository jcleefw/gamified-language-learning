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

## EP23 DS02 — Ready to start ST03

`composeSentenceBatch` design is complete (ST03–ST07). ST03 can start — `SentenceContext` shape is fully defined in DS02 §3 and the mock corpus fixture only needs real word ids from `mock-word-pool.ts`.

### Corpus ingestion ADR — needed before real corpus is authored

The ADR is not a blocker for ST03. It becomes a pre-condition before real (non-mock) sentence content is authored for production use.

Questions to resolve in the ADR:
- What is the raw authored form? (one record per sentence, one per word, structured text?)
- Does one sentence produce one `SentenceContext` or multiple (one per testable word)?
- Where does the raw→engine transform happen? (build-time, runtime, or manual)
- Does the ingestion design change any fields on `SentenceContext`?
- What is the `sentenceId` format and ownership? (who generates it, what namespace, is it stable across re-ingestion, does it encode any meaning e.g. language/deck/source?)

Suggested filename: `product-documentation/architecture/YYYYMMDDTHHMMSSZ-engineering-sentence-corpus-ingestion.md`
