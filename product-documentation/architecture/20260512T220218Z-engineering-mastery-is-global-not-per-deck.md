# ADR: Mastery Is Global — Per-Deck Tracking Solves the Wrong Problem

**Status:** Accepted

**Date:** 2026-05-12

**Deciders:** JC Lee

---

## Context

EP25 proposed per-deck word mastery tracking: a word mastered in deck-A would still appear in deck-B's active pool, forcing the learner to prove retention in every new context.

The motivation was a real observed problem — learners can finish a deck without encountering shared vocabulary in new dialogue settings, creating false confidence. A learner believes they know a word but has only ever seen it in a single context.

While investigating EP25, the `nextActivePool` queue filter bug was also found: mastered words were re-entering the active pool on deck switch because `nextActivePool` was pulling from the queue without filtering mastered words first. This was a separate bug, not evidence that per-deck mastery was the right design.

The question that EP25 forced: **what is mastery, and is it per-deck or global?**

---

## Decision

We will treat mastery as **global and context-free**. A word mastered in any deck is considered mastered everywhere. Per-deck tracking will not be implemented.

The false-confidence problem EP25 identified is real, but per-deck tracking solves the wrong part of it. The actual learning gap is **depth of knowledge**: the current quiz tests word *recall* in isolation (recognition — can you identify the word?), but does not test whether a learner can use a word correctly *in a sentence* (usage — can you apply it?). A learner can score perfectly on flashcards and still fail at sentence construction.

Per-deck re-testing would surface the same word again in the same recognition format — it adds repetition, not depth. The correct solution is a different question type that tests contextual usage.

---

## Rationale

- **Mastery as a one-time recognition test is the gap, not the scope of that test.** Re-testing the same recognition question in a second deck does not prove deeper knowledge — it just repeats the same shallow proof.
- **Per-deck tracking adds data model complexity for marginal learning gain.** The `DeckWordState` model introduced in EP25 required threading `deckId` through engine functions, created orphaned state risk on deck rename, and raised unresolved questions about backwards compatibility and mastery flag lifecycle.
- **The queue filter bug was the real cross-deck issue.** Mastered words re-entering the active pool on deck switch was a filtering bug (`nextActivePool` not excluding mastered words), not a signal that mastery should be scoped per-deck.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| Per-deck mastery (EP25) | Learner must prove retention in each new context | Adds data model complexity; solves repetition not depth; `DeckWordState` raises multiple unresolved design questions | Solves the wrong problem — same question type, just repeated |
| Global mastery (this decision) | Simple, consistent model; no state management complexity | Does not address depth-of-knowledge gap on its own | Correct model — the gap is addressed by sentence question types, not re-testing |

---

## Consequences

**Positive:**
- Engine mastery model stays simple — no `deckId` threading, no per-deck state, no orphaned-state risk
- The real false-confidence problem is addressed at the right level: a new question type (sentence/word-block) that tests contextual usage
- Priority order is clarified for upcoming work

**Negative / Risks:**
- A learner who masters a word in one deck will never be re-tested on it in another deck in recognition format — this is an accepted constraint given that the sentence question type will address contextual usage directly

**Neutral:**
- EP25 PRD is preserved as a withdrawn document at `product-documentation/prds/20260512T165320Z-per-deck-word-state.md` — the open questions there (deck ID stability, mastery flag lifecycle, etc.) remain useful inputs if per-deck tracking is ever revisited

---

## Priority Order Established

1. Fix `nextActivePool` queue filter bug — mastered words must not re-enter active pool on deck switch ✅ Done (commit `ce2e3d7`)
2. Post-mastery scheduling — FSRS/ANKI, already planned in original product docs
3. Sentence/word-block question type — new EP, tests contextual usage in a sentence

---

## Related

- Withdrawn PRD: `product-documentation/prds/20260512T165320Z-per-deck-word-state.md`
- ADR: `20260512T230000Z-engineering-compose-word-batch-boundary.md` — `composeWordBatch` boundary and the role of a future `composeSentenceBatch`
