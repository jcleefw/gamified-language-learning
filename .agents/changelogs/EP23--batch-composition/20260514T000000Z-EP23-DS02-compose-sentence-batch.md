# EP23-DS02: `composeSentenceBatch` — Word-Block Sentence Composer

**Date**: 20260514T000000Z
**Status**: Proposed
**Epic**: EP23 — Batch Composition

---

## 1. Feature Overview

DS01 established the `QuizQuestion = MCQQuestion | SentenceQuestion` union type. DS02 implements `composeSentenceBatch` — the sentence-level composer for word-block construction questions — and wires each direction into the learning runner incrementally so it is manually testable after every story.

`composeSentenceBatch` takes a `SentenceContext` (pre-written corpus record) and a single resolved `SentenceTile[]` (caller resolves all wordIds once). It produces four word-block directions:

- **Word-block english-to-native** — arrange native tiles into correct order
- **Word-block native-to-english** — arrange English tiles into correct order
- **Word-block native-to-romanization** — arrange romanization tiles into correct order
- **Word-block romanization-to-native** — arrange native tiles from a romanization prompt

All four directions share one composer because all require a `SentenceContext`. Fill-in-the-blank is a separate skill track (contextual recognition → `ContextState`) and belongs in a future `composeContextBatch` composer — it is out of scope for DS02.

Each story (ST04–ST07) has a **(a) engine** section and a **(b) runner** section. The runner section wires that story's direction into the learning runner so it can be manually tested immediately.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `composeSentenceBatch` signature | `(ctx: SentenceContext, resolvedTiles: SentenceTile[], options?: { shuffle?: boolean }): SentenceQuestion[]` | Caller resolves all wordIds to `SentenceTile[]` once; composer picks the tile face field per direction |
| Fill-in-the-blank | Out of scope — belongs in `composeContextBatch` (future EP) | Contextual recognition is a distinct mastery skill track from word-block production |
| Word-block tile directions | Four directions matching `QuizDirection` | Consistent with word question directions |
| Tile shuffle | `shuffle: true` by default; `shuffle: false` option for tests | Consistent with `composeWordBatchItems` pattern |
| `SentenceContext` type | Defined in `src/types/sentence.ts` | New type; fields from PRD §4 |
| `MIN_SEEN_FOR_SENTENCE` | Configurable threshold (default `2`) in `LEARNING_CONFIG` | A sentence question only becomes eligible when every word in the sentence has been seen at least this many times — ensures the learner has encountered each tile before being asked to arrange them; tunable without code changes |
| `SentenceQuestion.direction` | `'english-to-native' \| 'native-to-english' \| 'native-to-romanization' \| 'romanization-to-native'` | Full direction set matching word questions |
| `answer` semantics | All directions: `wordId[]` | All word orders are `wordId` refs; evaluator compares `wordId[]` regardless of direction |
| Runner wiring | Direct call in `runBatch`; no registry | Same direct-call pattern as word questions today |

---

## 3. Data Structures

### `SentenceContext` (new — `src/types/sentence.ts`)

```ts
export interface SentenceContext {
  sentenceId: string;
  nativeSentence: string;
  englishSentence: string;
  romanizationSentence?: string;     // prompt for romanization-to-native; required when romanizationWordOrder is set
  nativeWordOrder: string[];         // wordId refs
  englishWordOrder: string[];        // wordId refs — same words, tile face is tile.english
  romanizationWordOrder?: string[];  // wordId refs — same words, tile face is tile.romanization
}
```

> All three word orders are `wordId[]` refs into the same word pool. The caller resolves them all to `SentenceTile[]` once. The composer picks which field to use as the tile face per direction (`tile.native`, `tile.english`, or `tile.romanization`).
>
> `targetWordId`, `nativeGappedTemplate`, and `blankPosition` are removed — they belong to the fill-in-the-blank EP.

### `SentenceTile` (unchanged from DS01)

