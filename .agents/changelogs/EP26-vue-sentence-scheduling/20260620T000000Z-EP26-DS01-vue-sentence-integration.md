# EP26-DS01: Vue App Sentence Integration & Word-Block UI

**Date**: 20260620T000000Z
**Status**: Draft
**Epic**: EP26 - Vue SRS Demo: Sentence Scheduling & Word-Block Questions

---

## 1. Feature Overview

EP25 completed the engine foundation: `SentenceState` type, sentence scheduling functions (`resolveEligibleContexts`, `updateSentenceRunState`), and the composer registry for batch assembly. EP26 integrates these into the Vue app (`apps/srs-demo`). The Vue session loop now tracks `SentenceRunState`, derives sentence corpus from deck lines, and renders word-block questions via a new `WordBlock.vue` component.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `sentenceId` on line | Add `sentenceId: string` to `MockLine` and `AppLine`; author stable IDs in data files | Position-derived IDs break persistence when deck order changes; must be stable and authored |
| Sentence corpus source | Derive `SentenceContext[]` from deck lines via `buildSentenceCorpus(decks)` in `transformer.ts` | Single source of truth; eliminates `mock-sentence-corpus.ts` duplication |
| `mock-sentence-corpus.ts` | Delete after engine demo is updated to derive corpus from `mockDecks` | No longer the source of truth |
| `resolveEligibleContexts` location | Move from `demo/learning-io.ts` into engine (`src/engine/sentence-scheduling.ts`); export from `src/index.ts` | Pure scheduling logic with no data/IO dependency — belongs in engine; CLI and Vue share one implementation |
| `updateSentenceRunState` location | Same — move to engine alongside `resolveEligibleContexts` | Same rationale |
| Corpus parameter | `resolveEligibleContexts` receives `corpus: SentenceContext[]` as first param (caller-provided) | Removes hardcoded `mockSentenceCorpus` import; makes function portable across hosts |
| `debugSentenceEligibility` | Remove from `resolveEligibleContexts`; drop the branch entirely | Debug flag has no place in engine logic; caller can pass a filtered corpus if needed |
| `sentenceRunState` ownership | `ref<SentenceRunState>(new Map())` inside `App.vue` | Session concern; reset on `initSession` and `onClear` |
| `sentenceRunState` persistence | **Deferred** — `useSession` does not serialise it; add TODO comment | Session-local for now; DB persistence is a separate story |
| Word-block UI | New `WordBlock.vue` component; `QuizCard` renders it when `question.kind === 'word-block'` | Keeps `QuizCard` free of tile-ordering layout logic |
| `onAnswered` routing | No change — `QuizResult` union already covers `SentenceQuizResult` | Existing handler is correct |

---

## 3. Data Structures

### `sentenceId` added to line types

```ts
// packages/srs-engine-v2/src/types/deck.ts
export interface MockLine {
  sentenceId: string;   // NEW — authored stable ID, e.g. 'sent::eat-001'
  speaker: 'A' | 'B';
  // ... existing fields unchanged
}

// apps/srs-demo/src/data/types.ts
export interface AppLine {
  sentenceId: string;   // NEW — mirrors MockLine
  speaker: 'A' | 'B';
  // ... existing fields unchanged
}
```

### New engine module: `src/engine/sentence-scheduling.ts`

```ts
export function resolveEligibleContexts(
  corpus: SentenceContext[],         // caller-provided — no hardcoded data dep
  runState: RunState,
  allPool: QuizItem[],
  sentenceRunState: SentenceRunState,
  batchNum: number,
): { ctx: SentenceContext; tiles: SentenceTile[] }[]

export function updateSentenceRunState(
  sentenceRunState: SentenceRunState,
  results: SentenceQuizResult[],
  batchNum: number,
  config: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  },
): SentenceRunState
```

Both exported from `src/index.ts`.

### New transformer: `buildSentenceCorpus`

```ts
// apps/srs-demo/src/data/transformer.ts (addition)
export function buildSentenceCorpus(decks: AppDeck[]): SentenceContext[] {
  return decks.flatMap(deck =>
    deck.lines.map(line => ({
      sentenceId: line.sentenceId,
      englishSentence: line.english,
      wordOrder: line.words.map(w => w.id),
    }))
  );
}
```

Equivalent function for CLI demo in engine's `demo/` or inline in `runBatch`.

### New `ref` in `App.vue`

```ts
const sentenceRunState = ref<SentenceRunState>(new Map());
const sentenceCorpus = buildSentenceCorpus(appDecks);  // derived once at module init
```

### `WordBlock.vue` props/emits

