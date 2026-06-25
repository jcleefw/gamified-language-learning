# EP31-DS02: Sentence Question (Word-Block) in srs-demo

**Date**: 20260625T014601Z
**Status**: Impl-Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)

---

## 1. Feature Overview

Add word-block sentence questions to `apps/srs-demo`. After a user has seen each word in a sentence at least `minSeenForSentence` times, that sentence becomes eligible and is injected into the next batch via `assembleBatch`'s `extraThunks` hook. The user drags/taps tiles to arrange them in the correct order and submits. Sentence run-state (`SentenceRunState`) is in-memory only for this epic — persistence is deferred.

The engine already has everything needed (`composeSentenceBatch`, `resolveEligibleContexts`, `updateSentenceRunState`, `SentenceQuestion` type). This spec wires those into the Vue app and implements the missing UI.

**QuizCard placeholder replaced**:

```
v-else-if="question.kind === 'word-block'" → full tile-bank interaction
```

**Sentence state lifecycle**:

```
startBatch()
  └─ resolveEligibleContexts(corpus, runState, wordPool, sentenceRunState, batchNum, config)
       └─ inject extraThunks → assembleBatch picks one question per eligible sentence

onAnswered(SentenceQuizResult)
  └─ updateSentenceRunState(sentenceRunState, [result], batchNum, config)

finishBatchAndTransition()
  └─ advanceAdaptiveSession (word results only — sentence results already handled above)
```

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Sentence eligibility gate | `minSeenForSentence` in `CONFIG.sentenceScheduling` (demo default: `1`) | Configurable; demo value unlocks sentences after one batch for quick demonstration |
| Batch gap between repeats | `sentenceBatchGap` in `CONFIG.sentenceScheduling` (demo default: `2`) | Configurable; prevents sentence flooding across consecutive batches |
| Graduation threshold | `sentenceCorrectStreakThreshold` in `CONFIG.sentenceGraduation` (demo default: `2`) | Configurable |
| Wrong-streak shelve | `sentenceWrongStreakThreshold` in `CONFIG.sentenceGraduation` (demo default: `3`) | Configurable |
| Directions per sentence | All 3 (`english-to-native`, `romanization-to-native`, `native-to-romanization`) by default; controlled by `CONFIG.sentenceDirections` | Directions map to difficulty levels — all three enabled by default; operators can restrict to a subset |
| Questions per sentence per batch | One thunk per eligible sentence × one question per configured direction | Each eligible sentence contributes `sentenceDirections.length` questions; `assembleBatch` shuffle interleaves them with word questions |
| Sentence state persistence | In-memory only (`ref<SentenceRunState>`) | Deferred — word state persistence (DS01) is the EP31 goal; sentences have no DB table yet |
| Corpus source | `linesToSentenceCorpus(deck: AppDeck): SentenceContext[]` in `transformer.ts` | Converts `AppLine[]` — no new data format needed |
| Tile interaction | Click-to-add/remove **and** HTML5 drag-and-drop — both supported | Click covers mobile/keyboard; drag-and-drop enables reordering within the answer area |
| Cheat mode hint | `.cheat-hint` on sentence questions shows correct `wordId[]` order | BDD tests use click (not drag) to auto-answer |

---

## 3. Data Structures

