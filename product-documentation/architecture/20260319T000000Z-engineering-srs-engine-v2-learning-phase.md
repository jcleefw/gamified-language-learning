# ADR: SRS Engine v2 — Learning Phase

**Status:** Accepted

**Date:** 2026-03-19

**Deciders:** Solo founder

**Supersedes:** [20260302T160536Z-engineering-srs-engine-package.md](20260302T160536Z-engineering-srs-engine-package.md)

---

## Context

The original SRS engine ADR (2026-03-02) described a broad, ambitious design covering
mastery counting, ANKI scheduling, active window management, stuck word shelving,
foundational deck mechanics, question type distribution, and phase transitions — all
designed upfront before any of it was built or validated.

EP16 attempted to implement that design and failed: too many moving parts, too many gaps,
too hard to test incrementally.

EP20 (`packages/srs-engine-v2`) is rebuilding from scratch in strict vertical slices.
This ADR reflects what we've learned from building ST01–ST07 and the scenario work done
to validate the next phase.

**Scope of this ADR**: the Learning phase only — the cycle from `New → Learning → Mastered`.
The Review phase (FSRS / ANKI scheduling) is deferred until the Learning phase is proven.

---

## Problem with the previous design

The original ADR pre-computed all batches upfront via `generateBatches`, slicing the word
pool sequentially: batch 1 = [w1, w2], batch 2 = [w3, w4], etc. This made it impossible
for any word to appear across multiple batches, which meant no word could ever reach
mastery within a single run. The architecture couldn't support its own mastery mechanic.

---

## Decision

Replace the pre-computed batch schedule with a **sliding active window** driven by
runtime state. The run loop owns batch generation dynamically on each iteration.

---

## Core mechanic: sliding active window

A word has one of three states:

| State | Condition |
|---|---|
| **New** | Not yet seen (no RunState entry, or `seen === 0`) |
| **Learning** | `seen > 0` and `correct < masteryThreshold` |
| **Mastered** | `correct >= masteryThreshold` |

The **active pool** holds all words currently in `Learning` state.
The **queue** holds all `New` words not yet introduced.

### Slot allocation rule

```
free_slots = questionLimit - active.length
```

- If `active.length < questionLimit`: pull `free_slots` words from queue into active
- If `active.length >= questionLimit`: no new introductions this batch

### Run loop (per batch)

```
1. Pull free_slots words from queue into active   ← new words introduced here
2. Compose questions from active (questionLimit)
3. User answers questions
4. Update RunState (seen++, correct++ if correct)
5. Retire mastered words from active
6. For each retired word: pull next word from queue into active  ← slot refilled
7. If active is empty AND queue is empty: run complete
8. Otherwise: next batch
```

Step 6 means new words enter at the **end** of the batch that freed a slot, getting their
first question in the **next** batch.

### Example: 6-word deck, questionLimit = 2, mastery = 3 (summary)

```
Batch 1  active: [w1, w2]         → both get a question each
Batch 2  active: [w1, w2]         → 1 away from mastery each
Batch 3  active: [w1, w2]         → w1 masters, slot → w3 enters
         end:    [w2, w3]
Batch 4  active: [w2, w3]         → w2 masters, slot → w4 enters
         end:    [w3, w4]
...and so on until all 6 words mastered
```

### Full scenario walkthrough

```
SETUP
─────
deck      : [w1, w2, w3, w4, w5, w6]
mastery   : correct >= 3
questions : 2 per batch

BATCH 1
───────
Start active: []  →  pull 2 from queue: w1, w2

  q1: w1  ✓  { seen:1, correct:1 }
  q2: w2  ✓  { seen:1, correct:1 }

Mastered: none  →  no slots open  →  no new words
End active: [w1, w2]

BATCH 2
───────
Start active: [w1, w2]

  q3: w1  ✓  { seen:2, correct:2 }
  q4: w2  ✓  { seen:2, correct:2 }

Mastered: none
End active: [w1, w2]

BATCH 3
───────
Start active: [w1, w2]

  q5: w1  ✓  { seen:3, correct:3 }  🎓 MASTERED
  q6: w2  ✓  { seen:3, correct:2 }

Mastered: w1  →  1 slot opens  →  pull w3
End active: [w2, w3]

BATCH 4
───────
Start active: [w2, w3]

  q7: w2  ✓  { seen:4, correct:3 }  🎓 MASTERED
  q8: w3  ✓  { seen:1, correct:1 }

Mastered: w2  →  1 slot opens  →  pull w4
End active: [w3, w4]

BATCH 5
───────
Start active: [w3, w4]

  q9:  w3  ✓  { seen:2, correct:2 }
  q10: w4  ✓  { seen:1, correct:1 }

Mastered: none
End active: [w3, w4]

BATCH 6
───────
Start active: [w3, w4]

  q11: w3  ✓  { seen:3, correct:3 }  🎓 MASTERED
  q12: w4  ✓  { seen:2, correct:2 }

Mastered: w3  →  1 slot opens  →  pull w5
End active: [w4, w5]

BATCH 7
───────
Start active: [w4, w5]

  q13: w4  ✓  { seen:3, correct:3 }  🎓 MASTERED
  q14: w5  ✓  { seen:1, correct:1 }

Mastered: w4  →  1 slot opens  →  pull w6
End active: [w5, w6]

BATCH 8
───────
Start active: [w5, w6]

  q15: w5  ✓  { seen:2, correct:2 }
  q16: w6  ✓  { seen:1, correct:1 }

Mastered: none
End active: [w5, w6]

BATCH 9
───────
Start active: [w5, w6]

  q17: w5  ✓  { seen:3, correct:3 }  🎓 MASTERED
  q18: w6  ✓  { seen:2, correct:2 }

Mastered: w5  →  queue empty, no new words
End active: [w6]

BATCH 10
────────
Start active: [w6]  →  1 slot free, queue empty  →  1 question

  q19: w6  ✓  { seen:3, correct:3 }  🎓 MASTERED

active: []   queue: []

══════════════════════════════════
RUN COMPLETE — all 6 words mastered
Batches: 10    Score: 19 / 19
══════════════════════════════════
```