```ts
defineProps<{
  question: SentenceQuestion;
  index: number;
  total: number;
}>();
defineEmits<{ answered: [result: QuizResult] }>();
```

---

## 4. Session Workflow

```
initSession / onClear
  └─ sentenceRunState.value = new Map()

startBatch (per batch)
  └─ resolveEligibleContexts(
       sentenceCorpus, sessionState.runState, wordPool,
       sentenceRunState.value, sessionState.batchNum + 1
     )
     → extraThunks: () => composeSentenceBatch(ctx, tiles, 'th', { shuffle: true })
  └─ assembleBatch(active, wordPool, [], wordsPerBatch, { extraThunks })

finishBatchAndTransition (after batch)
  └─ sentenceResults = output.results.filter(r => 'sentenceId' in r)
  └─ sentenceRunState.value = updateSentenceRunState(
       sentenceRunState.value, sentenceResults, sessionState.batchNum, CONFIG
     )

QuizCard renders word-block questions
  └─ <WordBlock> component: tile-ordering UI, emits SentenceQuizResult
```

---

## 5. Stories

### EP25-ST11: Add `sentenceId` to line types + derive corpus from deck

**Scope**: Data model change and corpus derivation. No logic changes yet. Prerequisite for all other stories.

**Read List**:
- `packages/srs-engine-v2/src/types/deck.ts` — `MockLine`
- `packages/srs-engine-v2/data/mock/mock-decks.ts` — all `MockLine` instances to author IDs
- `apps/srs-demo/src/data/types.ts` — `AppLine`
- `apps/srs-demo/src/data/decks.ts` — all `AppLine` instances to author IDs
- `apps/srs-demo/src/data/transformer.ts` — add `buildSentenceCorpus`

**Tasks**:
- [ ] Add `sentenceId: string` to `MockLine` in `src/types/deck.ts`
- [ ] Author stable `sentenceId` values on every line in `mock-decks.ts` (e.g. `sent::eat-001`, `sent::eat-002`, `sent::weather-001`, …)
- [ ] Add `sentenceId: string` to `AppLine` in `apps/srs-demo/src/data/types.ts`
- [ ] Author matching `sentenceId` values on every line in `apps/srs-demo/src/data/decks.ts`
- [ ] Add `buildSentenceCorpus(decks: AppDeck[]): SentenceContext[]` to `transformer.ts`
- [ ] Delete `packages/srs-engine-v2/data/mock/mock-sentence-corpus.ts`
- [ ] Update `learning-io.ts` to derive corpus from `mockDecks` (inline or via a parallel helper) and remove `mockSentenceCorpus` import

**Acceptance Criteria**:
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` green (existing sentence-spacing tests still pass — `SentenceContext` shape unchanged)
- [ ] `mock-sentence-corpus.ts` no longer exists

---

### EP25-ST12: Move `resolveEligibleContexts` + `updateSentenceRunState` to engine

**Scope**: Extract both functions from `demo/learning-io.ts` into `src/engine/sentence-scheduling.ts`. Make corpus a parameter; remove `debugSentenceEligibility` branch. Export from `src/index.ts`. Update CLI demo imports.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts` — current implementations (lines ~232–319)
- `packages/srs-engine-v2/demo/config.ts` — `LEARNING_CONFIG` shape (for config param type)
- `packages/srs-engine-v2/src/index.ts` — export list

**Tasks**:
- [ ] Create `src/engine/sentence-scheduling.ts` with `resolveEligibleContexts(corpus, runState, allPool, sentenceRunState, batchNum)` and `updateSentenceRunState(sentenceRunState, results, batchNum, config)`
- [ ] Remove `debugSentenceEligibility` branch from `resolveEligibleContexts`
- [ ] Export both functions from `src/index.ts`
- [ ] Update `demo/learning-io.ts`: remove the two function definitions; import from engine; pass derived corpus as first arg to `resolveEligibleContexts`
- [ ] Update existing sentence-spacing unit tests: import from engine path; pass corpus explicitly

**Acceptance Criteria**:
- [ ] `pnpm typecheck` clean
- [ ] All existing sentence-spacing tests pass with new import path and explicit corpus param
- [ ] `demo/learning-io.ts` no longer defines `resolveEligibleContexts` or `updateSentenceRunState`

---

### EP25-ST13: Wire sentence scheduling into `App.vue` session loop

**Scope**: Add `sentenceRunState` ref; call `resolveEligibleContexts` in `startBatch`; call `updateSentenceRunState` in `finishBatchAndTransition`; reset in `initSession` and `onClear`. No UI changes.

