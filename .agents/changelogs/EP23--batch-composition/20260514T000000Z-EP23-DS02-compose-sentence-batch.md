# EP23-DS02: `composeSentenceBatch` — Sentence Composer Implementation

**Date**: 20260514T000000Z
**Status**: Proposed
**Epic**: EP23 — Batch Composition

---

## 1. Feature Overview

DS01 established the registry, re-serve mechanics, and the `QuizQuestion = MCQQuestion | SentenceQuestion` union type. DS02 implements `composeSentenceBatch` — the sentence-level composer that registers as a thunk alongside `composeWordBatchItems`.

`composeSentenceBatch` takes a `SentenceContext` (pre-written corpus record), a resolved `QuizItem` (the target word), and a distractor pool. It produces two question formats:

- **Fill-in-the-blank** — MCQ using `nativeGappedTemplate` as prompt; distractors from pool
- **Word-block construction** — tile-ordering question in either `english-to-native` or `native-to-english` direction; no distractors needed

Both formats are produced inside a single composer because both require a `SentenceContext`. Routing is by input shape, not output format (per ADR `20260512T235900Z-engineering-compose-sentence-batch-boundary.md`).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `composeSentenceBatch` signature | `(ctx: SentenceContext, target: QuizItem, pool: QuizItem[], options?: { shuffle?: boolean }): (MCQQuestion \| SentenceQuestion)[]` | ADR M1: `QuizItem` passed in by caller; engine never resolves word data from DB |
| Fill-in-the-blank prompt source | Use `ctx.nativeGappedTemplate` directly | ADR M3: runtime reconstruction unsafe for space-less languages (Thai) |
| Fill-in-the-blank distractors | Drawn from `pool` (learner's mastered words), same pattern as `composeWordBatch` | ADR M2: more meaningful than global pool |
| Word-block tiles | Resolved `SentenceTile[]` built from `ctx.nativeWordOrder` × `QuizItem` data | PRD §3b: UI receives fully-resolved tiles; no secondary lookups |
| Tile shuffle | `shuffle: true` by default; `shuffle: false` option for tests | Consistent with `composeWordBatchItems` pattern |
| `pool` for word-block | Accepted in signature but ignored | ADR M2: pool is for fill-in-the-blank only; word-block ordering challenge needs no distractors |
| `SentenceContext` type | Defined in `src/types/sentence.ts` | New type; fields from PRD §4 |
| Registry wiring | Session registers `() => composeSentenceBatch(ctx, target, pool)` per eligible `SentenceContext` | ADR D5: composer is a stateless function; session owns routing |

---

## 3. Data Structures

### `SentenceContext` (new — `src/types/sentence.ts`)

```ts
export interface SentenceContext {
  sentenceId: string;
  targetWordId: string;
  nativeSentence: string;
  englishSentence: string;
  nativeGappedTemplate: string;
  nativeWordOrder: string[];     // wordId refs — resolved to SentenceTile[] by caller
  englishWordOrder: string[];    // plain English tokens
  blankPosition: number;         // index of target word in nativeWordOrder
}
```

> `nativeWordOrder` contains `wordId` references. The caller resolves them to `SentenceTile` fields (`native`, `romanization`, `english`) before passing into the engine. The engine receives resolved tiles — it never touches the DB.

### `SentenceQuestion` (already in `src/types/quiz.ts` from DS01)

```ts
interface SentenceQuestion {
  kind: 'word-block';
  sentenceId: string;
  direction: 'english-to-native' | 'native-to-english';
  prompt: string;
  tiles: SentenceTile[];
  answer: string[];   // correct wordId order
}
```

### `composeSentenceBatch` output

```
fill-in-the-blank  → MCQQuestion  (kind: 'mcq')
word-block (en→na) → SentenceQuestion (kind: 'word-block', direction: 'english-to-native')
word-block (na→en) → SentenceQuestion (kind: 'word-block', direction: 'native-to-english')
```

---

## 4. File Map After DS02

```
packages/srs-engine-v2/
├── src/
│   ├── types/
│   │   ├── quiz.ts                          ← unchanged (SentenceQuestion already defined in DS01)
│   │   └── sentence.ts                      ← NEW: SentenceContext
│   ├── engine/
│   │   ├── compose-batch.ts                 ← unchanged
│   │   └── compose-sentence-batch.ts        ← NEW: composeSentenceBatch
│   ├── __tests__/unit/
│   │   └── compose-sentence-batch.test.ts   ← NEW (3 test files, one per ST)
│   └── index.ts                             ← add SentenceContext, composeSentenceBatch exports
├── data/mock/
│   └── mock-sentence-corpus.ts              ← NEW: SentenceContext fixtures for mock words
└── demo/
    ├── learning-io.ts                        ← updated: eligibility, runBatch, runInteractive
    └── config.ts                             ← updated: MIN_SEEN_FOR_SENTENCE constant
```

---

## 5. Stories

### EP23-ST03: Define `SentenceContext` type

**Scope**: Create `src/types/sentence.ts` with `SentenceContext` interface. Export from `index.ts`.

**Read List**:
- `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` §4

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/types/sentence.ts` with `SentenceContext` interface (fields per PRD §4)
- [ ] Export `SentenceContext` from `src/index.ts`

**Acceptance Criteria**:
- [ ] `SentenceContext` importable from `@gll/srs-engine-v2`
- [ ] All fields present: `sentenceId`, `targetWordId`, `nativeSentence`, `englishSentence`, `nativeGappedTemplate`, `nativeWordOrder`, `englishWordOrder`, `blankPosition`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

### EP23-ST04: Implement fill-in-the-blank question format

**Scope**: First format inside `compose-sentence-batch.ts`. Isolated function; no word-block code yet.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`
- `packages/srs-engine-v2/src/engine/compose-batch.ts`
- `product-documentation/architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md` (M2, M3)
- `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` §3a

**Tasks**:
- [ ] Create `src/engine/compose-sentence-batch.ts`
- [ ] Implement `composeFillInTheBlank(ctx, target, pool, options?): MCQQuestion` — prompt from `ctx.nativeGappedTemplate`; correct choice = `target.native`; 3 distractors from `pool` excluding `target`; shuffle choices unless `shuffle: false`
- [ ] Write `src/__tests__/unit/compose-sentence-batch.test.ts` covering: correct prompt, correct answer in choices, distractor exclusion, `shuffle: false` determinism, fewer than 3 pool items

**Acceptance Criteria**:
- [ ] `kind` is `'mcq'`
- [ ] Prompt equals `ctx.nativeGappedTemplate`
- [ ] Exactly one choice has `isCorrect: true` and `value === target.native`
- [ ] Distractors do not include `target`
- [ ] `shuffle: false` produces same choice order across calls
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

---

### EP23-ST05: Implement word-block `english-to-native` format

**Scope**: Second format in `compose-sentence-batch.ts`. Adds `composeSentenceBlockEnToNa`.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts` (SentenceTile, SentenceQuestion)
- `packages/srs-engine-v2/src/types/sentence.ts`
- `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` §3b

**Tasks**:
- [ ] Implement `composeSentenceBlockEnToNa(ctx, resolvedTiles, options?): SentenceQuestion` — prompt = `ctx.englishSentence`; tiles = resolved `SentenceTile[]` (passed in pre-resolved by caller); answer = `ctx.nativeWordOrder`; shuffle tiles unless `shuffle: false`
- [ ] Add tests: correct prompt, tile fields (`native`, `romanization`, `english`, `wordId`), answer order, `shuffle: false` determinism

**Acceptance Criteria**:
- [ ] `kind` is `'word-block'`, `direction` is `'english-to-native'`
- [ ] Each tile has all four fields
- [ ] `answer` equals `ctx.nativeWordOrder`
- [ ] `shuffle: false` produces same tile order across calls
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

---

### EP23-ST06: Implement word-block `native-to-english` format

**Scope**: Third format. Adds `composeSentenceBlockNaToEn`. English tokens are plain strings — no `wordId` needed.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`
- `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` §3b

**Tasks**:
- [ ] Implement `composeSentenceBlockNaToEn(ctx, options?): SentenceQuestion` — prompt = `ctx.nativeSentence`; tiles built from `ctx.englishWordOrder` as plain-string tiles (no `wordId`; use empty string or index-based synthetic id); answer = `ctx.englishWordOrder`; shuffle unless `shuffle: false`
- [ ] Add tests: correct prompt, tile count matches `englishWordOrder`, answer order, `shuffle: false`

**Acceptance Criteria**:
- [ ] `kind` is `'word-block'`, `direction` is `'native-to-english'`
- [ ] Tile count equals `ctx.englishWordOrder.length`
- [ ] `answer` equals `ctx.englishWordOrder`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

---

### EP23-ST07: Wire `composeSentenceBatch` wrapper + export

**Scope**: Thin wrapper that calls ST04–ST06 and returns the flat array. No new logic.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [ ] Implement `composeSentenceBatch(ctx, target, resolvedTiles, pool, options?): (MCQQuestion | SentenceQuestion)[]` — calls `composeFillInTheBlank`, `composeSentenceBlockEnToNa`, `composeSentenceBlockNaToEn`; returns flat array of 3 questions
- [ ] Export `composeSentenceBatch` from `src/index.ts`
- [ ] Add integration test: single `SentenceContext` produces exactly 3 questions with correct `kind` values

**Acceptance Criteria**:
- [ ] Returns exactly 3 questions: `['mcq', 'word-block', 'word-block']`
- [ ] `composeSentenceBatch` importable from `@gll/srs-engine-v2`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

### EP23-ST08: Wire sentence batch into the learning runner

**Scope**: End-to-end wiring in `demo/`. No engine changes, no registry. `runBatch` calls `composeSentenceBatch` directly for each eligible context, the same way it calls `composeWordBatchMulti` today. Manually testable by running the learning runner and observing sentence questions appear after words are seen twice.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts`
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/demo/learning-runner.ts`
- `packages/srs-engine-v2/src/index.ts`
- `packages/srs-engine-v2/data/mock/mock-word-pool.ts` (to understand existing word ids for corpus fixture)
- `product-documentation/architecture/reference/data-pipeline-boundary.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` (D6)

**Tasks**:
- [ ] Create `data/mock/mock-sentence-corpus.ts` — at least 2 `SentenceContext` entries using word ids from `mock-word-pool.ts`; include `nativeGappedTemplate`, `nativeWordOrder` with real word ids, `englishWordOrder`
- [ ] Add `MIN_SEEN_FOR_SENTENCE: 2` to `LEARNING_CONFIG` in `config.ts`
- [ ] Extend `QuizResult` to carry `sentenceId?: string` alongside `wordId` — sentence answers populate `sentenceId`; word answers populate `wordId`
- [ ] In `runAdaptiveLoop`: after `nextActivePool`, derive `eligibleSentenceContexts` — filter corpus entries where all `nativeWordOrder` word ids have `runState.get(id)?.seen >= MIN_SEEN_FOR_SENTENCE`
- [ ] In `runAdaptiveLoop`: resolve `SentenceTile[]` for each eligible context (look up each `wordId` in the combined word pool) before passing to `runBatch`
- [ ] In `runBatch`: accept `eligibleSentenceContexts` param; call `composeSentenceBatch(ctx, target, resolvedTiles, wordPool)` directly for each; append sentence questions to the flat question array alongside word questions
- [ ] In `runInteractive`: handle `SentenceQuestion` (`kind === 'word-block'`) — display numbered tiles, prompt learner to type tile order (e.g. `2 4 1 3`), evaluate against `answer`
- [ ] In `runAutoInteractive` / `AutoAnswerStrategy`: handle `SentenceQuestion` — auto-answer with correct tile order for `CorrectAutoAnswerStrategy`

**Acceptance Criteria**:
- [ ] Running the learning runner in `AUTO_MODE`: sentence questions appear in output after the target words have been seen twice
- [ ] Sentence question results are recorded and printed in the batch summary
- [ ] Interactive mode: word-block question displays tiles with numbers; learner input is accepted and evaluated
- [ ] `CorrectAutoAnswerStrategy` produces correct answers for sentence questions
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

## 6. Success Criteria

1. `composeSentenceBatch` and `SentenceContext` are importable from `@gll/srs-engine-v2`
2. Both fill-in-the-blank and word-block construction are produced from a single `SentenceContext`
3. Learning runner surfaces sentence questions after `MIN_SEEN_FOR_SENTENCE` threshold is crossed
4. No changes required to `composeWordBatch` or `composeWordBatchMulti`
5. All tests pass, no type errors
