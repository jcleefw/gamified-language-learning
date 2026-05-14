# ADR: Batch Execution Mechanics — Re-serve, Spacing, and Active Window

**Status:** Accepted

**Date:** 2026-05-13

**Deciders:** JC Lee

**Update Note (2026-05-16):** While this ADR remains the source of truth for all SRS business rules (retry caps, sentence thresholds, etc.), the _software architecture_ of the monolithic `runBatch` function mentioned below (especially in D11 and OQ4) has been **superseded** by the `BatchQueueManager` abstraction. See the companion ADR `20260516T113156Z-engineering-adaptive-session-orchestrator.md` for the updated execution architecture.

---

## Context

The current `runBatch` composes a fixed set of questions and runs through them exactly once. A wrong answer updates streak/mastery state but the word is not re-served within that batch — it simply stays in the active window and reappears in the next batch.

Two problems with this:

1. **No within-batch correctness guarantee.** A learner can finish a batch having never answered a word correctly in that batch. The mastery counter still moves, but the learner leaves with unresolved failures.
2. **Sentence questions have no active-window equivalent.** They are not `WordState` entries, so the implicit "stays in active until mastered" re-queue mechanism doesn't apply. Without an explicit re-serve model, sentence questions have no guaranteed re-appearance.

This ADR defines the re-serve mechanics for both word and sentence questions, the active window sizing, and the spacing rules that prevent sentence question fatigue.

---

## Decisions

### D1 — Within-batch completion for word questions ✅ Decided

A batch does not end until every word in the active window has been answered correctly at least once in that batch, subject to per-word retry caps. Words that exhaust their batch cap carry over to the next batch. Words that exhaust their session cap are shelved for the session — they do not return until the next app start (treated as a new session, simulating a new day until scheduling is implemented).

### D2 — Two configurable re-serve levers ✅ Decided

| Constant             | Scope       | Controls                                                            | Resets      | Default |
| -------------------- | ----------- | ------------------------------------------------------------------- | ----------- | ------- |
| `maxRetryPerWord`    | Per batch   | Max re-serves for one word within a single batch                    | Each batch  | 2       |
| `maxRetryPerSession` | Per session | Max re-serves for one word across the entire `runAdaptiveLoop` call | App restart | 6       |

`wrongStreak` accumulation across batches is normal learning behaviour and does not contribute to either cap — these caps are batch-expansion guards only, not mastery signals.

App restart = new session. This simulates a day boundary until FSRS scheduling is implemented.

These constants live alongside `correctStreakThreshold` and `wrongStreakThreshold` in `LEARNING_CONFIG`.

### D4 — Word and sentence questions are served in a single mixed batch ✅ Decided

There is no separate sentence phase or session. `runBatch` assembles one mixed batch from all registered composers — word questions and sentence questions are peers in the same batch. Neither composer knows about the other; the registry and session layer coordinate what gets included.

### D5 — Composers are wired via a registry, not hardcoded calls ✅ Decided

The session layer does not call `composeWordBatchItems` and `composeSentenceBatch` directly. Instead, a **composer registry** holds the set of active composers as pre-bound thunks. `assembleBatchQuestions` runs the registry — it calls each registered thunk and returns a flat merged `QuizQuestion[]`.

Named functions:

| Function                 | Role                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| `composeWordBatch`       | Single word item primitive — one `QuizItem` + pool → `QuizQuestion[]`        |
| `composeWordBatchItems`  | Multi-word wrapper — registers as thunk for word questions                   |
| `composeSentenceBatch`   | Sentence composer — registers as thunk per eligible `SentenceContext`        |
| `assembleBatchQuestions` | Registry runner — calls all registered thunks, returns flat `QuizQuestion[]` |

```ts
// Session registers thunks
registry.add(() =>
  composeWordBatchItems(activeWords, wordPool, { questionLimit }),
);

const masteredWords = activeWords.filter((w) =>
  isMastered(runState.get(w.id), masteryThreshold),
);
for (const ctx of eligibleSentenceContexts) {
  registry.add(() => composeSentenceBatch(ctx, targetWord, masteredWords));
}

// Registry runner assembles the batch
const questions: QuizQuestion[] = assembleBatchQuestions(registry);
// QuizQuestion = MCQQuestion | SentenceQuestion — type-narrow via question.kind
```

This means:

- Adding a future composer (e.g. `composeAudioBatch`) is a registration, not a change to session logic
- Each composer remains a stateless function with explicit inputs — no composer knows about the registry or the others
- The session still owns routing context (`RunState`, `SentenceContext` availability) and prepares inputs before handing off

The registry is a **coordinator**, not a routing orchestrator — it does not decide which composer to call for a given item. That decision stays in the session layer.

### D6 — Sentence question eligibility ✅ Decided

A sentence question becomes eligible when all words in the sentence have `WordState.seen >= MIN_SEEN_FOR_SENTENCE` (default: 2). Mastery is not required. See PRD `20260513T000000Z-sentence-question-ep.md`.