**Read List**:
- `apps/srs-demo/src/App.vue` — `startBatch`, `finishBatchAndTransition`, `initSession`, `onClear`
- `apps/srs-demo/src/composables/useSession.ts` — to add TODO for future persistence

**Tasks**:
- [ ] Import `resolveEligibleContexts`, `updateSentenceRunState`, `SentenceRunState`, `SentenceQuizResult`, `composeSentenceBatch` from `@gll/srs-engine-v2`
- [ ] Import `buildSentenceCorpus` from `./data/transformer`
- [ ] Derive `sentenceCorpus` once at module level: `const sentenceCorpus = buildSentenceCorpus(appDecks)`
- [ ] Add `const sentenceRunState = ref<SentenceRunState>(new Map())`
- [ ] `startBatch`: call `resolveEligibleContexts`; build `extraThunks`; pass to `assembleBatch`
- [ ] `finishBatchAndTransition`: filter `SentenceQuizResult`; call `updateSentenceRunState`
- [ ] `initSession` and `onClear`: reset `sentenceRunState.value = new Map()`
- [ ] Add `// TODO(DS04/persistence): serialise sentenceRunState in useSession when DB lands` in `useSession.ts`

**Acceptance Criteria**:
- [ ] `pnpm typecheck` clean
- [ ] Session starts and completes a batch without throwing
- [ ] Sentence question appears after words have been seen (verified manually via `VITE_CHEAT_MODE`)

---

### EP25-ST14: `WordBlock.vue` component + `QuizCard` integration

**Scope**: New `WordBlock.vue` tile-ordering UI. `QuizCard.vue` replaces the "coming soon" stub.

**Read List**:
- `apps/srs-demo/src/components/QuizCard.vue` — stub location, answer emit pattern, existing styles
- `packages/srs-engine-v2/src/types/quiz.ts` — `SentenceQuestion`, `SentenceTile`, `SentenceQuizResult`

**Tasks**:
- [ ] Create `apps/srs-demo/src/components/WordBlock.vue`:
  - Props: `question: SentenceQuestion`, `index: number`, `total: number`
  - Emits: `answered: [result: QuizResult]`
  - Display: `question.prompt` as heading; tiles as buttons in `question.tiles` order
  - Interaction: tap tiles to build answer sequence; submit button confirms; tiles already used are visually distinct
  - On submit: compare selected `wordId[]` against `question.answer`; emit `{ sentenceId: question.sentenceId, correct: wasCorrect }`
  - Feedback: show correct/wrong state after submission before emit (matches MCQ pattern in `QuizCard`)
- [ ] `QuizCard.vue`: replace stub with `<WordBlock :question="(question as SentenceQuestion)" :index="index" :total="total" @answered="emit('answered', $event)" />`; import `WordBlock`

**Acceptance Criteria**:
- [ ] `pnpm typecheck` clean
- [ ] Tiles render in shuffled order from `question.tiles`
- [ ] Correct tile order → `correct: true` emitted
- [ ] Wrong tile order → `correct: false` emitted
- [ ] Cheat mode panel unaffected

---

## 6. Resolved Design Questions

| # | Question | Resolution |
|---|----------|------------|
| OQ1 | Sentence corpus source — cross-package import vs duplication | **Option A**: add `sentenceId` to `MockLine`/`AppLine`; derive corpus via `buildSentenceCorpus` in `transformer.ts`; delete `mock-sentence-corpus.ts`. Stable authored IDs survive persistence and deck reordering. |
| OQ2 | `resolveEligibleContexts`/`updateSentenceRunState` not importable from Vue | **Move to engine** (`src/engine/sentence-scheduling.ts`): corpus passed as parameter, `debugSentenceEligibility` removed, exported from `src/index.ts`. CLI and Vue share one implementation. |
| OQ3 | `sentenceRunState` not persisted across page reload | **Deferred**: session-local for now; TODO comment in `useSession.ts` marks the gap for when DB persistence lands. |

---

## 7. Success Criteria

| # | Criterion |
|---|-----------|
| 1 | `sentenceId` is authored on every deck line; corpus derives from it with no duplication |
| 2 | `resolveEligibleContexts` and `updateSentenceRunState` live in the engine and are importable by any host |
| 3 | Sentence questions appear in the Vue quiz when eligibility gates pass |
| 4 | Back-to-back sentence repeats suppressed (batch-gap gate) |
| 5 | Sentence disappears after `sentenceCorrectStreakThreshold` correct answers |
| 6 | Sentence disappears after `sentenceWrongStreakThreshold` consecutive wrong answers |
| 7 | Word-block tiles render; correct/wrong order emits correct result |
| 8 | `pnpm typecheck` clean; all existing tests green |