```typescript
// transformer.ts — new helper (no engine changes needed)
import type { SentenceContext } from '@gll/srs-engine-v2';
import type { AppDeck } from './types';

export function linesToSentenceCorpus(deck: AppDeck): SentenceContext[] {
  return deck.lines.map((line) => ({
    sentenceId: line.sentenceId,
    englishSentence: line.english,
    wordOrder: line.words.map((w) => w.id),
  }));
}

// App.vue — additions to SessionConfig
const CONFIG = {
  // ...existing fields
  sentenceScheduling: {
    minSeenForSentence: 1,      // lower = sentences unlock sooner (demo: 1)
    sentenceBatchGap: 2,        // batches between sentence repeats
  },
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: 2,
    sentenceWrongStreakThreshold: 3,
  },
  // Directions to use per sentence — maps to difficulty levels.
  // All three enabled by default; restrict to subset for easier sessions.
  sentenceDirections: [
    'english-to-native',
    'romanization-to-native',
    'native-to-romanization',
  ] as SentenceQuestion['direction'][],
};

// App.vue — new refs
const sentenceRunState = ref<SentenceRunState>(new Map());
const batchNum = ref(0);
const sentenceCorpus = computed<SentenceContext[]>(() => {
  const deck = appDecks.find((d) => d.id === deckId.value);
  return deck ? linesToSentenceCorpus(deck) : [];
});

// QuizCard.vue — tile interaction state (local, not emitted)
const selectedTiles = ref<SentenceTile[]>([]);   // user's current ordering (answer area)
const remainingTiles = ref<SentenceTile[]>([]);  // tiles not yet placed (tile bank)
// Both areas support click AND drag-and-drop:
//   click tile in bank → appends to answer area
//   click tile in answer area → returns to bank
//   drag tile from bank → drop into answer area at position
//   drag tile within answer area → reorder in place
//   drag tile from answer area → drop back to bank
```

---

## 4. User Workflows

```
startBatch()
  ├─ resolveEligibleContexts(...)
  │    └─ returns [] until each word seen >= minSeenForSentence
  └─ assembleBatch(active, wordPool, [], wordsPerBatch, {
         extraThunks: eligible.flatMap(({ ctx, tiles }) =>
           CONFIG.sentenceDirections.map((dir) =>
             () => composeSentenceBatch(ctx, tiles, 'th').filter(q => q.direction === dir)
           )
         )
       })
       └─ batchNum++ after each batch starts

WORD-BLOCK QUESTION (QuizCard.vue)
  ├─ PROMPT: question.prompt (direction-appropriate: English, romanization, or native)
  ├─ ANSWER AREA (.answer-area): selectedTiles (empty initially)
  │    ├─ click tile → returns to bank
  │    ├─ drag tile → reorder within answer area
  │    └─ drag tile out → returns to bank
  ├─ TILE BANK (.tile-bank): remainingTiles (shuffled by engine)
  │    ├─ click tile → appends to answer area
  │    └─ drag tile → drop onto answer area at target position
  └─ SUBMIT button (enabled when remainingTiles.length === 0)
       └─ compare selectedTiles[].wordId vs question.answer[]
       └─ emit answered({ sentenceId, correct })

onAnswered(result: SentenceQuizResult)
  └─ updateSentenceRunState(sentenceRunState.value, [result], batchNum.value, config)
  └─ submitBatchResult(batchState.value, result)
  └─ isBatchDone? → finishBatchAndTransition | nextQuestion

CLEAR
  └─ sentenceRunState.value = new Map()
  └─ batchNum.value = 0
```

---

## 5. Stories

### EP31-ST06: Sentence corpus transformer

**Scope**: Add `linesToSentenceCorpus` to `apps/srs-demo/src/data/transformer.ts`. No engine changes.

**Read List**:
- `apps/srs-demo/src/data/transformer.ts`
- `apps/srs-demo/src/data/types.ts`
- `packages/srs-engine-v2/src/types/sentence.ts` (`SentenceContext`)

**Tasks**:
- [ ] Add `linesToSentenceCorpus(deck: AppDeck): SentenceContext[]` to `transformer.ts`
  - Maps `deck.lines` → `SentenceContext[]` using `line.sentenceId`, `line.english`, `line.words.map(w => w.id)`
- [ ] `vue-tsc --noEmit` passes

**Acceptance Criteria**:
- [ ] `linesToSentenceCorpus(eatDeck)` returns 4 contexts with correct `sentenceId`, `englishSentence`, `wordOrder`
- [ ] `wordOrder` entries match the `id` field of each `AppWord` in the line's `words` array

---

### EP31-ST07: Wire sentence scheduling into `App.vue`