```ts
interface SentenceTile {
  wordId: string;
  native: string;
  romanization: string;
  english: string;
}
```

### `SentenceQuestion` (update `src/types/quiz.ts`)

```ts
interface SentenceQuestion {
  kind: 'word-block';
  sentenceId: string;
  direction: 'english-to-native' | 'native-to-english' | 'native-to-romanization' | 'romanization-to-native';
  prompt: string;
  tiles: SentenceTile[];  // shuffled; composer sets tile face field per direction
  answer: string[];       // wordId[] — correct tile order for all directions
}
```

### Tile face per direction

| Direction | Prompt | Tile face shown | `answer` |
|---|---|---|---|
| `en→na` | `englishSentence` | `tile.native` | `nativeWordOrder` |
| `roman→na` | `romanizationSentence` | `tile.native` | `nativeWordOrder` |
| `na→en` | `nativeSentence` | `tile.english` | `englishWordOrder` |
| `na→roman` | `nativeSentence` | `tile.romanization` | `romanizationWordOrder` |

### `composeSentenceBatch` output

```
word-block (en→na)    → SentenceQuestion (direction: 'english-to-native')
word-block (na→en)    → SentenceQuestion (direction: 'native-to-english')
word-block (na→roman) → SentenceQuestion (direction: 'native-to-romanization')
word-block (roman→na) → SentenceQuestion (direction: 'romanization-to-native')
```

---

## 4. File Map After DS02

```
packages/srs-engine-v2/
├── src/
│   ├── types/
│   │   ├── quiz.ts                          ← update SentenceQuestion.direction
│   │   └── sentence.ts                      ← NEW: SentenceContext (no fill-in-the-blank fields)
│   ├── engine/
│   │   ├── compose-word-batch.ts            ← unchanged (renamed from compose-batch.ts in DS01)
│   │   └── compose-sentence-batch.ts        ← NEW: composeSentenceBatch (public) + private per-direction helpers
│   ├── __tests__/unit/
│   │   └── compose-sentence-batch.test.ts   ← NEW
│   └── index.ts                             ← add SentenceContext, composeSentenceBatch exports
├── data/mock/
│   └── mock-sentence-corpus.ts              ← NEW: SentenceContext fixtures (no targetWordId)
└── demo/
    ├── learning-io.ts                        ← updated per story (b) sections
    └── config.ts                             ← updated: MIN_SEEN_FOR_SENTENCE, DEBUG_SENTENCE_ELIGIBILITY
```

---

## 5. Stories

### EP23-ST03: Define `SentenceContext` type + mock corpus fixture

**Scope**: Type definition and mock data only. No composer code yet.

**Read List**:
- `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` §4
- `packages/srs-engine-v2/data/mock/mock-word-pool.ts`

**Tasks**:
- [ ] Create `src/types/sentence.ts` with `SentenceContext` interface (fields per §3 above — no fill-in-the-blank fields)
- [ ] Update `src/types/quiz.ts`: expand `SentenceQuestion.direction` to 4-way union
- [ ] Export `SentenceContext` from `src/index.ts`
- [ ] Create `data/mock/mock-sentence-corpus.ts` — at least 2 entries using real word ids from `mock-word-pool.ts`; include `nativeWordOrder`, `englishWordOrder`, `romanizationSentence`, `romanizationWordOrder`

**Acceptance Criteria**:
- [ ] `SentenceContext` importable from `@gll/srs-engine-v2`; no fill-in-the-blank fields present
- [ ] `SentenceQuestion.direction` accepts all four values
- [ ] Mock corpus compiles without type errors
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

### EP23-ST04: Implement `english-to-native` direction + wire runner

#### (a) Engine

