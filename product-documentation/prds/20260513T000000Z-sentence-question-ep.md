# PRD: Sentence Question Feature

**Date**: 20260513T000000Z
**Status**: Draft
**Epic**: EP26 (proposed)
**Related ADR**: [composeSentenceBatch boundary](../architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md)
**Related ADR**: [Mastery is global, not per-deck](../architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md)

> **Scope**: The learner experience for sentence-level questions — what the learner sees, when it appears, what it tests, and how performance is tracked. Defines enough product shape to finalize the `composeSentenceBatch` interface and `SentenceContext` data model.

---

## 1. Why This Feature

The current quiz tests word *recognition*: given a prompt, identify the correct word. A learner can score perfectly on flashcards and still be unable to use a word correctly in a sentence. This is the depth-of-knowledge gap identified in the mastery ADR.

Sentence questions close this gap by testing *contextual usage*: the learner must demonstrate they understand how a word functions within a sentence, not just what it means in isolation.

---

## 2. When a Sentence Question Appears

Sentence questions are unlocked **per sentence, on minimum exposure**. A sentence question becomes eligible when every word in the sentence has been seen at least **2 times** (`WordState.seen >= 2` for all words). Mastery is not required.

This means:
- The learner has encountered every tile before the sentence question appears — ordering is the challenge, not tile recognition
- The sentence can unlock well before any word is mastered, keeping sentence questions motivating rather than a late-game reward
- The threshold is a **named configurable constant** (`MIN_SEEN_FOR_SENTENCE`, default `2`) — empirical tuning expected

The session routing rule:
```
sentence: all words seen >= 2 + SentenceContext exists → composeSentenceBatch
sentence: any word seen < 2                            → sentence blocked
word unmastered                                        → composeWordBatch
```

Words with no sentence in the corpus are not tested at sentence level — recognition mastery (and FSRS review) is the only active track for them.

---

## 3. Question Formats

Two formats are supported. Both require a sentence context. Both belong inside `composeSentenceBatch`.

### 3a. Fill-in-the-blank

The target word is blanked out from a native sentence. The learner picks the correct word from 4 choices.

**Prompt**: `"나는 ___ 먹어요."` *(I ___ eat.)*
**Choices**: a) 사과를  b) 빠르게  c) 파란  d) 많이
**Answer**: a) 사과를

This tests whether the learner can identify the correct word *in its grammatical position* — not just word recall. The distractors are other known words, drawn from the same distractor pool as word questions.

### 3b. Word-block construction

The learner arranges word tiles into the correct sentence order. Two directions are supported:

| Direction | Prompt | Tiles |
|-----------|--------|-------|
| `english-to-native` | English sentence shown | Native word tiles to arrange |
| `native-to-english` | Native sentence shown | English word tiles to arrange |
| `native-to-romanization` | Native sentence shown | Romanization tiles to arrange |
| `romanization-to-native` | Romanization sentence shown | Native word tiles to arrange |

**Example — english-to-native:**
Prompt: `"I eat an apple."`
Tiles (shuffled): `[Yo]` `[como]` `[una]` `[manzana]`
Answer: `Yo` → `como` → `una` → `manzana`

**Example — native-to-english:**
Prompt: `"Yo como una manzana."`
Tiles (shuffled): `[I]` `[eat]` `[an]` `[apple]`
Answer: `I` → `eat` → `an` → `apple`

Word tiles are the words of the sentence itself — no distractors needed (ordering is the challenge).

**Tile reveal (UI requirement)**: Because words may not be mastered when the sentence question appears, the learner must be able to tap a tile to reveal its meaning in the other language. The engine is responsible for providing sufficient data per tile — the UI must not do its own word lookups. Each tile carries both forms:

```ts
interface SentenceTile {
  native: string;         // native language form
  romanization: string;   // romanization of native form
  english: string;        // English form
  wordId: string;         // reference back to the source QuizItem
}

interface SentenceQuestion {
  kind: 'word-block';
  sentenceId: string;
  direction: 'english-to-native' | 'native-to-english';
  prompt: string;
  tiles: SentenceTile[];  // shuffled by composer; shuffle: false option for tests
  answer: string[];       // correct tile order as wordId[]
}

// MCQQuestion is the renamed QuizQuestion (existing type in src/types/quiz.ts)
interface MCQQuestion {
  kind: 'mcq';
  wordId: string;
  direction: QuizDirection;
  prompt: string;
  choices: QuizChoice[];
}

// Union type — used by session, cache, and UI
type QuizQuestion = MCQQuestion | SentenceQuestion;
```

The composer sets which field is the tile face and which is the reveal based on direction. `nativeWordOrder` stores `wordId` references — tile fields (`native`, `romanization`, `english`) are resolved via DB join before the question is constructed. The UI receives fully-resolved tiles and does no secondary lookups.

---

## 4. Sentence Content — Corpus

