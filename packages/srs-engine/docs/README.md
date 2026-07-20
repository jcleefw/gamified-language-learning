# SRS Engine v2 — Humanized Explanations

This folder contains three perspectives on how the SRS engine works, written for different audiences and levels of depth.

---

## 📊 [01-stakeholder.md](01-stakeholder.md) — The Product View

**Audience:** Product owners, stakeholders, non-technical readers  
**Time to read:** 5 min  
**Depth:** What it does and why; no code

The engine introduces words in small groups and quizzes you until you prove mastery through consistent correct answers. Streaks go up, mastery goes up; streaks go down, mastery goes down. Only graduate words enter the active pool when a slot opens.

Start here if you want to understand the *why* and the user experience.

---

## 🧠 [02-concepts.md](02-concepts.md) — The Developer View

**Audience:** New developers, architects  
**Time to read:** 10 min  
**Depth:** How the pieces fit together; enough to reason about the design

The engine has two core containers: an **active pool** (words being quizzed right now) and a **queue** (words waiting). A `RunState` Map tracks score and streak for each word. Streak rules drive mastery transitions. Wrong answers re-queue for retry within the batch. The session orchestrator (`AdaptiveSession`) threads state between batches.

Read this when you want to understand the architecture and why decisions were made.

---

## 🔍 [03-walkthrough.md](03-walkthrough.md) — The Trace View

**Audience:** You, when reasoning through a specific scenario  
**Time to read:** 15 min  
**Depth:** Step-by-step with a full 3-word example, tracing each batch

A concrete example: three words, mastery threshold 5, streak thresholds 3/2. Follow w1 from "New" → "Mastery 1" → "Mastery 5" → "Retired", while w2 climbs slowly, and w3 waits in the queue. Watch how retries work, how slots fill, how the session terminates.

Read this when you're debugging a state transition, writing a test, or just need to convince yourself the algorithm actually works.

---

## 📋 [04-deferred-features.md](04-deferred-features.md) — What's NOT (Yet) Implemented

**Audience:** Implementers, product managers  
**When to read**: You're looking at the PRD and wondering why a feature isn't in the engine

This document clarifies the gap between the product specification and current implementation: stuck-word shelving, batch composition priority, ANKI/FSRS scheduling, audio questions, and more. Useful for planning future work or understanding what to expect when consuming the engine.

---

## 🔗 Related files

- `src/learn/index.ts` — Public API exports (`learn` subpath)
- `src/learn/types/word-state.ts` — `RunState`, `WordState`, streak logic
- `src/learn/engine/session.ts` — `updateMasteryState`, `nextActivePool`
- `src/learn/engine/adaptive-session.ts` — `AdaptiveSessionState` orchestration
- `src/learn/engine/batch-queue.ts` — `BatchState`, retry mechanics
- `src/learn/engine/compose-word-batch.ts` — Question generation
- `../CODEMAP.md` — Full package navigation
