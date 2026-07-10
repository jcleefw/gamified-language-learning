# ADR: Question-Direction Recording for Adaptive Difficulty & Frequency

**Date**: 20260711T004916Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: Decision ratified now; implementation deferred. No epic fixed — a later epic builds the recording channel and the adaptive-selection logic on top of it.
**RFC**: N/A

---

## Context

The [Config Ownership — Two-Tier Model ADR](20260711T004050Z-engineering-config-ownership-two-tier.md) (D3) ratified that **scoring is permanently direction-blind** — `WordState` is keyed by `wordId`, mastery folds all directions together, and direction never enters the score — while reserving **direction-awareness for a different job: difficulty and frequency population** (adaptive selection of what gets served). This ADR records the decision to build that recording, the boundary it must respect, and the current gap. It is a decision record made ahead of implementation; the work is deferred.

**Why record direction at all.** Question directions are not equally hard: production (`native-to-english`) is typically far harder than recognition (`english-to-native`). Knowing per-direction performance lets the system (later) **populate difficulty and adjust frequency** — serve weaker directions more often, weight a word's effective difficulty by which directions the learner is actually strong/weak on. It also lets us detect the rigor gap the config ADR flagged: a learner can reach "mastered" (a per-word, direction-blind bar) while only ever practicing recognition. None of this feeds the score; all of it feeds _selection_.

**Current state of the code:**

- **Generation already exists.** Both `MCQQuestion.direction` and `SentenceQuestion.direction` carry a `QuizDirection` (`packages/srs-engine-v2/src/types/quiz.ts`), and word questions are generated per-direction (`makeQuestion(item, direction, pool)`, `FOUNDATIONAL_DIRECTIONS` in `compose-word-batch.ts`). The quiz _serves_ questions in distinct directions today.
- **Recording does not.** The **result** types discard direction: `WordQuizResult` and `SentenceQuizResult` are `{ id, correct }`. Direction is known at serve-time on the question and thrown away before the result is formed. The `/api/answer` wire fact is `{ wordId, correct, latencyMs, recheck }` — no direction — and `answer_events` has no `direction` column.
- **Sentences are not recorded in the observability channel at all.** `answer_events` is word-only (`word_id NOT NULL`); sentence outcomes flow to `user_sentence_states` on a separate path and never produce an `answer_events` row.

So the gap is narrow and cheap on the word side (direction already exists client-side; it is merely dropped), and structural on the sentence side (no observability row exists to attach it to).

## Decision

### D1 — Direction is recorded as append-only seed data, never a scoring input

Question direction rides the answer as a **wire fact** (the same pattern as `recheck` — a fact about what happened, not policy) and is persisted in the **observability channel**, never in `WordState` and never in the `/api/answer` transition. This inherits the config ADR's D3: scoring stays direction-blind. Making mastery per-direction is explicitly out of bounds — it would fragment the comparable bar.

### D2 — Purpose is difficulty & frequency population, never the rating

The recorded direction exists to drive **adaptive selection** — which directions/words to serve, and how often — and per-direction difficulty analysis. It must never feed mastery, graduation, or review scheduling. This mirrors the existing `review_answer_events` precedent, whose schema comment states it is _"seed data for the deferred response-time-scoring feature; never feeds the rating."_ Same philosophy: capture now, analyse later, never let it touch the score.

### D3 — The recording gap has two distinct parts

1. **Words (cheap):** add `direction` to the answer wire fact and a nullable `answer_events.direction` column. Direction is already present client-side on the served `MCQQuestion`; the client simply stops discarding it. Historical rows stay `null` ("pre-feature"); no backfill.
2. **Sentences (structural):** there is no observability row today. A channel must be introduced — either extend `answer_events` to accept sentence answers, or add a parallel `sentence_answer_events` log. Which of the two is a Design-Spec decision; this ADR records only that the channel must exist and follow D1/D2.

### D4 — Pairs with the `wordDirections` user preference, both scoring-blind

The config ADR deferred a `wordDirections` **T1 preference** (enable/disable word-question directions, parallel to the existing `sentenceDirections`). That preference and this recording are complementary: the preference governs _which directions a learner practises_; the recording captures _which directions were actually practised and how they went_. Together they enable insights like "mastered by recognition only" and adaptive re-weighting. Both remain strictly outside scoring.

## Consequences

**Positive**:

- Unlocks per-direction difficulty analysis and adaptive difficulty/frequency population without touching the comparable mastery metric.
- Cheap on the word side — the direction is already known client-side; only the result/wire fact drops it today.
- Preserves every guarantee of the config ADR: scoring stays direction-blind and cross-user/content/time comparable.

**Negative**:

- Adds a wire fact and an `answer_events` column, and requires a **new sentence recording channel** (sentence answers do not hit `answer_events`). The answer-payload shape gains a field (a server-side observability fact — not a scoring input, and not surfaced in `@gll/api-contract` as policy).
- The adaptive-selection algorithm that _consumes_ this data is a further, separate design not decided here.

**Neutral**:

- Decision ratified now, implementation deferred; no epic fixed. The `review_answer_events` "record now, use later" pattern already models this.
- Word-direction _generation_ already exists; this ADR adds recording + (with D4) the user preference — not the ability to ask in different directions.
