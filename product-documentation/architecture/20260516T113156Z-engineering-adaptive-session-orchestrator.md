# ADR: Extracting Adaptive Session Orchestrator

**Date**: 20260516T113156Z
**Status**: Accepted

**Superseded by**: N/A
**Epic**: N/A
**RFC**: N/A

---

## Context

Both the CLI demo (`packages/srs-engine-v2/demo/learning-io.ts`) and the Vue UI (`apps/srs-demo/src/App.vue`) implement the exact same boilerplate state-management logic to run the core "adaptive loop." They independently track `activeItems`, `queue`, `runState`, `recheckPending`, and `recheckReentered`, and pass these variables back and forth between engine functions (`updateMasteryState`, `nextActivePool`) at the beginning or end of every batch.

This leads to duplicate code, brittle state synchronization, and a leaky abstraction where UI layers must deeply understand the engine's internal retry and queueing mechanisms.

## Decision

We will extract orchestration logic into two distinct, decoupled pure-functional layers within the core engine:

1. **Session State Manager (`adaptive-session.ts`)**:
   - Defines an `AdaptiveSessionState` interface encapsulating the five core state properties.
   - Provides `initAdaptiveSession` to yield the starting session state.
   - Provides `advanceAdaptiveSession` to process batch results (`updateMasteryState`, `nextActivePool`) and return the next immutable `AdaptiveSessionState`.

2. **Batch Assembler (`assemble-batch.ts`)**:
   - Instead of the orchestrator hardcoding which question composers to run (e.g., forcing MCQs or sentences), we will implement the **Registry/Dependency Injection Pattern**.
   - The engine provides a pure `assembleBatch(activeItems, composers)` function.
   - The consumer app (UI/CLI) injects exactly the composers it wants (e.g., `[mcqComposer, wordBlockComposer]`) based on user preferences.

3. **Batch Queue Manager (`batch-queue.ts`)**:
   - To resolve the "within-batch retry" loop, we will introduce a stateful `BatchQueueManager` class/module in the engine.
   - The UI instantiates the queue with the assembled questions and a `retryCap`.
   - The UI acts as a dumb renderer: it calls `batch.next()`, waits for user input, and submits `batch.submitResult()`.
   - The engine handles re-queueing failed questions automatically until the queue is empty, at which point the final results are passed to `advanceAdaptiveSession`.

This achieves the "best of both worlds": the engine fully encapsulates the complex SRS math, retry loops, and state transitions, while the consumer app retains total control over _what_ types of questions are generated.

## Consequences

**Positive**:

- Consumer apps (CLI and UI) are completely decoupled from internal engine state-tracking intricacies.
- UI components can treat the adaptive session state as a single reactive object or store.
- Eliminates duplicate state-syncing bugs across different platforms.
- Adheres to the engine's strict pure-functional architecture by relying on `State + Action -> NextState`.

**Negative**:

- Slightly increases the API surface of the engine.

**Neutral**:

- Requires a one-time refactor of both the Vue app and the CLI demo to adopt the new abstraction.

## Performance & Scalability

Because the Orchestrator, State Manager, and Batch Assembler are strictly pure functions (`State + Action -> NextState`), the engine is inherently highly scalable:

- **Client-Side Deployment (Current)**: The engine runs entirely on the user's device (browser or Node). Scalability is infinite as the compute load is distributed across users' hardware, with zero server load or network latency during the adaptive loop.
- **Server-Side API (Future)**: The pure-functional design allows for flawless horizontal scaling (e.g., AWS Lambda/Kubernetes). To handle the stateful `BatchQueueManager` in a stateless backend, two paths are identified:
  - **Stateless/Payload**: The client sends the entire queue state in the request payload (High scalability, high payload).
  - **Fast Cache (Redis)**: The queue state is persisted in a centralized cache, allowing any server instance to process the next answer (Optimized payload, requires shared cache).

## Open Questions

1. **Handling the "Sentence" Track**: Should `advanceAdaptiveSession` accept mixed `QuizResult[]` and internally filter out sentences (or route them to a future `updateSentenceState`), or should the consumer app filter them out before passing word results to the session state?
2. **State Serialization**: `AdaptiveSessionState` contains `Map` (for `RunState`) and `Set` (for rechecks) which don't serialize natively to JSON. Should we provide serialization/deserialization helpers in the engine?
3. **Global Mastery vs. Local Deck State**: When initializing a new deck via `initAdaptiveSession`, we pass in the existing `RunState`. We need to ensure that `initAdaptiveSession` doesn't accidentally prune mastery states for words that exist in _other_ decks. Is cloning the passed-in `Map` sufficient for global tracking?

## Related

- ADR: `20260513T000000Z-engineering-batch-execution-mechanics.md` — Defines the underlying business rules (retry caps, sentence thresholds) that the `BatchQueueManager` and `adaptive-session.ts` must enforce.
