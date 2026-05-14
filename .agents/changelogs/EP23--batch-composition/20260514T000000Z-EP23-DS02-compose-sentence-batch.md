# EP23-DS02: `composeSentenceBatch` — Word-Block Sentence Composer

**Date**: 20260514T000000Z
**Status**: Proposed
**Epic**: EP23 — Batch Composition

---

## 1. Feature Overview

DS01 established the `QuizQuestion = MCQQuestion | SentenceQuestion` union type. DS02 implements `composeSentenceBatch` — the sentence-level composer for word-block construction questions — and wires each direction into the learning runner incrementally so it is manually testable after every story.

`composeSentenceBatch` takes a `SentenceContext` (pre-written corpus record) and a single resolved `SentenceTile[]` (caller resolves all wordIds once). It produces three word-block directions:

- **Word-block english-to-native** — arrange native tiles into correct order
- **Word-block romanization-to-native** — arrange native tiles from a romanization prompt
- **Word-block native-to-romanization** — arrange romanization tiles into correct order

`native-to-english` is not supported for sentence questions. All three directions share one composer. Fill-in-the-blank is a separate skill track (contextual recognition → `ContextState`) and belongs in a future `composeContextBatch` composer — it is out of scope for DS02.

Each story (ST04–ST07) has a **(a) engine** section and a **(b) runner** section. The runner section wires that story's direction into the learning runner so it can be manually tested immediately.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `composeSentenceBatch` signature | `(ctx: SentenceContext, resolvedTiles: SentenceTile[], language: string, options?: { shuffle?: boolean }): SentenceQuestion[]` | Caller resolves wordIds to `SentenceTile[]` once and passes language code; composer builds prompts using `LANGUAGE_CONFIG` |
| Fill-in-the-blank | Out of scope — belongs in `composeContextBatch` (future EP) | Contextual recognition is a distinct mastery skill track from word-block production |
| Word-block tile directions | Three directions: `en→na`, `roman→na`, `na→roman` | `native-to-english` not supported for sentence questions |
| Tile shuffle | `shuffle: true` by default; `shuffle: false` option for tests | Consistent with `composeWordBatchItems` pattern |
| `SentenceContext` type | Defined in `src/types/sentence.ts` | New type; fields from PRD §4 |
| `MIN_SEEN_FOR_SENTENCE` | Configurable threshold (default `2`) in `LEARNING_CONFIG` | A sentence question only becomes eligible when every word in the sentence has been seen at least this many times — ensures the learner has encountered each tile before being asked to arrange them; tunable without code changes |
| `SentenceQuestion.direction` | `'english-to-native' \| 'romanization-to-native' \| 'native-to-romanization'` | `native-to-english` not supported for sentence questions |
| `answer` semantics | All directions: `wordId[]` | All word orders are `wordId` refs; evaluator compares `wordId[]` regardless of direction |
| Runner wiring | Direct call in `runBatch`; no registry | Same direct-call pattern as word questions today |

---

## 3. Data Structures

### `SentenceContext` (new — `src/types/sentence.ts`)

```ts
export interface SentenceContext {
  sentenceId: string;
  englishSentence: string; // authored — English grammar may differ from native word order
  wordOrder: string[];     // wordId refs — tile order for all directions
}
```

> `englishSentence` is authored because English sentence structure can differ from `wordOrder` (the native word order). Other prompts (`roman→na`, `na→roman`) are derived at compose time from resolved tiles joined via `LANGUAGE_CONFIG` — native word order is consistent with `wordOrder` so no authoring is needed for those.
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
| `en→na` | `ctx.englishSentence` (authored) | `tile.native` | `wordOrder` |
| `roman→na` | `joinTiles(tiles, 'romanization', language)` | `tile.native` | `wordOrder` |
| `na→roman` | `joinTiles(tiles, 'native', language)` | `tile.romanization` | `wordOrder` |

### `QuizResult` (updated `src/types/quiz.ts` — ST04)

```ts
export interface WordQuizResult   { wordId: string;    correct: boolean; }
export interface SentenceQuizResult { sentenceId: string; correct: boolean; }
export type QuizResult = WordQuizResult | SentenceQuizResult;
```

`updateMasteryState` takes `WordQuizResult[]` — caller filters results before passing.

### `composeSentenceBatch` output

