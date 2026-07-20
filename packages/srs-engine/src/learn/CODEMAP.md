# CODEMAP.md — `src/learn/`

The `learn` subpath export (`@gll/srs-engine/learn`) — quiz composition,
adaptive session orchestration, batch queue, mastery/recheck, and sentence
scheduling. Navigate to subfolder CODEMAPs for implementation detail.

---

## Files

| File | Purpose |
| --- | --- |
| `index.ts` | Public barrel — re-exports everything below plus `src/config/language.ts`'s `LANGUAGE_CONFIG` |

---

## Subfolders

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `src/learn/engine/` | Pure session/batch/composition logic | [CODEMAP](engine/CODEMAP.md) |
| `src/learn/types/` | TypeScript definitions for the `learn` domain | [CODEMAP](types/CODEMAP.md) |
| `src/learn/utils/` | Small generic helpers (shuffle) | [CODEMAP](utils/CODEMAP.md) |

---

## `index.ts` re-export map

| Re-exported from | Symbols |
| --- | --- |
| `./utils/shuffle.js` | `shuffle` |
| `./engine/compose-word-batch.js` | `composeWordBatch`, `composeWordBatchMulti`, `composeWordBatchItems`, `FOUNDATIONAL_DIRECTIONS`, type `QuizItem` |
| `./engine/compose-sentence-batch.js` | `composeSentenceBatch` |
| `./engine/compose-registry.js` | `createComposerRegistry`, `assembleBatchQuestions`, type `ComposerRegistry` |
| `./engine/session.js` | `processRecheckResult`, `classifyRechecks`, `nextActivePool`, `updateMasteryState`, `getNewlyMasteredIds`, types `RecheckResultOutput`, `MasteryUpdateResult` |
| `./engine/adaptive-session.js` | `initAdaptiveSession`, `advanceAdaptiveSession`, types `AdaptiveSessionState`, `SessionConfig` |
| `./engine/batch-queue.js` | `initBatchState`, `nextQuestion`, `submitBatchResult`, `finishBatch`, `isBatchDone`, types `BatchOutput`, `BatchState` |
| `./engine/assemble-batch.js` | `assembleBatch`, type `AssembleBatchOptions` |
| `./engine/validate-batch.js` | `validateBatch`, types `BatchConstraints`, `BatchValidation`, `BatchViolation` |
| `./types/word-state.js` | `updateRunState`, `isMastered`, types `WordState`, `RunState`, `StreakThresholds`, `GraduationHook` |
| `./types/sentence-state.js` | `defaultSentenceState`, types `SentenceState`, `SentenceRunState` |
| `./engine/sentence-scheduling.js` | `resolveEligibleContexts`, `updateSentenceRunState` |
| `./types/quiz.js` | types `QuizQuestion`, `MCQQuestion`, `SentenceQuestion`, `SentenceTile`, `QuizChoice`, `QuizDirection`, `QuizResult`, `WordQuizResult`, `SentenceQuizResult` |
| `./types/sentence.js` | type `SentenceContext` |
| `../config/language.js` | `LANGUAGE_CONFIG`, types `LanguageConfig`, `WordJoin` |
| `./types/deck.js` | types `MockDeck`, `MockLine` |
| `./types/foundational.js` | types `MockFoundational`, `ThaiFoundational`, `MockVowel`, `MockTone`, `ThaiFoundationalType`, `JapaneseFoundationalType` |