**Scope**: Create `compose-sentence-batch.ts`. Implement `en→na` direction as a private helper. Export `composeSentenceBatch` — it currently produces only `en→na` questions; later stories add more directions inside the same function without changing the public API or the runner.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`
- `packages/srs-engine-v2/src/engine/compose-word-batch.ts`

**Tasks**:
- [ ] Create `src/engine/compose-sentence-batch.ts`
- [ ] Implement private helper for `en→na`: prompt = `ctx.englishSentence`; tiles = `resolvedTiles`; answer = `ctx.nativeWordOrder`; shuffle unless `shuffle: false`
- [ ] Export `composeSentenceBatch(ctx, resolvedTiles, options?): SentenceQuestion[]` — calls `en→na` helper; returns array
- [ ] Export `composeSentenceBatch` from `src/index.ts`
- [ ] Write unit tests: correct prompt, tile fields (`native`, `romanization`, `english`, `wordId`), answer order, `shuffle: false` determinism

**Acceptance Criteria**:
- [ ] `composeSentenceBatch` returns 1 question with `direction: 'english-to-native'`
- [ ] Each tile has all four fields
- [ ] `answer` equals `ctx.nativeWordOrder`
- [ ] `shuffle: false` produces same tile order across calls
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

#### (b) Runner

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts`
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/data/mock/mock-sentence-corpus.ts`

**Tasks**:
- [ ] Add `MIN_SEEN_FOR_SENTENCE: 2` and `DEBUG_SENTENCE_ELIGIBILITY: false` to `LEARNING_CONFIG` in `config.ts`
- [ ] Extend `QuizResult` with `sentenceId?: string` — sentence answers populate `sentenceId`; word answers populate `wordId`
- [ ] In `runAdaptiveLoop`: derive `eligibleSentenceContexts` — all corpus entries where all `nativeWordOrder` word ids have `runState.get(id)?.seen >= MIN_SEEN_FOR_SENTENCE`; bypass seen check when `DEBUG_SENTENCE_ELIGIBILITY` is true
- [ ] Resolve `SentenceTile[]` for each eligible context (look up each `wordId` in word pool)
- [ ] In `runBatch`: call `composeSentenceBatch(ctx, resolvedTiles)` for each eligible context; append to question array
- [ ] In `runInteractive`: handle `kind === 'word-block'` — display numbered tiles, print correct tile order as cheat sheet (e.g. `Correct order: 3 1 4 2`) before prompting input; evaluate answer against `answer`; record `sentenceId` in result
- [ ] In `CorrectAutoAnswerStrategy`: auto-answer word-block with correct tile order

**Manual Test**: Set `DEBUG_SENTENCE_ELIGIBILITY: true`, run learning runner — `en→na` word-block questions appear immediately; cheat sheet visible; numbered tile input accepted.

---

### EP23-ST05: Add `romanization-to-native` direction

#### (a) Engine

**Scope**: Add `roman→na` private helper inside `composeSentenceBatch`. Public API and runner are unchanged — new direction appears automatically.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`

**Tasks**:
- [ ] Add private helper for `roman→na`: prompt = `ctx.romanizationSentence`; tiles = `resolvedTiles`; answer = `ctx.nativeWordOrder`; shuffle unless `shuffle: false`; skip if `ctx.romanizationSentence` is absent
- [ ] `composeSentenceBatch` calls `roman→na` helper alongside `en→na`
- [ ] Add unit tests: correct prompt, tile shape, answer order, `shuffle: false`, skipped when `romanizationSentence` absent

**Acceptance Criteria**:
- [ ] Full corpus entry returns 2 questions: `en→na` + `roman→na`
- [ ] Entry without `romanizationSentence` returns 1 question (`en→na` only)
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

#### (b) Runner

No runner changes needed — `composeSentenceBatch` already called; new direction appears automatically.

**Manual Test**: Run learning runner — both `en→na` and `roman→na` questions appear for corpus entries with `romanizationSentence`.

---

### EP23-ST06: Add `native-to-english` and `native-to-romanization` directions

#### (a) Engine