### D7 — Sentence question spacing rules ✅ Decided

To prevent sentence questions from dominating a session when a learner works through a deck quickly:

- **Streak-based exit**: after `sentenceCorrectStreakThreshold` correct answers (default: 3), the sentence question exits the active session pool and is handed to scheduling
- **Daily cap**: a sentence question is served at most `sentenceDailyMax` times per day (default: 2)
- **Batch spacing**: a sentence question is not served in back-to-back batches — at least 1 batch must pass between appearances (`sentenceBatchGap`, default: 1)

### D8 — Early exit is triggered manually by the learner ✅ Decided

The learner can bail out of a batch at any point via an explicit UI action. When triggered:

- The batch ends immediately
- Words with unresolved retries carry to the next batch, same as if they had hit `maxRetryPerWord`
- `RunState` retains all answers recorded up to the exit point — no rollback

### D10 — Sentence questions auto-shelve on consecutive wrong answers ✅ Decided

When a sentence question accumulates `sentenceWrongStreakThreshold` (default: 3) consecutive wrong answers within a session, the engine marks it inactive for that session — it is removed from the active pool and will not reappear until re-activated.

Responsibility boundaries:

- **Engine**: auto-shelves when threshold is hit. No opinion on re-activation.
- **Scheduling** (future): decides when shelved questions return across sessions.
- **Manual override** (placeholder until scheduling exists): UI re-activation that puts the sentence question back into the active pool and resets `sessionWrongStreak` to 0. The engine treats manual re-activation identically to scheduler re-activation — it does not distinguish the source.

The inactive flag is **session-scoped** — it resets at the start of the next session. This means a shelved sentence question automatically returns next session without scheduling or manual intervention.

### D11 — Wrong word re-serves replay the identical question ✅ Decided

When a word is re-served within a batch, the same question (same direction, same distractors) is replayed. No fresh composition on retry.

### D12 — Sentence questions use the same scheduling system as words ✅ Decided

When a sentence question exhausts `sentenceCorrectStreakThreshold`, it is handed to FSRS — the same scheduler used for graduated words. `SentenceState` will need a `reviewCard` equivalent, defined when the scheduling EP is implemented.

### D13 — Sentence questions have their own state type ✅ Decided

Sentence spacing and shelving rules require tracking per sentence. This is a new `SentenceState` type — not an extension of `WordState`.

| Field                | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `sentenceStreak`     | Consecutive correct answers — exit threshold check          |
| `lastBatchSeen`      | Batch number of last appearance — spacing enforcement       |
| `dailyCount`         | Times served today — daily cap enforcement                  |
| `sessionWrongStreak` | Consecutive wrong answers this session — shelving threshold |
| `active`             | Whether the sentence is currently in the active pool        |

Sentence correctness does not affect `WordState.mastery`. The two tracks are independent: word mastery measures recognition, sentence state measures usage. A correct sentence answer never increments mastery; a wrong sentence answer never decrements it.

---

## Open Questions

| #    | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Source    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| OQ1  | **Registry element type** — **Resolved** — each registered composer is a pre-bound thunk `() => QuizQuestion[]`. The session prepares and partially applies all inputs before registering; the registry calls each thunk with no arguments and merges results. Registry element type is `() => QuizQuestion[]`. Alternative considered: registry receives raw inputs and dispatches internally — rejected because it would make the registry a routing orchestrator, violating D5. | B3        |
| OQ2  | **Registry prepared-inputs contract** — **Resolved** — the caller (demo app / host application) resolves eligible `SentenceContext` records from the DB and passes them into the engine alongside words and pool. The engine never touches the DB. Session registers thunks from already-resolved inputs. See `reference/data-pipeline-boundary.md`.                                                                                                                               | B3        |
| OQ3  | **Registry return contract** — **Resolved** — `assembleBatchQuestions` returns flat `QuizQuestion[]` where `QuizQuestion = MCQQuestion \| SentenceQuestion`. Each type has a `kind` discriminant (`'mcq'` \| `'word-block'`). Session and UI type-narrow via `kind`. Sentence retries replay from cache same as word retries.                                                                                                                                                      | B3        |
| OQ4  | **Question cache ownership for D11** — **Resolved** — `runBatch` owns a local `Map<string, QuizQuestion>` keyed by `wordId` or `sentenceId`, built during the first pass. Used for retries, invalidated when `runBatch` returns. Registry and session layer remain stateless.                                                                                                                                                                                                      | B2        |
| OQ5  | **`SentenceState.reviewCard` field** — **Deferred** — `ReviewCard` is not yet implemented in the codebase. Until the scheduling EP is designed, a sentence question that exhausts `sentenceCorrectStreakThreshold` exits the active pool and does not return until the next session. No impact on this ADR.                                                                                                                                                                        | B4        |
| OQ6  | **Sentence re-serves and retry caps** — **Resolved** — sentence wrong answers consume the same `maxRetryPerWord` and `maxRetryPerSession` caps as word questions. Uniform retry handling confirmed by OQ3 (flat merged array, no composer identity needed).                                                                                                                                                                                                                        | M2        |
| OQ7  | **Cap-exhaustion UI signal** — **Resolved** — silent. Words that exhaust their retry cap carry over to the next batch without any UI notification.                                                                                                                                                                                                                                                                                                                                 | M3        |
| OQ8  | **Manual re-activation scope** — **Resolved** — resets `sessionWrongStreak` to 0 and `active` to true only; all other `SentenceState` fields (`sentenceStreak`, `lastBatchSeen`, `dailyCount`) remain intact.                                                                                                                                                                                                                                                                      | M4        |
| OQ9  | **`lastBatchSeen` type** — **Resolved** — integer batch sequence number, sourced from the existing `batchNum` counter in `runAdaptiveLoop`.                                                                                                                                                                                                                                                                                                                                        | M5        |
| OQ10 | **Registry internal access pattern** — **Resolved** — Option A: `RegistryWithThunks` unexported internal type. See detail below.                                                                                                                                                                                                                                                                                                                                                   | EP25-DS01 |

