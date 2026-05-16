# ADR: BatchQueueManager Execution Pattern

## Status
~~Accepted~~ → **Superseded** (2026-05-17)

---

## Decision 1 — 2026-05-16 ~~[Superseded]~~

~~We will use a **Stateful Class Pattern** for the `BatchQueueManager`.~~

### ~~Rationale~~
~~1. **Encapsulation of Transient State**: The manager encapsulates "dirty" state (the dynamic queue, retry counters, and the D11 question cache) that is irrelevant to the rest of the application. The UI layer only interacts with a clean, pull-based API.~~
~~2. **UI Ergonomics**: A pull-based interface (`.next()` and `.submitResult()`) is significantly more ergonomic for UI drivers (Vue/CLI) than a functional approach where the UI would have to manage and pass back an immutable state object for every single question.~~
~~3. **Boundary Separation**: This creates a clear architectural boundary:~~
~~    - **Session State (Immutable)**: Long-lived, persistent, orchestrates batches.~~
~~    - **Execution State (Mutable)**: Short-lived, transient, manages the "live" quiz.~~
~~4. **Testability**: Decoupling the retry logic into a standalone class allows for exhaustive unit testing of edge cases (e.g., hitting retry caps) without needing to simulate a full adaptive session.~~

### ~~Considered Alternatives~~

#### ~~1. Pure Functional (Immutable State)~~
~~In this approach, the UI would be responsible for holding a `queueState` object and passing it back to the engine on every interaction.~~
~~- **Why rejected**: High **Boilerplate and Risk**. The UI (Vue/CLI) would essentially be "holding a hot potato." If the UI developer misses a single state update in the loop, the quiz would break or repeat questions indefinitely. The granular nature of question-by-question updates makes this pattern more painful than beneficial in this specific layer.~~

#### ~~2. Factory Function / Closures~~
~~In this approach, a factory function would return a set of functions (`next`, `submitResult`) that share a private scope.~~
~~- **Why rejected**: Essentially a **Class in Disguise**. While it avoids `this` context issues, it provides less visibility in debuggers (the "manager" would just look like an anonymous Object) and offers no standard way to extend behavior (e.g., via inheritance or standard prototyping) if specialized batch managers are needed in the future.~~

### ~~Consequences~~
~~- **Instance Lifecycle**: UI developers must instantiate a new `BatchQueueManager` at the start of every batch and dispose of it at the end.~~
~~- **Explicit Finalization**: Results must be retrieved via `.finish()` to be passed back to the `advanceAdaptiveSession` orchestrator.~~
~~- **Memory**: The manager holds a reference (cache) to every question served in the batch. This is acceptable given the small size of batch questions (typically 10–50).~~

---

## Decision 2 — 2026-05-17 [Active]

We will use a **Pure Function Pattern** for the `BatchQueueManager`. The engine defines a plain serializable `BatchState` interface and a set of pure functions. The **host environment** (terminal loop variable, Vue `ref`, future mobile store) is solely responsible for owning and persisting the state container.

### Context
The original decision assumed the terminal CLI was the primary host. During ST07 Web App integration planning, it became clear that:
1. **State Ownership**: The class instance stores state that Vue (and any future host) cannot "see" or react to natively. The UI needs to hold state in its own reactive system (e.g., `ref<BatchState>`) to enable reactivity, persistence, and resumability.
2. **Host Mismatch**: The terminal app does not need the class's "convenience" — a simple loop variable (`let state = ...`) is sufficient. The class was solving a problem that didn't need solving.
3. **Separation of Concerns**: The engine's job is to provide **rules** ("given this state and a result, what is the new state?"). **Holding** the state between calls is the host's responsibility — consistent with how `AdaptiveSessionState` already works.

### New API Contract
```typescript
export interface BatchState {
  queue: QuizQuestion[];
  results: QuizResult[];
  batchRetryCounts: Map<string, number>;
  questionCache: Map<string, QuizQuestion>;
  retryPerWordCap: number;
  retryPerSessionCap: number;
  sessionRetryCounts: Map<string, number>;
  initialCount: number;
}

export function initBatchState(questions, retryPerWordCap, sessionRetryCounts, retryPerSessionCap): BatchState
export function nextQuestion(state: BatchState): { question: QuizQuestion | null; state: BatchState }
export function submitBatchResult(state: BatchState, result: QuizResult): BatchState
export function finishBatch(state: BatchState): BatchOutput
export function isBatchDone(state: BatchState): boolean
```

### Rationale
1. **Host Owns the Container**: Terminal uses a local `let batchState` variable. Vue uses a `ref<BatchState>`. The engine is agnostic to both.
2. **Reactivity**: Since the full state is a plain object in the Vue `ref`, Vue's reactivity system tracks changes automatically — enabling live progress bars, retry counters, and partial persistence with no extra wiring.
3. **Resumability**: A plain `BatchState` object is serializable (with Map handling). The host can save it to `localStorage` or a file after every question if needed.
4. **Consistency with Session Layer**: `AdaptiveSessionState` is already pure and immutable. `BatchState` should follow the same pattern — the engine defines the shape, the host holds the reference.

### Consequences
- **Breaking Change**: `BatchQueueManager` class is removed from the public API. Callers (terminal demo, web app) must be updated to use the new function API.
- **Terminal Rework**: `runInteractive()` in `learning-io.ts` must thread `batchState` as a loop variable.
- **Vue Simplification**: `App.vue` holds `batchState` in a `ref<BatchState>`, gaining reactivity for free.
- **Map Serialization**: `BatchState` contains `Map` values. JSON serialization for persistence (if needed) remains the host's responsibility.
