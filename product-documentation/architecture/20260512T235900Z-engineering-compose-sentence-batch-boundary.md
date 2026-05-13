# ADR: `composeSentenceBatch` — Sentence-Level Boundary for Question Composers

**Status:** Proposed

**Date:** 2026-05-12

**Deciders:** JC Lee

---

## Context

The `composeWordBatch` ADR established that `composeBatch` should be renamed to reflect its true boundary: it takes a single `QuizItem` and a distractor pool, and produces questions built from the properties of that item alone. It does not require a sentence.

Sentence-level question types are on the roadmap. Two formats are planned:

- **Fill-in-the-blank** — a sentence is shown with the target word removed; learner picks from 4 choices
- **Word-block construction** — an English sentence is shown; learner arranges native word tiles in the correct order

Both formats require a sentence to exist. Neither can be constructed from a `QuizItem` alone. This is structurally different from word-level questions.

The question this ADR answers: **where does `composeSentenceBatch` live, what input shape does it take, and what belongs inside it?**

---

## Decision

We will implement `composeSentenceBatch` as a sibling composer inside `srs-engine-v2`, with `SentenceContext` (a pre-written corpus record) as its distinguishing input.

**Both fill-in-the-blank and word-block construction belong inside `composeSentenceBatch`.** The boundary is the input shape — both formats require a sentence context — not the output format. Fill-in-the-blank producing MCQ-shaped output is a coincidence, not a classification.

```
composeWordBatch     — input: QuizItem + pool
                       output: MCQQuestion[]

composeSentenceBatch — input: SentenceContext + QuizItem + pool
                       output: (MCQQuestion | SentenceQuestion)[]
```

Where:
- `MCQQuestion` — prompt + 4 choices (`kind: 'mcq'`)
- `SentenceQuestion` — prompt + tiles + answer (`kind: 'word-block'`)
- `QuizQuestion = MCQQuestion | SentenceQuestion` — the union type; used by the session, cache, and UI

The `kind` discriminant allows the session and UI to type-narrow without guessing.

The session layer routes on input availability: if a `SentenceContext` exists and all its words have `seen >= MIN_SEEN_FOR_SENTENCE`, it calls `composeSentenceBatch`; otherwise it calls `composeWordBatch`. Neither composer knows about the other.

---

## Rationale

- **Input shape determines composer, not output format.** Fill-in-the-blank looks like a word MCQ from the outside but requires a sentence frame — it cannot be built from `QuizItem` properties alone. Routing it through `composeWordBatch` would be a lie about the dependency.
- **`composeSentenceBatch` lives inside `srs-engine-v2`.** Sentence content (corpus) is a data concern, but question construction logic belongs in the engine. Keeping the composer here means the session layer does not need to know which package assembled the question.
- **Corpus is pre-written, not generated.** Phase 1 sentence content comes from a curated corpus of sentences. `SentenceContext` is a data record, not a runtime-constructed template. This keeps the composer stateless and testable.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| Fill-in-the-blank as a new `QuizDirection` in `composeWordBatch` | Reuses existing type, no new composer | Requires a sentence input that `composeWordBatch` has no contract for; obscures the dependency | Input shape is wrong — the boundary is the sentence requirement, not the output format |
| `composeSentenceBatch` in a separate package | Clean separation of concerns | Sentence question construction is engine logic; splitting it forces the session layer to import two packages | The content (corpus) is separate; the construction logic is engine territory |
| Single `composeBatch` that branches on input type | One entry point | Would need to branch on input type internally, violating single responsibility | Two composers with honest input contracts is simpler than one composer that switches on shape |

---

## Consequences

**Positive:**
- The session layer has a simple routing rule: `SentenceContext` available → `composeSentenceBatch`, otherwise → `composeWordBatch`
- Fill-in-the-blank and word-block share a composer, so sentence corpus loading and target word resolution happen in one place
- `composeWordBatch` stays unchanged when sentence questions are added

**Negative / Risks:**
- `QuizQuestion` becomes a union type (`MCQQuestion | SentenceQuestion`) — session, cache, and UI type-narrow via `kind` discriminant
- `MCQQuestion` rename touches `src/types/quiz.ts` and all call sites — mechanical but not zero effort
- Corpus data model (`SentenceContext`) is defined in PRD `20260513T000000Z-sentence-question-ep.md` §4