### OQ10 Detail — Registry internal access pattern

`assembleBatchQuestions` is a free function (per D5). It needs to call each registered thunk. The question is how it accesses the internal `thunks` array without exposing it on the public `ComposerRegistry` interface.

Two options were considered:

**Option A — `RegistryWithThunks` unexported internal type**

`createComposerRegistry()` returns a concrete type `RegistryWithThunks` that extends `ComposerRegistry` with a `readonly thunks` getter. `assembleBatchQuestions` accepts `RegistryWithThunks`. Neither the type nor the getter is exported — callers never name it, TypeScript infers the return type. `thunks` is `ReadonlyArray` to prevent external mutation.

**Option B — Shared closure, `assemble()` as method**

Factory returns one object with both `add` and `assemble`. No separate free function — call site becomes `registry.assemble()`.

**Comparison:**

| Dimension      | Option A                                                                                                                       | Option B                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Robustness     | `ReadonlyArray` prevents mutation; slight test friction (mock must include `thunks`)                                           | Closure fully privatises `thunks` — not accessible at all; stronger by construction                  |
| Extensibility  | Multiple assembly strategies (`assembleBatchQuestionsInterleaved`, etc.) are additive free functions; no factory change needed | New strategy requires new method on object or new factory variant — couples assembly back to factory |
| Maintenance    | Two things in sync (factory + free function) via unexported type; low risk in same file                                        | One cohesive unit; lower cognitive overhead                                                          |
| Multi-platform | Tree-shakeable; idiomatic in Angular/React service patterns; `assembleBatchQuestions` importable standalone by any host        | Method ships with object; not independently importable; idiomatic in React Native patterns           |

**Decision: Option A.** `assembleBatchQuestions` must be independently importable by any host application (terminal demo today, web/mobile session layer later) without coupling to how the registry was created. The ADR names it as a standalone free function for this reason. Internal type named `RegistryWithThunks` (not `RegistryInternal`) for legibility in error messages.

```ts
interface RegistryWithThunks extends ComposerRegistry {
  readonly thunks: ReadonlyArray<() => QuizQuestion[]>;
}

export function createComposerRegistry(): RegistryWithThunks { ... }
export function assembleBatchQuestions(registry: RegistryWithThunks): QuizQuestion[] {
  return registry.thunks.flatMap(t => t());
}
```

`RegistryWithThunks` is not exported from `src/index.ts`. Callers type their registry as `ComposerRegistry`; only `assembleBatchQuestions` requires the wider type.

---

## Consequences

**Positive:**

- Learners are guaranteed to answer every active word correctly at least once before a batch closes (within cap limits)
- Sentence questions have a defined appearance budget — fatigue from deck-cramming is bounded
- All re-serve and spacing constants are independently tunable

**Negative / Risks:**

- Batch length is no longer fixed — a struggling learner will experience longer batches
- `SentenceState` is a new type that the session layer must manage alongside `RunState`

**Neutral:**

- `runBatch` gains an inner re-serve loop; composer internals are unchanged
- `LEARNING_CONFIG` gains new constants; existing constants are unchanged
- `QuizQuestion` in `src/types/quiz.ts` is renamed to `MCQQuestion`; `QuizQuestion` becomes the union type — mechanical rename, flagged for DS03

---

## Related

- ADR: `20260512T230000Z-engineering-compose-word-batch-boundary.md` — composer boundary; `runBatch` calls composers, does not extend them
- ADR: `20260512T235900Z-engineering-compose-sentence-batch-boundary.md` — `composeSentenceBatch` interface and `SentenceContext`
- PRD: `product-documentation/prds/20260513T000000Z-sentence-question-ep.md` — sentence eligibility, `SentenceState`, scoring
