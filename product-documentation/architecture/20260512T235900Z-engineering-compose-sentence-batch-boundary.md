# ADR: `composeSentenceBatch` — Sentence-Level Boundary for Question Composers

**Status:** Accepted (amended 2026-05-14)

**Date:** 2026-05-12

**Deciders:** JC Lee

---

## Context

The `composeWordBatch` ADR established that `composeBatch` should be renamed to reflect its true boundary: it takes a single `QuizItem` and a distractor pool, and produces questions built from the properties of that item alone. It does not require a sentence.

Sentence-level question types are on the roadmap. Two formats were initially planned:

- **Fill-in-the-blank** — a sentence is shown with the target word removed; learner picks from 4 choices
- **Word-block construction** — a sentence is shown; learner arranges word tiles in the correct order

Both require a sentence to exist. Neither can be constructed from a `QuizItem` alone.

However, further analysis (2026-05-14) revealed that fill-in-the-blank and word-block test **different mastery skills**:

| Format | Skill | Feeds |
|--------|-------|-------|
| Fill-in-the-blank | Contextual recognition — identify the correct word in grammatical position | `ContextState` (future) |
| Word-block construction | Production / ordering — arrange words into a correct sentence | `SentenceState` |

Grouping them in one composer because both require a sentence was conflating input shape with skill category. The mastery track separation — not just the input shape — is the correct boundary.

The question this ADR answers: **where does `composeSentenceBatch` live, what input shape does it take, and what belongs inside it?**

---

## Decision

We will implement `composeSentenceBatch` as a sibling composer inside `srs-engine-v2`, with `SentenceContext` (a pre-written corpus record) as its distinguishing input.

**`composeSentenceBatch` contains word-block construction only.** Fill-in-the-blank is a separate mastery track and belongs in a future `composeContextBatch` composer.

```
composeWordBatch     — input: QuizItem + pool
                       output: MCQQuestion[]
                       feeds: WordState.mastery

composeSentenceBatch — input: SentenceContext + resolvedNativeTiles
                       output: SentenceQuestion[]   (four word-block directions)
                       feeds: SentenceState

composeContextBatch  — input: SentenceContext + QuizItem + pool   (future EP)
                       output: ContextQuestion[]    (kind: 'fill-in-the-blank')
                       feeds: ContextState
```

The three mastery tracks are independent:
- **Word** — isolated recognition
- **Sentence** — word ordering / production within a sentence
- **Context** — identifying the correct word in a grammatical gap

The `kind` discriminant on each question type allows the session and UI to type-narrow without guessing.

The session layer routes on input availability: if a `SentenceContext` exists and all its words have `seen >= MIN_SEEN_FOR_SENTENCE`, it calls `composeSentenceBatch`; otherwise it calls `composeWordBatch`. Neither composer knows about the other.

---

## Rationale

- **Mastery track determines composer, not input shape.** The original rationale grouped fill-in-the-blank with word-block because both require a sentence. The amendment separates them because they test different skills and feed different state. Input shape is a necessary condition for composer assignment, not a sufficient one.
- **`composeSentenceBatch` lives inside `srs-engine-v2`.** Sentence content (corpus) is a data concern, but question construction logic belongs in the engine. Keeping the composer here means the session layer does not need to know which package assembled the question.
- **Corpus is pre-written, not generated.** Phase 1 sentence content comes from a curated corpus of sentences. `SentenceContext` is a data record, not a runtime-constructed template. This keeps the composer stateless and testable.
- **Three tracks, three composers.** Word recognition (`composeWordBatch`), sentence production (`composeSentenceBatch`), and contextual recognition (`composeContextBatch`) are independent skills. Keeping them separate means each can be scheduled, scored, and evolved without affecting the others.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| Fill-in-the-blank as a new `QuizDirection` in `composeWordBatch` | Reuses existing type, no new composer | Requires a sentence input that `composeWordBatch` has no contract for; obscures the dependency | Input shape is wrong — `composeWordBatch` has no sentence dependency |
| Fill-in-the-blank inside `composeSentenceBatch` (original decision) | One composer for all sentence-requiring formats | Conflates two distinct mastery tracks; fill-in-the-blank feeds `ContextState`, word-block feeds `SentenceState` — mixing them makes scoring and scheduling harder | Amended 2026-05-14: mastery track is the correct boundary |
| `composeSentenceBatch` in a separate package | Clean separation of concerns | Sentence question construction is engine logic; splitting it forces the session layer to import two packages | The content (corpus) is separate; the construction logic is engine territory |
| Single `composeBatch` that branches on input type | One entry point | Would need to branch on input type internally, violating single responsibility | Three composers with honest contracts is simpler than one that switches on shape |

---

## Consequences

**Positive:**
- Each mastery track (word, sentence, context) has its own composer, state type, and scheduling path — independently evolvable
- `composeSentenceBatch` has no dependency on `QuizItem` or distractor pool — simpler signature, simpler tests
- `composeWordBatch` stays unchanged when sentence or context questions are added

**Negative / Risks:**
- Three composers means three eligibility checks in the session layer — more routing logic than the original two-composer design
- `composeContextBatch` is a future EP; fill-in-the-blank is not available until that EP ships

**Neutral:**
- `SentenceContext` loses `targetWordId`, `nativeGappedTemplate`, and `blankPosition` — those fields move to a future `ContextContext` (or equivalent) type for the fill-in-the-blank EP

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
| **M1** — What is the role of the `QuizItem` parameter alongside `SentenceContext`? | Dev | — | **Superseded** — `composeSentenceBatch` no longer takes a `QuizItem`; word-block construction does not need a target word. `QuizItem` will be relevant to `composeContextBatch` (fill-in-the-blank EP). |
| **M2** — Is `pool` used for word-block questions, or only for fill-in-the-blank distractors? | Dev | — | **Superseded** — `composeSentenceBatch` no longer takes a `pool`; word-block has no distractors. Pool will be relevant to `composeContextBatch`. |
| **M3** — Who constructs the gapped sentence string for fill-in-the-blank — composer or corpus? | Dev | — | **Superseded** — fill-in-the-blank is out of scope for `composeSentenceBatch`. This question belongs to the `composeContextBatch` EP. Resolution still stands: corpus pre-builds `nativeGappedTemplate`; runtime reconstruction is unsafe for space-less languages. |

---

## Related

- ADR: `20260512T230000Z-engineering-compose-word-batch-boundary.md` — `composeWordBatch` rename and word-item boundary
- ADR: `20260512T220218Z-engineering-mastery-is-global-not-per-deck.md` — global mastery model; sentence question type is the correct solution to the depth-of-knowledge gap
- ADR: `20260513T000000Z-engineering-batch-execution-mechanics.md` — re-serve caps, sentence spacing rules, and active window sizing