Sentence content is **pre-written**. Each corpus entry (`SentenceContext`) is a sentence paired with one or more target words it is designed to test.

Minimum fields required:

| Field | Type | Purpose |
|-------|------|---------|
| `sentenceId` | `string` | Stable identifier |
| `targetWordId` | `string?` | The word this sentence tests for fill-in-the-blank. Optional — word-block-only sentences omit it. Must equal `nativeWordOrder[blankPosition]` when present. |
| `nativeSentence` | `string` | Full native sentence — used as prompt for `native-to-english` word-block and display context |
| `englishSentence` | `string` | Full English sentence — used as prompt for `english-to-native` word-block |
| `nativeGappedTemplate` | `string?` | Pre-built gapped native sentence for fill-in-the-blank (e.g. `"หิวแล้วไป___อะไรกัน"`) — required when `targetWordId` is set; omitted for word-block-only sentences; runtime construction is unsafe for space-less languages |
| `nativeWordOrder` | `string[]` | Ordered `wordId` refs — tiles for `english-to-native` and `romanization-to-native`; tile face is `tile.native` |
| `englishWordOrder` | `string[]` | Ordered `wordId` refs — same words as `nativeWordOrder`; tile face is `tile.english` for `native-to-english` |
| `romanizationSentence` | `string?` | Full romanized sentence — prompt for `romanization-to-native`; required when `romanizationWordOrder` is set |
| `romanizationWordOrder` | `string[]?` | Ordered `wordId` refs — same words; tile face is `tile.romanization` for `native-to-romanization` |

> **Note**: A single sentence can serve multiple target words if each appears in it, but each `SentenceContext` record is scoped to one `targetWordId`. Two records pointing at the same sentence is fine.

---

## 5. Scoring and Mastery State

**Open question — requires product decision.**

Two options:

| Option | Behaviour | Trade-off |
|--------|-----------|-----------|
| **Type-agnostic scoring** | Sentence correct/wrong feeds the same mastery counter as word questions | Simple — no new state; but a mastered word (mastery=5) has nowhere to go on the streak counter |
| **Separate usage track** | Sentence performance is tracked independently (e.g. `usageMastery`) | Honest model — recognition and usage are different skills; adds a new state field |

The mastery counter tops out at 5 (graduation). A word that has already graduated and is in FSRS review cannot meaningfully increment further. This makes type-agnostic scoring a no-op for currently mastered words.

**Decided**: sentence correctness feeds `SentenceState` only — it never mutates `WordState.mastery` or triggers FSRS re-seeding. Word mastery measures recognition; sentence state measures usage. The two tracks are independent. Scoring integration with FSRS is deferred to a follow-on EP.

---

## 6. Session Flow (Updated)

```
word unmastered
  └──▶ composeWordBatch
         └── correct streak → mastery += 1
         └── mastery = 5 → GRADUATED → FSRS seeded (ReviewCard created)

sentence: all words seen >= 2 + SentenceContext exists
  └──▶ composeSentenceBatch
         └── fill-in-the-blank (MCQ)
         └── word-block construction (tile ordering)
         └── performance recorded (phase 1: does not affect mastery or FSRS)

sentence: any word seen < 2
  └──▶ sentence blocked (word questions continue as normal)

word with no sentence in corpus
  └──▶ FSRS review only once mastered (no sentence question track)
```

---

## 7. What This PRD Does Not Cover

- `composeSentenceBatch` internal implementation — that is the ADR's job
- Corpus authoring tooling — out of scope for phase 1 (sentences are hand-authored alongside deck data)
- Audio sentence questions — deferred; would extend `SentenceContext` with audio fields
- Sentence-level FSRS scheduling — deferred to follow-on EP once usage performance data exists

---

## 8. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ1 | Does word-block construction show all sentence tiles, or only tiles for words the learner has seen? | Product | **Closed** — sentence unlocks only when all words have `seen >= 2`; all tiles are familiar by definition |
| OQ2 | What happens when a learner gets a sentence question wrong — is it re-queued in the same session? | Product | Open — recommend yes, same re-queue logic as word questions |
| OQ3 | Is the `blankPosition` field sufficient for fill-in-the-blank, or do we need a `gappedSentence` string pre-computed? | Dev | Open — runtime construction from `wordOrder` + `blankPosition` is sufficient |
| OQ4 | Can one word have multiple `SentenceContext` entries (tested across multiple sentences)? | Product | Open — yes is the natural answer; session pick logic (random, ordered) TBD |
| OQ5 | Does sentence performance eventually feed FSRS re-scheduling? | Product + Dev | Deferred to follow-on EP |

---

## 9. Related

- ADR: [composeSentenceBatch boundary](../architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md)
- ADR: [composeWordBatch rename and boundary](../architecture/20260512T230000Z-engineering-compose-word-batch-boundary.md)
- ADR: [Mastery is global, not per-deck](../architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md)
- PRD: [SRS learning path](20260226T100000Z-srs-learning-path.md)