**Scope**: Add `sentenceRunState`, `batchNum`, `sentenceCorpus`; inject sentence thunks into `assembleBatch`; handle `SentenceQuizResult` in `onAnswered`; reset on clear.

**Read List**:
- `apps/srs-demo/src/App.vue`
- `packages/srs-engine-v2/src/engine/sentence-scheduling.ts` (`resolveEligibleContexts`, `updateSentenceRunState`)
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts` (`composeSentenceBatch`)
- `packages/srs-engine-v2/src/index.ts` (check exports)

**Tasks**:
- [ ] Add to imports from `@gll/srs-engine-v2`: `resolveEligibleContexts`, `updateSentenceRunState`, `composeSentenceBatch`, `SentenceRunState`
- [ ] Import `linesToSentenceCorpus` from `./data/transformer`
- [ ] Add refs: `sentenceRunState = ref<SentenceRunState>(new Map())`, `batchNum = ref(0)`
- [ ] Add computed `sentenceCorpus`: `appDecks.find(d => d.id === deckId.value)` → `linesToSentenceCorpus(deck)` or `[]`
- [ ] Extend `CONFIG` with `sentenceScheduling`, `sentenceGraduation`, and `sentenceDirections` (see §3)
- [ ] In `startBatch()`: call `resolveEligibleContexts(...)`, build `extraThunks` via `flatMap` over `CONFIG.sentenceDirections` (one thunk per sentence × direction), pass to `assembleBatch`; increment `batchNum.value` after batch starts
- [ ] In `onAnswered()`: if result has `sentenceId`, call `updateSentenceRunState(sentenceRunState.value, [result as SentenceQuizResult], batchNum.value, CONFIG.sentenceGraduation)` before `submitBatchResult`
- [ ] In `onClear()`: reset `sentenceRunState.value = new Map()`, `batchNum.value = 0`
- [ ] `vue-tsc --noEmit` passes

**Acceptance Criteria**:
- [ ] After answering words at least `minSeenForSentence` times, the next batch contains a sentence question
- [ ] Answering a sentence question correctly increments `sentenceStreak` in `sentenceRunState`
- [ ] Clear resets sentence state
- [ ] `batchNum` increments once per batch

---

### EP31-ST08: Word-block UI in `QuizCard.vue`

**Scope**: Replace the `word-block` placeholder with a working tile-bank interaction. Emit `SentenceQuizResult` on submit.

**Read List**:
- `apps/srs-demo/src/components/QuizCard.vue`
- `packages/srs-engine-v2/src/types/quiz.ts` (`SentenceQuestion`, `SentenceTile`, `SentenceQuizResult`)

**Tasks**:
- [ ] In script: add `selectedTiles = ref<SentenceTile[]>([])` and `remainingTiles = ref<SentenceTile[]>([])`
- [ ] In `watch(question)`: if `question.kind === 'word-block'`, reset `selectedTiles = []` and `remainingTiles = [...question.tiles]`
- [ ] Add `addTile(tile, index?)`: inserts tile into `selectedTiles` at `index` (append if omitted), removes from `remainingTiles`
- [ ] Add `removeTile(tile, returnIndex?)`: removes from `selectedTiles`, inserts into `remainingTiles` at `returnIndex` (append if omitted)
- [ ] Add `reorderAnswerTile(from, to)`: moves tile within `selectedTiles` by index (used by drag reorder)
- [ ] Add `submitSentence()`: compare `selectedTiles.map(t => t.wordId)` vs `question.answer`; emit `answered({ sentenceId: question.sentenceId, correct })`; set `answered = true`
- [ ] Wire **click** handlers: click in bank → `addTile`; click in answer area → `removeTile`
- [ ] Wire **drag-and-drop** (`draggable="true"` on all `.tile-chip` elements):
  - `dragstart` → store dragged tile reference + source (`bank` | `answer`)
  - Drop on `.answer-area` → `addTile(tile, dropIndex)` or `reorderAnswerTile(from, to)`
  - Drop on `.tile-bank` → `removeTile(tile)` (returns to bank)
  - Visual: `dragover` adds `.drag-over` class on drop targets; `dragleave` removes it
- [ ] In template, replace placeholder with:
  - `.sentence-prompt`: shows `question.prompt`
  - `.answer-area`: renders `selectedTiles` as `.tile-chip` elements with drag handles
  - `.tile-bank`: renders `remainingTiles` as `.tile-chip` elements
  - Submit button (disabled until `remainingTiles.length === 0` or `answered`)
- [ ] Each `.tile-chip` carries `data-word-id` attribute (used by BDD selector)
- [ ] In cheat mode: render `.cheat-hint` showing correct `question.answer.join(' → ')`
- [ ] Styles: scoped CSS for `.answer-area`, `.tile-bank`, `.tile-chip`, `.drag-over`
- [ ] `vue-tsc --noEmit` passes

**Acceptance Criteria**:
- [ ] Sentence question renders tiles in shuffled order
- [ ] Click: tile in bank moves to answer area; tile in answer area returns to bank
- [ ] Drag: tile from bank can be dropped into answer area at a specific position
- [ ] Drag: tile within answer area can be reordered by dragging
- [ ] Drag: tile from answer area can be dragged back to bank
- [ ] Submit is only enabled when all tiles are placed
- [ ] Correct arrangement emits `{ sentenceId, correct: true }`; wrong arrangement emits `{ sentenceId, correct: false }`
- [ ] In cheat mode, `.cheat-hint` shows the correct word order
- [ ] All `.tile-chip` elements have `data-word-id` attribute

---

### EP31-ST09: BDD test — sentence question flow

**Scope**: New `sentence-question.feature` + step file. Tests that sentences unlock and can be answered correctly.

**Read List**:
- `apps/srs-demo/e2e/features/session-mastery.feature`
- `apps/srs-demo/e2e/steps/session-mastery.steps.ts`
- `apps/srs-demo/playwright.config.ts` (or equivalent BDD config)

**Tasks**:
- [ ] Create `apps/srs-demo/e2e/features/sentence-question.feature`
- [ ] Create `apps/srs-demo/e2e/steps/sentence-question.steps.ts`
- [ ] Implement `answerSentenceCorrectly(page)` helper:
  - Read `.cheat-hint` text to get correct wordId order
  - Click `.tile-bank .tile-chip` elements in that order (match by `data-word-id` or text)
  - Click Submit
- [ ] Implement step: `When I answer all sentences in the batch correctly` using the helper
- [ ] Run `pnpm --filter apps/srs-demo test:e2e` — feature passes

**Scenarios**:

```gherkin
Feature: Sentence question word-block

  Background:
    Given the app is open with a clean session

  Scenario: Sentence questions appear after words have been seen
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    Then I should see a sentence question in the batch

  Scenario: Answering a sentence question correctly records the result
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I answer all sentences in the batch correctly
    Then I should see the batch results screen
    And I should not see any sentence questions from the same sentence in this batch
```

**Acceptance Criteria**:
- [ ] After one correct batch, sentence questions appear in the next batch
- [ ] BDD helper can auto-answer sentence questions using cheat-hint
- [ ] Sentence results screen is reached without error
- [ ] Both scenarios pass in CI

---

## 6. Success Criteria

1. After completing one batch of word questions, at least one sentence question appears in the next batch
2. A word-block question renders tiles; user can arrange and submit; correct/wrong result is emitted
3. Cheat mode `.cheat-hint` on sentence questions exposes the correct answer for BDD automation
4. `sentenceRunState` updates correctly — answered sentences don't reappear until `sentenceBatchGap` batches later
5. `vue-tsc --noEmit` passes with no new type errors
6. Both BDD scenarios pass (`pnpm --filter apps/srs-demo test:e2e`)
7. EP31-DS01 features (persistence, clear, resume) are unaffected