```
word-block (en→na)    → SentenceQuestion (direction: 'english-to-native')
word-block (roman→na) → SentenceQuestion (direction: 'romanization-to-native')
word-block (na→roman) → SentenceQuestion (direction: 'native-to-romanization')
// native-to-english not supported
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

### EP23-ST03: Define `SentenceContext` type + mock corpus fixture — **Complete ✅**

**Scope**: Type definition and mock data only. No composer code yet.

**Tasks**:
- [x] Create `src/types/sentence.ts` with `SentenceContext` interface (`sentenceId`, `wordOrder`)
- [x] Create `src/config/language.ts` with `LANGUAGE_CONFIG` mapping language codes to `WordJoin`
- [x] Update `src/types/quiz.ts`: expand `SentenceQuestion.direction` to 4-way union
- [x] Export `SentenceContext`, `LANGUAGE_CONFIG`, `WordJoin` from `src/index.ts`
- [x] Create `data/mock/mock-sentence-corpus.ts` — 2 Thai sentences using real word ids from `mock-word-pool.ts`; `wordOrder` only

**Note**: `englishSentence` was added to `SentenceContext` during ST04 implementation — the en→na prompt must be authored because English sentence structure can differ from native `wordOrder`. All other prompts are derived from tile fields at compose time.

---

### EP23-ST04: Implement `english-to-native` direction + wire runner — **Complete ✅**

#### (a) Engine

**Scope**: Create `compose-sentence-batch.ts`. Implement `en→na` direction as a private helper. Export `composeSentenceBatch` — it currently produces only `en→na` questions; later stories add more directions inside the same function without changing the public API or the runner.

**Tasks**:
- [x] Create `src/engine/compose-sentence-batch.ts`
- [x] Implement private `buildQuestion` helper — takes `ctx`, tiles, direction, prompt, shuffle flag; returns `SentenceQuestion`
- [x] Implement `joinTiles` — joins tile face field using `LANGUAGE_CONFIG[language].wordJoin` for `native` field; always space for `english` and `romanization`
- [x] Export `composeSentenceBatch(ctx, resolvedTiles, language, options?): SentenceQuestion[]` — calls `en→na` helper; returns array
- [x] Export `composeSentenceBatch` from `src/index.ts`
- [x] Write unit tests: direction, prompt (space-joined English regardless of target language), tile fields, answer = `ctx.wordOrder`, `shuffle: false` determinism, `sentenceId` carried through; language config tests for Thai and English join behaviour

#### (b) Runner

**Tasks**:
- [x] Add `minSeenForSentence: 2` and `debugSentenceEligibility: false` to `LEARNING_CONFIG` in `config.ts`
- [x] Split `QuizResult` into `WordQuizResult` (`wordId: string`) and `SentenceQuizResult` (`sentenceId: string`) discriminated union; `updateMasteryState` takes `WordQuizResult[]`
- [x] Add `resolveEligibleContexts(runState, allPool)` in `learning-io.ts` — filters corpus by `seen >= minSeenForSentence` (or all when `debugSentenceEligibility`); resolves `SentenceTile[]` for each eligible context
- [x] `runBatch` accepts `runState` param; calls `composeSentenceBatch` for each eligible context; merges sentence questions into flat `QuizQuestion[]`
- [x] `runInteractive` updated to handle `QuizQuestion` union — `runInteractiveMCQ` and `runInteractiveWordBlock` are separate private functions; word-block shows numbered tiles + cheat sheet line before prompting
- [x] `runAutoInteractive` updated to handle `QuizQuestion` — word-block always answered correctly; MCQ delegates to strategy
- [x] Filter `WordQuizResult` from results before passing to `updateMasteryState`

**Design decisions made during implementation**:
- `joinTiles` applies `wordJoin` only to `native` field — `english` and `romanization` are always space-joined regardless of target language
- `resolveEligibleContexts` lives in `learning-io.ts` alongside `runBatch` (caller concern, not engine concern)
- Language is hardcoded to `'th'` in the runner for now — will be driven by deck metadata in a future EP

**Manual Test**: Set `debugSentenceEligibility: true`, run learning runner — `en→na` word-block questions appear immediately; cheat sheet visible; numbered tile input accepted.

---

### EP23-ST05: Add `romanization-to-native` direction — **Complete ✅**

#### (a) Engine

**Scope**: Add `roman→na` private helper inside `composeSentenceBatch`. Public API and runner are unchanged — new direction appears automatically.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`

