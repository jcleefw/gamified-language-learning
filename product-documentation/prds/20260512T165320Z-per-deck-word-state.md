> **Status**: Withdrawn
> **Created**: 20260512T170154Z
> **Withdrawn**: 20260512T220218Z
> **Reason**: Direction invalidated — mastery is global by design. The real learning gap is depth of knowledge (word recall vs contextual usage), not cross-deck duplication. Per-deck tracking would solve the wrong problem. See decision note below.
> **Scope**: Covers per-deck word mastery tracking so learners must prove retention in each deck context. Excludes ANKI/FSRS scheduling, category-aware thresholds, stuck-word shelving, and any UI for browsing word history.

---

# PRD: Per-Deck Word Mastery

**Epic**: EP25
**Author**: JC Lee

---

## 1. Problem Statement

When a learner masters a word in one deck, the SRS engine treats it as mastered everywhere — the word silently disappears from all other decks without the learner ever encountering it in those new contexts. This means a learner can finish a deck without proving they remember shared vocabulary in a new dialogue setting. Mastery becomes a one-time test rather than a demonstration of retained knowledge across contexts.

This affects every learner who studies more than one deck. The cost of not solving it: false confidence — a learner believes they know a word but has only ever seen it in a single context.

---

## 2. Goals

1. A word a learner has mastered in deck-A must appear in deck-B's active pool at least once, giving the learner a chance to prove retention in context.
2. A learner who answers a cross-deck word correctly (while globally still mastered) retires it from that deck without re-doing the full mastery cycle.
3. A learner who answers a cross-deck word wrongly enough to drop global mastery sees the word re-enter the active pool — wrong answers have real consequences.
4. Existing mastery progress is never silently lost when a learner switches decks or reloads.

---

## 3. Non-Goals

- ANKI/FSRS spaced-repetition scheduling per deck
- Category-aware mastery thresholds (curated vs foundational words)
- Stuck-word detection or shelving
- A UI screen for browsing per-word or per-deck history
- Automatically skipping globally-mastered words in a new deck (deferred — see Open Questions)

---

## 4. Users & Context

**Primary user**: A language learner studying Thai vocabulary through dialogue-based decks on the SRS demo webapp. They study in short sessions (5–15 minutes), typically on desktop, switching between decks as they progress. They expect the system to remember their progress across sessions and across decks.

**Secondary user**: Any future consumer of `@gll/srs-engine-v2` building a learning application on top of the engine.

---

## 5. Requirements

1. When a learner switches to a new deck, any word they have already mastered in another deck must appear in the new deck's active word pool.
2. When a learner answers a cross-deck word correctly and their global mastery for that word is still at or above the mastery threshold, the word is marked as mastered in the new deck and removed from its active pool.
3. When a learner answers a cross-deck word wrongly, their global mastery for that word is affected (wrong streak accumulates; mastery decrements if threshold is crossed). The word is not marked as mastered in the new deck.
4. When a learner's global mastery for a word drops below the mastery threshold (due to wrong answers in any deck), the word must not be treated as mastered in any deck — it re-enters the active pool in any deck where it was previously marked mastered in-deck. [Assumed: re-entry on next pool rotation, not mid-batch]
5. A learner's per-deck mastery progress must survive page reloads and session resumption without loss.
6. When a learner starts a deck they have previously fully mastered, the deck must reflect its completed state without resetting their history. [Assumed: completion state based on per-deck mastery, not global mastery]

---

## 6. Success Metrics

**Leading indicators** (observable during demo testing):
- Cross-deck words appear in the new deck's pool on first encounter — 100% of the time
- Correct cross-deck answer retires the word from that deck in the same batch

**Lagging indicators** (post-implementation, once real users exist):
- Learner session length per deck increases — evidence that cross-deck words add meaningful review time rather than being perceived as noise
- Learner return rate to previously-completed decks — baseline: 0% (currently nothing to come back for)

**Baseline**: no per-deck mastery exists today; all metrics start from zero.

---

## 7. Open Questions

