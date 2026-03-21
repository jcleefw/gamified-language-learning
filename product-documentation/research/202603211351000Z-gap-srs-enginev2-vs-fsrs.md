Good call. Let me lay out the design space — the questions we need to resolve before any stories can be written. I'll flag where I have a strong opinion and where I'm genuinely uncertain.

---

## The Core Tension: Two Different Models of "Word State"

EP20's [WordState](cci:2://file:///Users/jc.lee/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/word-state.ts:0:0-7:1) is a **within-run streak counter**. FSRS's `Card` is a **cross-session memory model**. They're doing fundamentally different jobs:

| | EP20 [WordState](cci:2://file:///Users/jc.lee/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/word-state.ts:0:0-7:1) | FSRS `Card` |
|---|---|---|
| Time scale | Within a single run | Days → months |
| What it tracks | Streak, mastery level | Stability, difficulty, due date |
| Reset? | Every run (ephemeral) | Never — it accumulates forever |
| Drives | When a word "graduates" in a session | When a word is due for review |

EP21's job is: **what happens after a word graduates from Learning?**

---

## The Big Design Questions

### 1. What triggers FSRS entry?

A word enters the Review phase when `mastery >= masteryThreshold` (currently 5). At that moment, `ts-fsrs` needs to be called for the **first time** on that word, creating an initial `Card` from a blank state.

**Option A** — FSRS entry happens at the end of the Learning run: when the run complete screen shows, every mastered word gets its first FSRS `Card` computed and persisted.

**Option B** — FSRS entry happens lazily when the user opens a Review session: words that graduated get their initial Card created on first demand.

I lean **Option A** because it's cleaner — the Learning run is the producer, the Review session is the consumer. No ambiguity about "does this word have a Card yet?"

---

### 2. The Rating problem: binary → FSRS 4-way

This is the most impactful design decision. FSRS wants `Again / Hard / Good / Easy`. Our quiz only knows right/wrong.

**Option A — Map binary to FSRS directly:**
- Wrong → `Again`
- Right → `Good`

Simple. Loses information. FSRS still works correctly — it just can't distinguish a "barely remembered" from a "trivially easy" answer.

**Option B — Introduce self-rating:**
After answering correctly, show the user four options: Hard / Good / Easy. Wrong always maps to Again automatically. This is how Anki works.

**Option C — Infer from response time:**
Track how long it takes to answer. Fast correct → `Easy`, slow correct → `Hard`, etc. No UI change needed.

**My opinion**: Start with **Option A** (binary map). It's unblocking — you get FSRS working end to end without any UX change. Option B can come in a later story once you've validated the plumbing works.

---

### 3. Persistence — this is the elephant in the room

EP20's RunState was **intentionally ephemeral**. FSRS is **completely pointless without persistence** — intervals are across days, not seconds. You can't have FSRS without storing the Card state somewhere between sessions.

The question is: where?

- **JSON file on disk** — dead simple for a CLI runner, zero infra, unblocks EP21 now. Can be swapped later.
- **D1 / Cloudflare** — the real target from the architecture ADR, but requires the Hono server to be wired up (still deferred in EP20's scope).
- **In-memory with a serialise/load step** — load from file at start, persist to file on exit. Same as JSON file, just framed differently.

For a `pnpm quizv2`-style runner staying in the spirit of EP20, I'd say **JSON file** is the right move. It keeps the engine pure (the runner script handles I/O), doesn't touch Hono, and unblocks the full FSRS loop.

**Does that feel right to you, or do you want to wire Hono at the same time?**

---

### 4. What does a "Review session" look like?

In Learning, words appear every batch because you're working toward mastery. In Review, a word only appears when `card.due <= now`. A session might have:

- 0 words due (user comes back too early)
- A handful (daily review)
- A backlog (user missed several days)

**Questions for you**:
- Is the Review session a separate command (e.g. `pnpm reviewv2`), or does the existing `pnpm quizv2` flow detect "you have X words due" and offer it?
- Do you want a session cap (e.g. max 20 reviews per sitting), or review everything that's due?

---

### 5. Relationship between WordState and Card — do they merge or coexist?

Right now [WordState](cci:2://file:///Users/jc.lee/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/word-state.ts:0:0-7:1) holds learning-phase data. When a word gets a FSRS `Card`, do we:

**Option A — Keep them separate**: [WordState](cci:2://file:///Users/jc.lee/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/word-state.ts:0:0-7:1) for learning counters, `FsrsCard` for review scheduling. A word in Review has both — WordState becomes historical, Card becomes authoritative for scheduling.

**Option B — Extend WordState**: Add optional `card?: Card` field. `null` = still in Learning, populated = graduated to Review.

**Option C — Replace WordState entirely for graduated words**: Once a word is in Review, [WordState](cci:2://file:///Users/jc.lee/projects/experiments/gamified-language-learning/packages/srs-engine-v2/src/types/word-state.ts:0:0-7:1) is archived and `Card` is the single source of truth.

I'd lean **Option B** — it's the simplest extension that doesn't require a new lookup structure. But Option A keeps things cleaner if you ever want WordState to persist across runs for the Learning phase too.

---

## Where I'd Start the First Story

If I were designing the slice sequence, I'd start here:

1. **Persistence layer** — JSON file read/write for Card state. Pure I/O utility, no FSRS yet.
2. **FSRS scheduler wrapper** — implement the `SpacedRepetitionScheduler` interface from the ADR using `ts-fsrs`. Unit-testable in isolation.
3. **Graduation hook** — at run end, call the scheduler for each mastered word, persist the resulting Card.
4. **Review session** — load due cards, run a quiz loop against them, update and re-persist Card state after each answer.

---

## What I want to understand better before going further

- **Are you running both Learning and Review in the same `pnpm quizv2` session, or separate commands?**
- **JSON persistence for now — yes/no?**
- **Binary rating (right/wrong → Good/Again) to start, or do you want to design the 4-way rating UX now?**
- **Does the FSRS "short-term schedule" (the within-day steps for new/relearning cards) matter to you?** ts-fsrs has `enable_short_term` — when a card is in `Learning` or `Relearning` state (FSRS states, not our states), it schedules in minutes/hours before promoting to day-scale intervals. That might clash with a batch-based terminal runner.