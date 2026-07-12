# ADR: `composeWordBatch` — Word-Item Boundary for Question Composers

**Status:** Accepted

**Date:** 2026-05-12

**Deciders:** JC Lee

---

## Context

`composeBatch` (in `packages/srs-engine-v2/src/engine/compose-batch.ts`) generates quiz questions for a single word or foundational item. The function name implies it is a general-purpose question-composing entry point, but what it actually does is narrower:

- Input is always a **single `QuizItem`** (a word or foundational character) plus a distractor pool
- Output is always questions built from the **properties of that one item** (native, english, romanization)
- Directions are the four word-level recognition directions

The name creates a false expectation: a developer adding sentence-level question types might try to extend `composeBatch` with a new direction or a new input shape, rather than recognising that sentence questions are structurally different and belong in a separate composer.

**Sentence questions are a different input shape.** They require a sentence or phrase as context, knowledge of which words appear together, and potentially a different answer mechanism (word-block construction, fill-in, etc.). They cannot be expressed as a new `QuizDirection` on the existing function.

**Audio questions are not a different input shape.** An `audio-to-native` or `native-to-audio` direction would be a new `QuizDirection` case in `makeQuestion` — it still takes a single item and a distractor pool. Audio fits naturally inside a word-item composer.

The current name does not communicate this boundary. It will cause confusion once sentence questions and audio are both on the roadmap.

---

## Decision

We will rename `composeBatch` → `composeWordBatch` and `composeBatchMulti` → `composeWordBatchMulti`.

The boundary is defined by **input shape**, not output format:

- `composeWordBatch` — takes a single `QuizItem`, supports any question modality that can be built from the properties of that item (MCQ, audio). New directions (audio, romanization variants) are added here.
- `composeSentenceBatch` (future) — takes a sentence + target word, a different input shape. Lives as a sibling composer, not an extension of `composeWordBatch`.

The session/batch layer decides which composer to call; neither composer knows about the other.

---

## Rationale

- **Honest naming prevents wrong extension points.** `composeWordBatch` makes it immediately clear that sentence questions are not a missing direction — they need a different function.
- **The boundary is the input, not the output.** Naming by input shape means the function won't need renaming again when audio arrives as a new modality.
- **Sibling composers, not a branching monolith.** `composeSentenceBatch` as a peer makes the system shape obvious and keeps each composer's responsibility tight.
- **No engine changes required for this rename.** This is a naming clarification; no logic changes.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| Keep `composeBatch`, extend it for sentence questions | No rename churn | Conflates two different input shapes; one function ends up responsible for incompatible question types | Input shapes are fundamentally different — forcing them into one function would require branching on input type, violating single responsibility |
| Rename to `composeMCQBatch` | More specific than `composeBatch` | Rules out audio — which is word-based and belongs here | Naming by output format (MCQ) is narrower than the actual boundary (word-item input) |
| Rename to `composeItemBatch` | Generic, accurate | "Item" is vague; doesn't communicate that the input is a single word/foundational character | `composeWordBatch` is more precise and matches the domain language |

---

## Consequences

**Positive:**
- Future developers immediately understand that sentence questions require a new composer, not an extension of `composeWordBatch`
- Audio question directions can be added to `composeWordBatch` without any structural change
- The naming serves as lightweight documentation of the word-item vs. sentence-level boundary

**Negative / Risks:**
- Rename touches call sites in `compose-batch.ts`, its tests, `index.ts` exports, and any consumers (demo app, scripts) — mechanical but not zero effort
- `composeSentenceBatch` interface is still undefined; this ADR does not design it (that requires a PRD for the sentence question feature)

**Neutral:**
- `composeWordBatchMulti` follows the same rename pattern; no logic change

---

## Related

- ADR: `20260512T220218Z-engineering-mastery-is-global-not-per-deck.md` — global mastery model and priority order
- ADR: `20260512T235900Z-engineering-compose-sentence-batch-boundary.md` — `composeSentenceBatch` boundary, what belongs inside it, and where sentence content comes from