| # | Question | Owner | Target |
|---|----------|-------|--------|
| 1 | Should learners be able to opt-in to **skipping globally-mastered words** when starting a new deck — treating the new deck as purely new vocabulary? EP25 defaults to always-re-test; the data model supports skip without further type changes. | JC Lee | Before EP26 |
| 2 | **Backwards compatibility**: learners with existing saved sessions have no per-deck mastery history. On first load after EP25 ships, all globally-mastered words will re-appear across all decks. Is this the intended experience, or should we suppress cross-deck re-testing for words mastered before EP25? | JC Lee | Before implementation start |
| 3 | **Mastery flag lifecycle**: when a word is marked mastered in deck-B but the learner subsequently answers it wrong enough that global mastery drops below threshold, does the per-deck `mastered` flag reset automatically? The spec must clarify whether per-deck mastery is a stored flag (set once, re-evaluated on demotion) or always derived at call-time from global mastery. Misalignment here would cause the word to stay retired from deck-B's pool despite the learner no longer being globally mastered. | JC Lee | Before ST01 implementation |
| 4 | **When is a `DeckWordState` entry created?** The current spec implies the entry is created when the word appears in the queue, but it should only be created on first answer — there is no per-deck performance data before the learner has answered. Needs explicit definition to avoid empty entries polluting the state. | JC Lee | Before ST01 implementation |
| 5 | **Missing demotion user story**: there is no explicit requirement covering the case where a word previously mastered in deck-B re-enters deck-B's pool because global mastery has since dropped. Requirement 4 covers this technically but it should be validated as an intended learner experience — is it acceptable for a "completed" deck to become incomplete again? | JC Lee | Before implementation start |
| 6 | **Cross-deck word ordering in active pool**: Requirement 1 says globally-mastered words "must appear" in a new deck's pool, but does not define where in the pool rotation they appear. Do they enter at the front (tested first) or mixed into the queue alongside unmastered words? Learner experience differs significantly — front-loading could feel like an unexpected quiz before new vocabulary. Define the intended ordering policy. | JC Lee | Before ST02 implementation |
| 7 | **Partial mastery on first cross-deck encounter**: Requirement 2 says one correct answer in deck-B retires the word if globally mastered. But what if the learner's global mastery is at the threshold exactly (e.g. mastery = 2, threshold = 2) and a single correct answer in deck-B doesn't change global mastery — is one correct answer sufficient proof, or should the engine require a streak? The current one-correct-answer rule is lenient; validate this is the intended bar. | JC Lee | Before ST01 implementation |
| 8 | **No definition of "deck" in the engine contract**: `deckId` is currently an app-level concept (a string passed in from the demo app). The engine has no `Deck` type. If EP25 threads `deckId` through engine functions, the engine implicitly takes on a deck concept without owning a deck registry. Does the engine need a `Deck` type, or is a plain `string` deckId sufficient? Misdefining this boundary now creates friction for future multi-language or server-side consumers. | JC Lee | Before ST04 (API design) |
| 9 | **What happens when a deck is deleted or renamed?** `DeckWordState` is keyed by `deckId` string. If a deck ID changes (content update, rename), historical per-deck mastery becomes orphaned — the engine will treat the renamed deck as a new deck. Is there a policy for deck ID stability, or is this an accepted constraint? [Assumed — verify] | JC Lee | Before EP26 |

---

## Decision Record — 20260512T220218Z

**Decision**: Withdrawn. EP25 will not be implemented.

**Reasoning**: After examining the queue filter bug and the current learning model, the fundamental design question was resolved: **mastery is global (context-free)**. A word mastered in any deck is considered mastered everywhere. Per-deck tracking would solve the wrong problem.

The actual learning gap identified is **depth of knowledge** — the current quiz tests word recall in isolation (recognition), but does not test whether a learner can use a word correctly in a sentence (usage). A learner can score well on flashcards but fail at sentence construction. This is the real false-confidence problem.

**Correct priority order going forward**:
1. Fix the `nextActivePool` queue filter bug — mastered words should not re-enter the active pool (small engine fix, EP21 scope)
2. Post-mastery scheduling — FSRS/ANKI, already planned in original product docs
3. Sentence/word-block question type — new EP, tests contextual usage in a sentence

**Open questions preserved for future planning**:
- Is "word block" the intended name for the sentence construction question type?
- Should post-mastery scheduling or sentence questions come first?
- Does `composeBatch` need to be aware of sentence-level question types, or is that a separate system outside the SRS engine?