**Scope**: Add `na→en` and `na→roman` private helpers inside `composeSentenceBatch`. Public API and runner unchanged.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`

**Tasks**:
- [ ] Add private helper for `na→en`: prompt = `ctx.nativeSentence`; tiles from `ctx.englishWordOrder` (resolved via `resolvedTiles`); answer = `ctx.englishWordOrder`; shuffle unless `shuffle: false`
- [ ] Add private helper for `na→roman`: prompt = `ctx.nativeSentence`; tiles from `ctx.romanizationWordOrder` (resolved via `resolvedTiles`); answer = `ctx.romanizationWordOrder`; skip if `ctx.romanizationWordOrder` absent
- [ ] `composeSentenceBatch` calls all four helpers; returns flat array
- [ ] Add unit tests for both: prompt, tile count, answer order, `shuffle: false`, romanization skipped when absent

**Acceptance Criteria**:
- [ ] Full corpus entry returns 4 questions: `en→na`, `roman→na`, `na→en`, `na→roman`
- [ ] Entry without romanization fields returns 2 questions
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

#### (b) Runner

No runner changes needed — all four directions appear automatically.

**Manual Test**: Run learning runner — all four word-block directions appear across eligible sentence questions.

---

### EP23-ST07: Integration test + typecheck gate

**Scope**: No new logic. Add an integration test asserting the full output contract. Confirm typecheck is clean end-to-end.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [ ] Add integration test: full corpus entry produces exactly 4 questions with correct `direction` values in order; entry without romanization produces exactly 2
- [ ] Verify `composeSentenceBatch` is importable from `@gll/srs-engine-v2`

**Acceptance Criteria**:
- [ ] `composeSentenceBatch` importable from `@gll/srs-engine-v2`
- [ ] Full entry: `['english-to-native', 'romanization-to-native', 'native-to-english', 'native-to-romanization']`
- [ ] Entry without romanization: `['english-to-native', 'native-to-english']`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

## 6. Open Questions

| # | Question | Severity | Owner | Status |
|---|----------|----------|-------|--------|
| OQ1 | Fill-in-the-blank is a distinct mastery skill track (contextual recognition → `ContextState`), separate from word-block production (`SentenceState`) and word recognition (`WordState`). Removed from DS02. Belongs in a future `composeContextBatch` EP. | Critical | — | **Resolved — out of scope** |
| OQ2 | `SentenceTile` has required `wordId` but `na→en` and `na→roman` tiles were plain strings with no word id. | Critical | Dev | **Resolved** — all three word orders (`nativeWordOrder`, `englishWordOrder`, `romanizationWordOrder`) are `wordId[]` refs. Caller resolves all to `SentenceTile[]` once; composer picks tile face field per direction (`tile.native`, `tile.english`, `tile.romanization`). `wordId` is always present. |
| OQ3 | `answer` semantics differed by direction — `na→en`/`na→roman` were plain string tokens, not `wordId[]`. | Medium | Dev | **Resolved** — all directions use `wordId[]` as answer. Evaluator compares `wordId[]` uniformly regardless of direction. |
| OQ4 | `romanizationSentence` and `romanizationWordOrder` are optional in `SentenceContext`. `composeSentenceBatch` skips romanization directions when absent. Corpus authors can add romanization support incrementally. | Medium | — | **Resolved — optional fields** |
| OQ5 | Feature Overview said "both formats share one composer" — copy from when only two formats existed. Corrected to "all four directions share one composer." | Low | — | **Resolved** |

---

## 7. Success Criteria

1. `composeSentenceBatch` and `SentenceContext` are importable from `@gll/srs-engine-v2`
2. All four word-block directions produced from a single `composeSentenceBatch` call
3. Fill-in-the-blank is not part of this DS — reserved for `composeContextBatch`
4. Learning runner surfaces sentence questions after `MIN_SEEN_FOR_SENTENCE` threshold is crossed
5. Manually testable after ST04(b) — `en→na` word-block appears in runner immediately
6. No changes required to `composeWordBatch` or `composeWordBatchMulti`
7. All tests pass, no type errors
