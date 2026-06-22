# EP25-ST07: Integrate Orchestrator in `srs-demo` Web App

**Created**: 20260517T153105Z
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](file:///Users/jc-everest/projects/experiments/gamified-language-learning/.agents/plans/epics/EP25-srs-engine-composer-registry.md)
**Status**: Complete ✅

## Summary

Integrates the new `AdaptiveSessionState` orchestrator and pure `BatchState` queue functions into the `srs-demo` Vue application. This replaces the legacy, fragmented state variables and manual within-batch retry loops with a clean, single source of truth managed entirely by the SRS engine.

## Files Modified

### [useSession.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/composables/useSession.ts)

- Refactored `saveSession` and `loadSession` to serialize and deserialize the entire `AdaptiveSessionState` structure, converting Map/Set fields (such as `runState`, `recheckPending`, `recheckReentered`, and `sessionRetryCounts`) to and from JSON-serializable array structures.

### [App.vue](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/App.vue)

- Replaced separate reactive refs (`activeItems`, `queue`, `runState`, `recheckPending`, `recheckReentered`) with `sessionState = ref<AdaptiveSessionState | null>(null)` and `globalRunState = ref<RunState>(new Map())` refs.
- Refactored computed fields (`activeItems`, `queue`, `masteredDeck`, `masteredGlobal`) to read directly from the new unified state.
- Converted `completedDeckIds` from a computed property to an event-driven `ref` and introduced the `recalculateCompletedDecks()` helper to run on mount, on session clear, and on batch completion. This optimizes performance at scale and models a future database-backed query layer.
- Optimized word mastery checks to query `currentRunState` directly rather than constructing default `WordState` objects using temporary spreads.
- Resolved session resume edge-case where resuming a fully completed session led to a blank screen by transitioning directly to the results screen.
- Adopted registry-based batch assembly via `assembleBatch` (retiring the legacy `composeWordBatchMulti` import as per **H4 / ADR D5**).
- Implemented pure `BatchState` transition flow using `initBatchState`, `nextQuestion`, `submitBatchResult`, and `isBatchDone`.
- Integrated `advanceAdaptiveSession` to perform atomic session transitions at the end of every batch.

### [DeckSelector.vue](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/components/DeckSelector.vue)

- Optimized word count rendering inside the deck button loop by replacing inline `deckToQuizItems(deck).length` template calls with a cached computed property `decksWithCounts`.

### [QuizCard.vue](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/components/QuizCard.vue)

- Relocated the `watch` import from the middle of the `<script setup>` block to the top of the file alongside `ref` for clean formatting.

## Behavior Preserved / New Behavior

- **Pure BQM Orchestration**: Within-batch retries are fully managed by the engine (D1/D11). Incorrect questions are cached on their first serve and re-served at the end of the batch.
- **Global Mastery Sync**: Mastery state changes are globally persistent, ensuring computed indicators on the select deck screen and completed deck checks remain correct.
- **Scale-Ready Calculations**: Deck completion status evaluates event-drivenly rather than reactively, optimizing scaling for future asynchronous DB-backed queries.
- **OQ3 Resolved**: Full session states (including streak numbers, recheck categories, and session-wide retry counts) are robustly persisted across page reloads.
- **SRS Rechecks**: Completed words are restored to `recheckIds` on starting new sessions to ensure correct spacing algorithms.

## Next Steps

- Transition to Phase 3 development: **EP25-ST08** for introducing sentence state tracking and dynamic spacing within the orchestrator loop.
