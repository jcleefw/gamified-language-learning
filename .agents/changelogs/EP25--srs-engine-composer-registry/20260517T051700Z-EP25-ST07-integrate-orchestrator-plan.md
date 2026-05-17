# Implementation Plan — Integrate Orchestrator in `srs-demo` Web App (EP25-ST07)

**Date**: 20260517T051700Z  
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](file:///Users/jc-everest/projects/experiments/gamified-language-learning/.agents/plans/epics/EP25-srs-engine-composer-registry.md)  
**Story**: EP25-ST07  
**Status**: Planned (TDD Implementation Stage)  

---

### Summary
Integrates the new `AdaptiveSessionState` orchestrator and pure `BatchState` queue functions into the `srs-demo` Vue application. This replaces the legacy, fragmented state variables and manual within-batch retry loops with a clean, single source of truth managed entirely by the SRS engine.

---

### Files to change
- [useSession.ts](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/composables/useSession.ts) — Refactor session save and load helper functions to serialize and deserialize the entire `AdaptiveSessionState` structure, converting Map/Set fields (such as `runState`, `recheckPending`, `recheckReentered`, and `sessionRetryCounts`) to and from JSON-serializable array structures (resolving **OQ3**).
- [App.vue](file:///Users/jc-everest/projects/experiments/gamified-language-learning/apps/srs-demo/src/App.vue) — Replace separate reactive variables with a single cohesive `sessionState` ref and a `globalRunState` ref. Adopt registry-based batch assembly via `assembleBatch` (retiring `composeWordBatchMulti` as per **H4 / ADR D5**). Thread state transitions through `initBatchState`, `nextQuestion`, `submitBatchResult`, `isBatchDone`, and `advanceAdaptiveSession`.

### Files to leave untouched
- Any files under `packages/srs-engine-v2/` — The core engine is fully stable and exports all required primitives and pure functions.
- `apps/srs-demo/src/components/` components (`DeckSelector.vue`, `QuizCard.vue`, `BatchResults.vue`) — Their property interfaces and emitted events are already fully compatible with the new orchestration patterns.

---

### Test plan (in order)

1. **Compilation and Typecheck Gate**:
   Verify that type-checking and building run successfully in the workspace:
   ```bash
   pnpm --filter @gll/srs-demo typecheck
   pnpm --filter @gll/srs-demo build
   ```
2. **Local Dev Server Start**:
   Spin up the Vue app dev server locally:
   ```bash
   pnpm --filter @gll/srs-demo dev
   ```
3. **End-to-End Interactive Verification (via browser subagent)**:
   Conduct a thorough interactive walkthrough of the app using a browser subagent:
   - **Deck Selection**: Load the dashboard, verify completed deck counters are correct, and select the `"let's eat something"` deck.
   - **Batch Limits**: Confirm exactly 3 questions are generated per batch (matching the `wordsPerBatch: 3` default configuration).
   - **Retry Mechanics**: Answer a question incorrectly and confirm it gets re-queued to reappear at the end of the batch (D1/D11).
   - **Results Update**: Answer all remaining items, confirm completion, and verify that the results screen correctly displays updated streaks and mastery states.
   - **Session Reload Persistence**: Refresh the page mid-session and confirm that the state (current question, active pool, and retry counts) is perfectly resumed (OQ3).
   - **Session Reset**: Click "Clear Session" and confirm that all state is wiped, returning the user to the starting deck selector.

---

### Implementation steps (in order)

#### 1. Refactor Session Persistence in `useSession.ts`
- Redefine `PersistedSession` to encapsulate `deckId: string` and a `sessionState` object matching the JSON-serializable layout of `AdaptiveSessionState`:
  ```ts
  interface PersistedSession {
    deckId: string;
    sessionState: {
      active: QuizItem[];
      queue: QuizItem[];
      runState: [string, WordState][];
      recheckPending: string[];
      recheckReentered: string[];
      batchNum: number;
      sessionRetryCounts: [string, number][];
    };
  }
  ```
- Refactor `saveSession(deckId, sessionState)` to map Set/Map fields to arrays (`[...runState.entries()]`, `[...recheckPending]`, etc.) before persisting.
- Refactor `loadSession()` to safely parse the JSON, reconstruct Maps and Sets (`new Map()`, `new Set()`), and return the complete `AdaptiveSessionState`.

#### 2. Modernize Reactive Refs & Computed Properties in `App.vue`
- Import all required orchestrator functions and types from `@gll/srs-engine-v2` (removing the legacy `composeWordBatchMulti`, `nextActivePool`, and `updateMasteryState` imports).
- Rename `CONFIG.questionLimit` to `CONFIG.wordsPerBatch` and set the default to `3`. Add `CONFIG.maxRetryPerWord: 2` and `CONFIG.maxRetryPerSession: 5` constraints.
- Replace the legacy separate refs with:
  ```ts
  const sessionState = ref<AdaptiveSessionState | null>(null);
  const globalRunState = ref<RunState>(new Map());
  const batchState = ref<BatchState | null>(null);
  const currentQuestion = ref<QuizQuestion | null>(null);
  ```
- Establish `currentRunState` computed property to access `sessionState.value.runState` if an active session is in progress, falling back to `globalRunState.value` during deck selection.
- Update `activeItems` and `queue` computed properties to mirror `sessionState.value.active` and `sessionState.value.queue`.
- Update `masteredDeck`, `masteredGlobal`, and `completedDeckIds` to read from `currentRunState.value`.

#### 3. Align Lifecycle & Initialisation Loops in `App.vue`
- Update `onMounted` and `onResume` to correctly restore the full `sessionState` and populate the `globalRunState` from the loaded persistence object.
- Update `onClear` to clear the storage and reset `sessionState.value = null` and `globalRunState.value = new Map()`.
- Refactor `initSession(id)`:
  - Retrieve the deck words.
  - Determine `recheckIds` using `globalRunState` (finding mastered words in the deck).
  - Initialize the orchestrator via `sessionState.value = initAdaptiveSession(words, CONFIG, recheckIds, globalRunState.value)`.
  - Persist immediately with `saveSession(id, sessionState.value)`.

#### 4. Refactor Batch Serving, Answering, and Early Exit in `App.vue`
- Refactor `startBatch()` to:
  - Assemble questions using `assembleBatch(sessionState.value.active, wordPool, [], CONFIG.wordsPerBatch)`.
  - Initialize BQM state: `batchState.value = initBatchState(questions, CONFIG.maxRetryPerWord, sessionState.value.sessionRetryCounts, CONFIG.maxRetryPerSession)`.
  - Serve the first question: call `nextQuestion(batchState.value)`, assign to `currentQuestion.value`, and update `batchState.value`.
- Update `<QuizCard>` template bindings:
  - `:question="currentQuestion"`
  - `:total="batchState.initialCount"`
  - `:index="batchState.results.length"`
- Refactor `onAnswered(result)`:
  - Submit the result: `batchState.value = submitBatchResult(batchState.value, result)`.
  - If `isBatchDone(batchState.value)` is true, trigger `finishBatchAndTransition()`.
  - Otherwise, pull the next question: `nextQuestion(batchState.value)`, re-assign `currentQuestion.value`, and update `batchState.value`.
- Refactor `onExitBatch()`:
  - If no answers have been submitted yet (`batchState.value.results.length === 0`), transition immediately back to `'select'`.
  - Otherwise, trigger `finishBatchAndTransition()` to preserve progress before exiting.

#### 5. Implement Session Transitions & Mastery Diffing in `App.vue`
- Implement `finishBatchAndTransition()` to coordinate state updates in one atomic pass:
  - Drain the batch state: `const output = finishBatch(batchState.value)`.
  - Capture the previous run state: `const prevState = sessionState.value.runState`.
  - Advance the session: `sessionState.value = advanceAdaptiveSession(sessionState.value, output, CONFIG)`.
  - Calculate newly mastered items using `getNewlyMasteredIds(prevState, sessionState.value.runState, uniqueWordIds, CONFIG.masteryThreshold)`.
  - Update `batchScore` and `summary` array for the Results screen.
  - Call `saveSession(deckId.value, sessionState.value)`.

---

### Risks and unknowns
- **Computed Reactivity Propagations**: Vue's computed properties must re-evaluate cleanly when the `sessionState` reference is updated. Since `advanceAdaptiveSession` returns a brand new immutable state object, the re-assignment (`sessionState.value = ...`) is guaranteed to trigger Vue's reactivity system.
- **Serialization Integrity**: Re-constructing Map and Set instances is crucial during `loadSession()`. Direct parsing to plain objects would cause standard SRS map operations (e.g. `.get()`, `.set()`, `.has()`) to throw runtime exceptions. This will be guarded by strict TypeScript types and verified during E2E testing.