Note: this scenario assumes all answers correct. With wrong answers, words stay in
Learning longer and take more batches to master. The slot only opens on mastery —
a wrong answer keeps the word in active, blocking introduction of new words until
that word catches up.

---

## Selection rule (when active.length > questionLimit)

Not currently needed — `questionLimit` naturally caps `active.length` at
`questionLimit`. The active pool never exceeds the question limit because new words only
enter when a slot opens.

If the design changes to decouple active pool size from question limit in the future,
selection should prioritise: **weakest first** (lowest `correct / seen` ratio), with
tie-breaking by **closest to mastery** (highest `correct` count).

---

## Mastery rule

```ts
isMastered(ws: WordState): boolean  →  ws.correct >= masteryThreshold
```

- `masteryThreshold` is a single configurable constant (default: `3`)
- No per-word-type differentiation at this stage (deferred)
- No streak tracking — total correct answers only

---

## What's in scope

| Mechanic | Notes |
|---|---|
| Sliding active window | Core mechanic described above |
| Mastery threshold | Single configurable constant |
| Within-run retirement | Mastered words leave active pool permanently for this run |
| Per-batch word summary | Seen / correct per word after each batch |
| Newly mastered announcement | "Mastered: X" printed when a word graduates |
| Run termination | Ends when active empty + queue empty (all mastered) |
| RunState | Ephemeral — resets each run (persistence deferred) |

---

## What's deferred

| Mechanic | Why |
|---|---|
| Review phase (FSRS / ts-fsrs) | Learning phase must be validated first |
| State persistence across runs | RunState is ephemeral for now |
| Per-word-type mastery thresholds | Premature — single threshold until validated |
| Weak-word prioritisation | Only needed when active > questionLimit, which can't happen yet |
| Stuck word / shelving | Deferred until core cycle is proven |
| Question type distribution (MC/audio/word-block) | MC only in v2 |
| Foundational deck mechanics | Deferred |

---

## Package

`packages/srs-engine-v2/` — unchanged. Pure TypeScript, no framework or I/O dependencies.
All logic runnable via `pnpm quizv2` and testable via `pnpm --filter @gll/srs-engine-v2 test`.

---

## Files affected

The `generateBatches` / `runBatchLoop` architecture from ST06 is replaced by a single
`runAdaptiveLoop` that owns the full lifecycle:

```
src/
  engine/
    compose-deck.ts     ← generateBatches removed or deprecated
  runner/
    interactive.ts      ← runBatchLoop replaced by runAdaptiveLoop
  types/
    word-state.ts       ← WordState, RunState, updateRunState, isMastered
    deck.ts             ← Deck type retained; BatchConfig/Batch may be simplified
```

---

## FSRS / Review phase (future)

When a word graduates from Learning, it enters the Review phase. `ts-fsrs` will handle
interval scheduling there, wrapped behind a `SpacedRepetitionScheduler` abstraction:

```ts
interface SpacedRepetitionScheduler {
  scheduleReview(word: WordState, isCorrect: boolean): ReviewResult
  getNextInterval(word: WordState): number
}
```

This is deferred. The abstraction is noted here so the Learning phase types don't
inadvertently close the door on it.

---

## Rationale

**Why sliding window over pre-computed batches:** Pre-computed batches can't support
mastery — a word needs to appear across multiple batches to accumulate correct answers,
which sequential slicing prevents.

**Why questionLimit caps active pool size:** Eliminates the need for a separate
"active window size" config. The pool stays naturally bounded without extra complexity.

**Why single mastery threshold:** Two thresholds (foundational vs. curated) were in the
original ADR but never validated. A single configurable constant is testable now;
differentiation can be added once the core cycle works.

**Why ephemeral RunState:** Persistence requires a storage layer (D1, file, etc.) which
adds I/O coupling. The engine stays pure; persistence is the calling layer's concern.

---

## Consequences

**Positive:**
- Active pool size is bounded by questionLimit — no unbounded growth
- New words enter exactly when a slot opens — no "introduced but never seen" state
- Run termination condition is unambiguous (active empty + queue empty)
- Each mechanic is independently testable

**Negative / risks:**
- `runBatchLoop` and `generateBatches` from ST06 are replaced — some rework needed
- With a small deck and low questionLimit, mastery takes many batches (by design)

**Neutral:**
- The Hono server (`apps/server`) remains untouched until engine is solid

---

## Related

- [SRS Scheduling Libraries Research](../research/20260319T000000Z-srs-scheduling-libraries.md)
- [EP20 Epic Plan](../../.agents/plans/epics/EP20-srs-engine-v2-rebuild.md)
- Superseded: [20260302T160536Z-engineering-srs-engine-package.md](20260302T160536Z-engineering-srs-engine-package.md)