**Neutral:**
- Mastery scoring boundary (whether sentence performance feeds the same mastery state as word recognition) is deferred to the sentence question EP PRD — this ADR does not require it to be resolved

---

## Open Questions

| Question | Owner | Target | Decision |
|----------|-------|--------|----------|
| What fields does `SentenceContext` contain? | Architect | — | **Resolved** — see PRD `20260513T000000Z-sentence-question-ep.md` §4 for full field list including `nativeWordOrder` (wordId refs), `englishWordOrder`, `blankPosition` |
| Does mastery state need to track question type (word vs. sentence) separately, or is correctness type-agnostic? | Product + Dev | — | **Resolved** — sentence correctness does not affect `WordState.mastery`. Sentence performance feeds `SentenceState` only. Two separate tracks, two separate skills. |
| When does the session promote a mastered word to sentence questions? Per-word on mastery, or deck-completion gate? | Product | — | **Resolved** — eligibility is `seen >= 2` for all words in the sentence; mastery not required. See PRD `20260513T000000Z-sentence-question-ep.md` §2 |
| **B1** — Is `QuizQuestion[] \| SentenceQuestion[]` the right return type, or should it be a discriminated union array? | Architect | — | **Resolved** — `QuizQuestion` is renamed to `MCQQuestion`. `QuizQuestion` becomes the union type `MCQQuestion \| SentenceQuestion`, each with a `kind` discriminant (`'mcq'` \| `'word-block'`). `composeSentenceBatch` returns `(MCQQuestion \| SentenceQuestion)[]`. `assembleBatchQuestions` returns `QuizQuestion[]`. Cache is `Map<string, QuizQuestion>`. `composeWordBatch` returns `MCQQuestion[]`. The rename touches `src/types/quiz.ts` — flagged for DS03 or a new story. |
| **G1** — What is the minimum shape of `SentenceQuestion` for word-block output? | Architect | — | **Resolved** — minimum shape: `{ sentenceId: string; direction: 'english-to-native' \| 'native-to-english'; prompt: string; tiles: SentenceTile[]; answer: string[] }`. `answer` is `wordId[]` (correct tile order). Tiles are shuffled by the composer; `shuffle: false` option for tests (same pattern as `composeWordBatchItems`). |
| **G2** — ADR says "mastered word" as routing condition; PRD says `seen >= 2` — which is authoritative? | Architect | — | **Resolved** — PRD §2 is authoritative: eligibility is `seen >= 2` for all words in the sentence; mastery not required. ADR Decision section corrected below. |
| **M1** — What is the role of the `QuizItem` parameter alongside `SentenceContext`? | Dev | — | **Resolved** — `QuizItem` is the resolved target word, passed in by the caller to avoid a DB lookup inside the engine. The engine never resolves word data from `targetWordId`. See `reference/data-pipeline-boundary.md`. |
| **M2** — Is `pool` used for word-block questions, or only for fill-in-the-blank distractors? | Dev | — | **Resolved** — `pool` is used for fill-in-the-blank distractors only; word-block ignores it. `pool` is the learner's mastered words, resolved by the session from `RunState` before registering the thunk — more meaningful distractors than the global word pool. Signature keeps `pool` required; word-block ignores it internally. |
| **M3** — Who constructs the gapped sentence string for fill-in-the-blank — composer or corpus? | Dev | — | **Resolved** — corpus pre-builds `nativeGappedTemplate` (e.g. `"หิวแล้วไป___อะไรกัน"`). Composer uses it directly as the prompt. Runtime reconstruction from `nativeSentence` + `blankPosition` is unsafe for languages without spaces (Thai). `blankPosition` is retained for the answer evaluator to identify the correct `nativeWordOrder` token. |

---

## Related

- ADR: `20260512T230000Z-engineering-compose-word-batch-boundary.md` — `composeWordBatch` rename and word-item boundary
- ADR: `20260512T220218Z-engineering-mastery-is-global-not-per-deck.md` — global mastery model; sentence question type is the correct solution to the depth-of-knowledge gap
- ADR: `20260513T000000Z-engineering-batch-execution-mechanics.md` — re-serve caps, sentence spacing rules, and active window sizing