**Tasks**:
- [x] Add private helper for `roman→na`: prompt = `joinTiles(resolvedTiles, 'romanization', language)`; tiles = `resolvedTiles`; answer = `ctx.wordOrder`; shuffle unless `shuffle: false`
- [x] `composeSentenceBatch` calls `roman→na` helper alongside `en→na`
- [x] Add unit tests: direction, prompt joined from romanization tiles via `LANGUAGE_CONFIG` (no-space for Thai, space for en), tile face is `native`, answer = `ctx.wordOrder`, `shuffle: false` determinism

**Acceptance Criteria**:
- [x] Every corpus entry returns 2 questions: `en→na` + `roman→na`
- [x] `pnpm --filter @gll/srs-engine-v2 test` passes

#### (b) Runner

No runner changes needed — `composeSentenceBatch` already called; new direction appears automatically.

**Manual Test**: Run learning runner — both `en→na` and `roman→na` questions appear.

---

### EP23-ST06: Add `native-to-romanization` direction

#### (a) Engine

**Scope**: Add `na→roman` private helper inside `composeSentenceBatch`. Public API and runner unchanged.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/types/sentence.ts`

**Tasks**:
- [ ] Add private helper for `na→roman`: prompt = `joinTiles(resolvedTiles, 'native', language)`; tiles = `resolvedTiles`; tile face shown = `tile.romanization`; answer = `ctx.wordOrder`; shuffle unless `shuffle: false`
- [ ] `composeSentenceBatch` calls all three helpers; returns flat array
- [ ] Add unit tests: prompt is native tiles joined by language config, tile face is romanization, answer = `ctx.wordOrder`, `shuffle: false`

**Acceptance Criteria**:
- [ ] Every corpus entry returns 3 questions: `en→na`, `roman→na`, `na→roman`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes

#### (b) Runner

No runner changes needed — new direction appears automatically.

**Manual Test**: Run learning runner — all three word-block directions appear across eligible sentence questions.

---

### EP23-ST07: Integration test + typecheck gate

**Scope**: No new logic. Add an integration test asserting the full output contract. Confirm typecheck is clean end-to-end.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-sentence-batch.ts`
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [ ] Add integration test: any corpus entry produces exactly 3 questions with correct `direction` values in the fixed order below
- [ ] Verify `composeSentenceBatch` is importable from `@gll/srs-engine-v2`

**Acceptance Criteria**:
- [ ] `composeSentenceBatch` importable from `@gll/srs-engine-v2`
- [ ] Output directions (fixed order): `['english-to-native', 'romanization-to-native', 'native-to-romanization']`
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

## 6. Open Questions

| # | Question | Severity | Owner | Status |
|---|----------|----------|-------|--------|
| OQ1 | Fill-in-the-blank is a distinct mastery skill track (contextual recognition → `ContextState`), separate from word-block production (`SentenceState`) and word recognition (`WordState`). Removed from DS02. Belongs in a future `composeContextBatch` EP. | Critical | — | **Resolved — out of scope** |
| OQ2 | `SentenceTile` has required `wordId` but `na→roman` tiles were plain strings with no word id. | Critical | Dev | **Resolved** — `wordOrder` is a single `wordId[]`; caller resolves to `SentenceTile[]` once. Composer picks tile face field per direction (`tile.native`, `tile.romanization`, `tile.english`). `wordId` is always present. |
| OQ3 | `answer` semantics differed by direction — earlier drafts had `na→roman` as plain string tokens, not `wordId[]`. | Medium | Dev | **Resolved** — all directions use `wordId[]` as answer. Evaluator compares `wordId[]` uniformly regardless of direction. |
| OQ4 | Earlier design had optional `romanizationSentence` and `romanizationWordOrder` fields on `SentenceContext` with skip logic when absent. | Medium | — | **Resolved** — `SentenceTile.romanization` is a required field; no optional skip needed. All corpus entries produce all 3 directions. |
| OQ5 | Feature Overview said "both formats share one composer" — copy from when only two formats existed. Corrected to "all three directions share one composer." | Low | — | **Resolved** |

---

## 7. Success Criteria

1. `composeSentenceBatch` and `SentenceContext` are importable from `@gll/srs-engine-v2`
2. Three word-block directions produced per corpus entry: `en→na`, `roman→na`, `na→roman` (`na→en` not supported)
3. Fill-in-the-blank is not part of this DS — reserved for `composeContextBatch`
4. Learning runner surfaces sentence questions after `minSeenForSentence` threshold is crossed
5. ✅ Manually testable after ST04(b) — `en→na` word-block appears in runner with `debugSentenceEligibility: true`
6. No changes required to `composeWordBatch` or `composeWordBatchMulti`
7. All tests pass, no type errors
