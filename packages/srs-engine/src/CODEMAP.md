# CODEMAP.md — `packages/srs-engine/src/`

Source root navigation index. All public exports flow through `index.ts`.

**Update this file when**: source files are added, removed, or their exported API changes.

---

## Public API

| File | Purpose |
|------|---------|
| `index.ts` | Public entry point — re-exports all engine types and functions: `WordState`, `MasteryPhase`, `WordCategory`, `SrsConfig`, `QuizAnswer`, `FsrsCardState`, `QuestionType`, `Question`, `Batch`, `updateMastery`, `composeBatch`, `getEligibleWords`, `FsrsScheduler`, `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` |
| `types.ts` | Shared types across the package: `WordState`, `MasteryPhase`, `WordCategory`, `SrsConfig`, `QuizAnswer`, `FsrsCardState`, `QuestionType`, `Question`, `Batch` — includes EP05 extensions `batchesSinceLastProgress?`, `shelvedUntil?` |

---

## Domain Modules

| File | Purpose |
|------|---------|
| `mastery.ts` | `updateMastery(state, isCorrect, config)` — pure function: mastery counting, Learning→srsM2_review promotion at threshold, lapse reset after 3 lapses |
| `batch.ts` | `composeBatch(wordStates, config, options?)` — batch composition with priority ordering (carry-over → foundational revision → new words → foundational learning) and question type distribution (70% MC, 20% word-block, 10% audio); audio folds to MC when unavailable |
| `active-window.ts` | `getEligibleWords(allWords, config)` — identifies active words (srsM2_review phase), calculates new-word slots, filters eligible candidates |
| `stuck-words.ts` | `detectStuckWords()`, `shelveWord()`, `unshelveWord()`, `isShelved()` — stuck word detection and shelving logic; max-2 shelved cap |

---

## Subdomains

| Folder | Purpose |
|--------|---------|
| `scheduling/` | FSRS scheduling implementation → see [scheduling/CODEMAP.md](scheduling/CODEMAP.md) |
