# EP26-DS04: Deck Overview with Sentence-by-Sentence Learning

**Date**: 20260702T185556Z
**Status**: Draft
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)

---

## 1. Feature Overview

A Deck Overview page inserted between deck selection and the quiz. Users reach it via a new [Overview] button on each deck row in `DeckSelector`. The page shows the conversation sentence-by-sentence (Thai + English), a word table with mastery progress and shelving status, and two alternative learning paths: a sentence-by-sentence mini-quiz and the existing full batch quiz. Shelved words display a [Try now] button that calls two new API endpoints to unshelve the word and reset its stagnation counter — allowing a mid-session retry without waiting for the next session boundary.

All read data is already available from existing endpoints (`GET /api/decks` returns `AppDeckPayload[]` with full `lines[]` and `words[]`; `GET /api/state` returns word states; `GET /api/shelving/words?deckId=X` returns shelved words). Only two new write endpoints are required.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Entry point | New [Overview] button on each deck row in `DeckSelector`; deck row click unchanged | Preserves fast path; overview is opt-in |
| Screen model | Add `'overview'` to `type Screen` in `App.vue` | Consistent with existing `'select' \| 'quiz' \| 'results'` pattern |
| Conversation display | Render `AppLinePayload[]` — `native` (Thai) + `english` per sentence | Data already in `AppDeckPayload.lines` |
| Mastery display | Filled/empty dots: `mastery / CONFIG.streakThresholds.maxMastery` | `maxMastery` already in config; no new field needed |
| Shelved word indicator | "Shelved" label + [Try now] button in word table Status column | Gives user agency before next session boundary |
| Manual unshelve action | `POST /api/shelving/unshelve-word` + `POST /api/stagnation/reset-words` | Single-word variants complement existing `unshelveAll` and `resetStagnationCounters` |
| Mastery on manual unshelve | Unchanged — word keeps its current mastery count | Only stagnation counter resets; mastery is earned |
| Sentence mini-quiz | `assembleBatch` scoped to one sentence's `wordIds`; up to 3 questions | Reuses engine without new logic; same mastery pipeline |
| Mastery write-back after mini-quiz | Same `saveWordState` + stagnation update + shelving reevaluation as `finishBatchAndTransition` | No divergent state paths |
| Word-to-sentence navigation | Click word in table → scroll to sentence(s) containing that word | `AppLinePayload.wordIds` provides the mapping |

---

## 3. Data Structures

```typescript
// No new types in @gll/api-contract for the read path — existing types suffice.

// New API request bodies (add to packages/api-contract/src/srs.ts):

export interface UnshelveWordRequest {
  deckId: string;
  wordId: string;
}

export interface ResetStagnationCountersForWordsRequest {
  deckId: string;
  wordIds: string[];
}

// New LearningStore methods (add to @gll/db LearningStore interface):

// unshelveWord(userId: string, deckId: string, wordId: string): void;
// resetStagnationCountersForWords(userId: string, deckId: string, wordIds: string[]): void;

// DeckOverview.vue props (internal to srs-demo):

// Props:
//   deck: AppDeckPayload
//   runState: RunState            — from App.vue globalRunState
//   shelvedSet: Set<string>       — from App.vue shelvedSet
//   wordPool: QuizItem[]          — from App.vue wordPool
//   maxMastery: number            — from CONFIG.streakThresholds.maxMastery
//
// Emits:
//   back: []
//   startQuiz: [deckId: string]
//   unshelveWord: [deckId: string, wordId: string]
```

---

## 4. User Workflows

### 4.1 Deck overview access

```
DeckSelector
  → user clicks [Overview] on a deck row
    → App.vue: screen = 'overview', overviewDeckId = deckId
      → DeckOverview renders

DeckOverview
  → [← Back]          → screen = 'select'
  → [Start full quiz] → initSession(deckId)  (same as clicking deck row)
  → [Learn sentence by sentence] → sentenceLearningActive = true
```

### 4.2 Manual unshelve

```
User clicks [Try now] for shelved word W
  → POST /api/shelving/unshelve-word   { deckId, wordId: W.id }
  → POST /api/stagnation/reset-words   { deckId, wordIds: [W.id] }
  → App.vue: shelvedSet.delete(W.id)
  → word row: status = "Active", [Try now] removed
```

### 4.3 Sentence-by-sentence learning

```
[Learn sentence by sentence]
  → currentSentenceIndex = 0

For each sentence:
  Display sentence (native + english)
    ↓
  assembleBatch(sentenceWords, wordPool, [], min(3, sentenceWords.length),
                { excludeIds: shelvedSet })
    ↓
  Mini-quiz (same QuizCard component, same onAnswered handler)
    ↓
  finishBatch → saveWordState + updateStagnationCounters + shelving reevaluation
    ↓
  [Next sentence →] or [Back to overview] (after last sentence)
```

---

## 5. Stories

### Phase 5: Deck Overview & Manual Unshelving (EP26-PH05)

### EP26-ST07: Deck Overview page scaffold

**Scope**: UI only — conversation display, word table, navigation wiring. No new write actions.

**Read List**:
- `apps/srs-demo/src/App.vue`
- `apps/srs-demo/src/components/DeckSelector.vue`
- `packages/api-contract/src/content.ts`
- `packages/api-contract/src/srs.ts`

**Tasks**:

- [ ] Add `'overview'` to `type Screen` and `overviewDeckId` ref in `App.vue`
- [ ] Add `@overview` emit to `DeckSelector.vue`; add [Overview] button to each deck row
- [ ] Create `DeckOverview.vue`: header, conversation panel (`AppLinePayload[]` rendered as sentence cards with Thai + English), word table (word, English, mastery dots, status)
- [ ] Implement word-to-sentence scroll: clicking word in table highlights sentence card(s) containing that `wordId`
- [ ] Wire [Start full quiz] to emit `startQuiz` → `App.vue` calls `initSession`
- [ ] Wire [← Back] to emit `back` → `App.vue` sets `screen = 'select'`

**Acceptance Criteria**:

- [ ] [Overview] button on each deck row; clicking it shows `DeckOverview` without starting a quiz
- [ ] Clicking the deck row directly still starts the quiz immediately (no regression)
- [ ] All conversation sentences display with Thai text and English translation
- [ ] Word table shows mastery dots and "Shelved" label for shelved words
- [ ] Clicking a word in the table scrolls to and highlights the sentence containing it
- [ ] [Start full quiz] and [← Back] navigate correctly

---

### EP26-ST08: Manual word unshelving

**Scope**: `LearningStore` methods, two new API endpoints, `useShelving` composable additions, [Try now] button wired end-to-end.

**Read List**:
- `apps/srs-demo/src/composables/useShelving.ts`
- `packages/api-contract/src/srs.ts`
- `packages/db/src/` (LearningStore interface + SQLite implementation)
- `apps/srs-demo-server/src/` (Hono route handlers)

**Tasks**:

- [ ] Add `unshelveWord` and `resetStagnationCountersForWords` to `LearningStore` interface and SQLite implementation in `@gll/db`
- [ ] Add `UnshelveWordRequest` and `ResetStagnationCountersForWordsRequest` to `packages/api-contract/src/srs.ts`
- [ ] Add `POST /api/shelving/unshelve-word` and `POST /api/stagnation/reset-words` Hono routes
- [ ] Add `unshelveWord` and `resetStagnationCountersForWords` functions to `useShelving.ts`
- [ ] Add [Try now] button to shelved word rows in `DeckOverview.vue`; on click: call both composable functions, emit `unshelveWord` to `App.vue`, update local status display

**Acceptance Criteria**:

- [ ] [Try now] button visible only on shelved words in the word table
- [ ] Clicking [Try now] calls both endpoints successfully; word row updates to "Active" and button disappears
- [ ] `shelvedSet` in `App.vue` is updated so the word is excluded from `excludeIds` on the next `assembleBatch` call
- [ ] Word mastery is unchanged after unshelving
- [ ] Unshelving is deck-scoped; unshelving in one deck does not affect another deck's shelved state

---

### EP26-ST09: Sentence-by-sentence learning mode

**Scope**: Sentence walker and mini-quiz harness within `DeckOverview.vue`. Reuses existing `assembleBatch`, `QuizCard`, `initBatchState`, `nextQuestion`, `submitBatchResult`, `finishBatch`, `saveWordState`, and the shelving pipeline from `finishBatchAndTransition`.

**Read List**:
- `apps/srs-demo/src/App.vue` (finishBatchAndTransition for pipeline reference)
- `apps/srs-demo/src/components/QuizCard.vue`
- `packages/srs-engine-v2/src/` (assembleBatch signature)

**Tasks**:

- [ ] Add `sentenceLearningActive`, `currentSentenceIndex`, `miniQuizBatchState`, `miniQuizCurrentQuestion` refs to `DeckOverview.vue`
- [ ] Implement sentence walker: display current sentence (Thai + English), then call `assembleBatch` with that sentence's words and `excludeIds: shelvedSet`
- [ ] Render `QuizCard` for mini-quiz questions; wire `onAnswered` → `submitBatchResult` → `nextQuestion` or `finishBatch`
- [ ] On mini-quiz completion: `saveWordState` for answered words, `updateStagnationCounters`, `getStagnantWords`, `evaluateShelving`, `applyShelving` if needed — same pipeline as `finishBatchAndTransition`
- [ ] Show [Next sentence →] after mini-quiz results; after final sentence show [Back to overview]
- [ ] Wire [Learn sentence by sentence] button to start walker at `currentSentenceIndex = 0`

**Acceptance Criteria**:

- [ ] [Learn sentence by sentence] steps through each sentence sequentially
- [ ] Each sentence displays Thai + English before its mini-quiz
- [ ] Mini-quiz question count = `min(3, sentenceWords.length)`
- [ ] Mini-quiz uses `excludeIds: shelvedSet` (shelved words not quizzed unless manually unshelved)
- [ ] Mastery updates and stagnation reevaluation run after each sentence's mini-quiz
- [ ] A word that is re-shelved after a sentence mini-quiz is excluded from subsequent sentence mini-quizzes in the same session
- [ ] After all sentences, user is returned to overview

---

## 6. Success Criteria

1. Deck overview accessible without starting a quiz; existing deck-click-to-quiz path unchanged
2. Shelved word status visible in overview; [Try now] unshelves mid-session with correct DB state
3. Sentence mini-quiz produces mastery updates indistinguishable from the main batch quiz pipeline
4. `pnpm typecheck` clean across monorepo
5. No regressions in existing EP26 BDD scenarios
