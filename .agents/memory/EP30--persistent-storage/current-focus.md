# Current Focus — EP30 Persistent Storage

**Branch**: `EP30--persistent-storage`  
**Last updated**: 2026-06-20

---

## Active Epic

**EP30** — Persistent Storage Layer

---

## Current Status

**Pre-implementation / Planning**

No stories have been started. Decision reached at end of previous session to prioritize persistence before tackling any deferred learning mechanics.

---

## Last Session Outcome

Completed documentation overhaul for `srs-engine-v2`:

- Created `docs/01-stakeholder.md`, `02-concepts.md`, `03-walkthrough.md` — humanized engine explanations at three levels
- Created `docs/04-deferred-features.md` — clarifies what the PRD specifies vs. what is actually implemented
- Refactored `README.md` (118 → 14 lines) and updated `CODEMAP.md` to point to `docs/` as entry point
- Verified all 5 previously identified doc gaps against actual source code
- Commits: `f31dac8` (docs), `6b677d2` (deferred features doc)

---

## Why Persistence First

EP21 (Review Phase / FSRS) is the highest-value next milestone but is **blocked on persistence**. FSRS scheduling (`card.due <= now`) is meaningless without state surviving between sessions.

All deferred learning mechanics (shelving, batch priority, continuous wrong reset) are quality improvements on a working engine — useful but don't unlock a new phase.

**Logical sequence**:
1. **Persistence layer (EP30)** — serialize `RunState` (Map), `recheckPending`/`recheckReentered` (Sets), `SentenceRunState` between sessions
2. **FSRS / Review phase (EP21)** — now unblocked; graduated words scheduled at day-scale intervals
3. **Deferred learning mechanics** — polish on top of two-phase system

---

## Key Design Question to Resolve

`AdaptiveSessionState` uses `Map` and `Set` which don't serialize to JSON natively (ADR open question).

**Decision needed**: serialization helpers in the engine, or handled in the app layer?

**Relevant ADR**: `product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md` — has `ReviewScheduler` interface and `ReviewCard` design already drafted.

---

## Immediate Next Steps

1. Read review-phase ADR in full to understand `ReviewScheduler` / `ReviewCard` contract
2. Decide serialization boundary: engine-owned helpers vs. app-layer concern
3. Define EP30 stories: what gets persisted, where (JSON file → D1 later), and what the API surface looks like
4. Consider whether `initAdaptiveSession` needs a `load` counterpart for resuming saved state
