# SRS Scheduling Libraries: Research Summary

**Date**: 2026-03-19
**Context**: Evaluating scheduling algorithm options for srs-engine-v2, reviewing the ts-fsrs decision from the SRS Engine ADR.

---

## 1. FSRS (Free Spaced Repetition Scheduler)

The modern, research-backed spaced repetition algorithm developed by Jarrett Ye and the open-spaced-repetition org. Now the default scheduler in Anki. Claims 20–30% fewer reviews than SM-2 for the same retention level. Current version: **FSRS-6** (21 trainable parameters).

### Three core memory variables

| Variable | Meaning |
|---|---|
| **Stability (S)** | Days for retrievability to drop from 100% → 90%. Higher = slower forgetting. |
| **Difficulty (D)** | Inherent complexity of the card. Controls how fast stability grows. Scale: 1–10. |
| **Retrievability (R)** | Current probability of recall. Range: 0–1. |

### Scheduling logic

- **States**: `New → Learning → Review ⟷ Relearning` (on lapse)
- **Ratings**: `Again (1) / Hard (2) / Good (3) / Easy (4)` — all 4 outcomes pre-computed at scheduling time
- **Wrong answer**: Post-lapse stability is recalculated — never a full reset to day 1
- **Desired retention**: Configurable (default 0.9 = 90%); intervals solved to hit exactly that

---

## 2. JavaScript/TypeScript Libraries

### Tier 1: Recommended

**`ts-fsrs`**
- npm: `ts-fsrs`
- GitHub: `open-spaced-repetition/ts-fsrs`
- The **official** TypeScript implementation from the open-spaced-repetition org
- Latest stable: v5.2.3
- FSRS version: FSRS-6 (also supports FSRS-5)
- Module support: ESM, CJS, UMD
- Node.js: ≥ 18.0.0
- Stars: ~600
- Status: Actively maintained; used in production by Rember, LeetFlash, AI Japanese Tutor

```typescript
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

const f = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));
const card = createEmptyCard();
const scheduling = f.repeat(card, new Date()); // all 4 outcomes
const chosen = scheduling[Rating.Good];
// chosen.card = updated Card state
// chosen.log  = ReviewLog entry to persist

// Or single-outcome:
const result = f.next(card, new Date(), Rating.Good);
```

**Card state fields**: `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `state`, `reps`, `lapses`, `last_review`

### Tier 2: Simpler alternative

**`supermemo`**
- npm: `supermemo`
- GitHub: `VienDinhCom/supermemo`
- SM-2 algorithm (original SuperMemo 2)
- v2.0.23 (March 2025), actively maintained
- 100% TypeScript, single pure function

```typescript
import { supermemo, SuperMemoItem } from 'supermemo';

const item: SuperMemoItem = { interval: 0, repetition: 0, efactor: 2.5 };
const next = supermemo(item, 4); // grade 0–5
// next.interval, next.repetition, next.efactor
```

Tradeoff: dead simple, but ~30% less efficient than FSRS. No difficulty/stability model. Fixed exponential interval growth.

### Skip / unmaintained

| Package | Reason |
|---|---|
| `@squeakyrobot/fsrs` | FSRS v4.5, independent impl, less mature |
| `spaced-repetition` | 9 years old — abandonware |
| `@flasd/spaced-repetition` | 5 years old — abandonware |
| `fsrs.js` | Archived; ts-fsrs is the official successor |

---

## 3. Memrise SRS Mechanism

### Algorithm: Fixed 8-step ladder (not SM-2, not FSRS)

```
4h → 12h → 24h → 6d → 12d → 48d → 96d → ~6 months
```

Hardcoded intervals. **No adaptation per-card or per-user.** Wrong answer = full reset to 4h regardless of which step the card was at.

Founded by Greg Detre (Princeton PhD in computational neuroscience) and Ed Cooke (Grand Master of Memory) — strong scientific pedigree, but the resulting algorithm is surprisingly simple. The open-spaced-repetition benchmark team explicitly excluded Memrise: *"it wouldn't perform great anyway, it's about as inflexible as possible."*

### How the garden metaphor maps algorithmically

| Metaphor | Reality |
|---|---|
| Planting a seed | New word introduced in a learn session |
| Greenhouse | Repeated testing within same session before entering SRS queue |
| Watering | Scheduled review at next fixed interval |
| Wilting | Review is due / overdue |
| Difficult words | Auto-flagged words missed repeatedly; reviewed more frequently (mechanism is opaque) |

### What Memrise gets right (UX, not algorithm)

- **Short, fixed sessions** (5–15 min) — reduces dropout for casual learners
- **Progressive within-session reveal**: flashcard → MC → typing before entering SRS queue
- **"Difficult words" mode**: separate review stream for persistently weak items
- **Garden metaphor**: makes interval scheduling tangible without exposing complexity
- Speed Review (gamified, timer-based) vs Classic Review (canonical SRS) separation

### What Memrise gets wrong

- Full reset on wrong answer is punishing and demoralizing at high intervals
- No per-card difficulty — hard items never get shorter intervals, easy items never get longer ones
- Scheduling efficiency is the weakest of the three options researched

---

## 4. Algorithm Comparison

| | Memrise (fixed ladder) | SM-2 (`supermemo`) | FSRS (`ts-fsrs`) |
|---|---|---|---|
| **Adaptivity** | None | Per-card ease factor | Per-card stability + difficulty |
| **Wrong answer** | Full reset to 4h | Steps back | Stability recalculated, no day-1 reset |
| **Scheduling efficiency** | Weakest | ~30% worse than FSRS | Best in class |
| **Card state** | Implicit (8 steps) | `interval, repetition, efactor` | `stability, difficulty, state, due, reps, lapses, …` |
| **Desired retention target** | Not configurable | Not configurable | Configurable (default 90%) |
| **Complexity to implement** | Trivial | Low | Medium |
| **Abstraction needed** | No | Yes (to swap later) | Yes |
| **Maturity** | Production (Memrise) | Production (decades) | Production (Anki default, 700M reviews) |

---

## 5. Decision: ts-fsrs holds

The ADR decision to use `ts-fsrs` behind a `SpacedRepetitionScheduler` abstraction remains sound:

- FSRS is the best-in-class scheduling algorithm for retention efficiency
- The wrong-answer handling (recalculate stability, no full reset) is significantly better than Memrise
- The abstraction layer allows swapping if needed, so lock-in risk is low
- Memrise's mechanisms are worth borrowing for **UX and session design** only, not the algorithm

**What to borrow from Memrise (UX layer, not scheduling):**
- Short, fixed-length sessions with a question limit (already in srs-engine-v2)
- "Difficult words" concept → maps to weak-word prioritisation story
- Progressive within-session reveal for new word introduction

---

## 6. Supplementary

**Parameter optimisation (advanced):** `@open-spaced-repetition/binding` (Rust/WASM) computes personalised FSRS weights from a user's review history. Out of scope until a user base exists. Default FSRS-6 params (trained on 700M reviews) work well out of the box.

**date-fns:** The ADR lists this as a potential runtime dependency for date math alongside ts-fsrs. ts-fsrs handles its own date arithmetic internally; date-fns would only be needed for display-layer formatting.
