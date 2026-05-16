# ADR: Use Stateful Class Pattern for Within-Batch Execution (BatchQueueManager)

## Status
Accepted

## Context
The SRS engine's batch execution involves complex "within-batch" logic, including:
- Re-enqueueing incorrect items (ADR D1/D2).
- Enforcing per-batch and per-session retry caps.
- Ensuring replay consistency (ADR D11 - serving identical questions on retry).
- Supporting early session exit (ADR D8).

While the session-level orchestrator (`AdaptiveSessionState`) uses an **Immutable Functional Pattern** (tracking progress across days/batches), the within-batch interaction is highly granular, with state changes occurring on every question (every few seconds).

## Decision
We will use a **Stateful Class Pattern** for the `BatchQueueManager`.

### Rationale
1. **Encapsulation of Transient State**: The manager encapsulates "dirty" state (the dynamic queue, retry counters, and the D11 question cache) that is irrelevant to the rest of the application. The UI layer only interacts with a clean, pull-based API.
2. **UI Ergonomics**: A pull-based interface (`.next()` and `.submitResult()`) is significantly more ergonomic for UI drivers (Vue/CLI) than a functional approach where the UI would have to manage and pass back an immutable state object for every single question.
3. **Boundary Separation**: This creates a clear architectural boundary:
    - **Session State (Immutable)**: Long-lived, persistent, orchestrates batches.
    - **Execution State (Mutable)**: Short-lived, transient, manages the "live" quiz.
4. **Testability**: Decoupling the retry logic into a standalone class allows for exhaustive unit testing of edge cases (e.g., hitting retry caps) without needing to simulate a full adaptive session.

## Considered Alternatives

### 1. Pure Functional (Immutable State)
In this approach, the UI would be responsible for holding a `queueState` object and passing it back to the engine on every interaction.
- **Why rejected**: High **Boilerplate and Risk**. The UI (Vue/CLI) would essentially be "holding a hot potato." If the UI developer misses a single state update in the loop, the quiz would break or repeat questions indefinitely. The granular nature of question-by-question updates makes this pattern more painful than beneficial in this specific layer.

### 2. Factory Function / Closures
In this approach, a factory function would return a set of functions (`next`, `submitResult`) that share a private scope.
- **Why rejected**: Essentially a **Class in Disguise**. While it avoids `this` context issues, it provides less visibility in debuggers (the "manager" would just look like an anonymous Object) and offers no standard way to extend behavior (e.g., via inheritance or standard prototyping) if specialized batch managers are needed in the future.

## Consequences
- **Instance Lifecycle**: UI developers must instantiate a new `BatchQueueManager` at the start of every batch and dispose of it at the end.
- **Explicit Finalization**: Results must be retrieved via `.finish()` to be passed back to the `advanceAdaptiveSession` orchestrator.
- **Memory**: The manager holds a reference (cache) to every question served in the batch. This is acceptable given the small size of batch questions (typically 10–50).
