# EP08 - Terminal Quiz Runner + Seed Data

**Created**: 20260306T014133Z
**Status**: Draft
**Status Changed**: 20260306T014133Z
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: EP07
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The SRS engine is pure logic with no observable output until something calls it end-to-end. A terminal runner is needed to prove the engine works as a complete system — batch composition → user answers → mastery update → repeat — and to validate that the engine API is ergonomic for the calling layer. The seed data shapes it produces will inform the future database schema (organic discovery).

## Scope

**In scope**:
- Seed data from real sample files: `data/samples/foundations-consonants.ts` (44 Thai consonants) and `data/samples/conversations-2026-03-08.json` (conversation decks with `uniqueWords`)
- Content type definitions (`FoundationalCharacter`, `Conversation`, `ConversationWord` — language-agnostic) and mapper functions that transform raw content → `WordState[]`
- `scripts/quiz-runner.ts` — terminal script using `tsx`; composes a batch, accepts answers (stdin preferred; hardcoded fallback acceptable), prints updated mastery states, loops to next batch
- Demonstrates: carry-over words, stuck word shelving, phase transition (Learning → ANKI)
- All data in-memory — no database, no network, no file persistence

**Out of scope**:
- Pretty terminal UI (chalk/ink) — plain `console.log` is sufficient
- Saving quiz state between process runs — in-memory only
- Full conversation breakdown/component rendering — only `uniqueWords` used for quiz words

---

## Stories

### EP08-ST01: Content types + seed data mappers
**Scope**: Define `FoundationalCharacter`, `Conversation`, `ConversationWord` types (language-agnostic) in `packages/srs-engine/data/`; implement mapper functions (`characterToWordState`, `conversationWordsToWordStates`, `slugifyWord`) that transform real sample files into `WordState[]`; unit tests for mappers; only 5 consonants for the foundational deck

### EP08-ST02: Terminal quiz runner
**Scope**: Implement `scripts/quiz-runner.ts` — instantiate `SrsEngine` with default config, load real seed data via mappers, loop: `composeBatch` → print questions → accept stdin answers → `processAnswers` → print updated states; run at least 3 batch iterations to demonstrate carry-over and phase progression; `pnpm run quiz` (or `tsx scripts/quiz-runner.ts`) executes it

---

## Overall Acceptance Criteria

- [ ] `tsx scripts/quiz-runner.ts` runs without errors
- [ ] A full batch of 15 questions is composed from seed data
- [ ] Answers are accepted (stdin or hardcoded) and processed
- [ ] Updated mastery states are printed after each batch
- [ ] At least one word demonstrates carry-over across batches
- [ ] At least one word demonstrates Learning → ANKI phase transition across the session
- [ ] All data remains in-memory (no files written, no network calls)

---

## Dependencies

- EP07 (SrsEngine class with `composeBatch` + `processAnswers`)

## Next Steps

1. Review and approve this epic
2. Decide: stdin answers vs. hardcoded scenario (open question from roadmap — stdin preferred)
3. Create Design Spec for seed data shape + runner loop structure
4. Begin ST01 (seed data) → ST02 (runner)
