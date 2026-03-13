# apps/server/src/state CODEMAP

In-memory state for the GLL server. All state resets on process restart (no persistence until Stage 3).

## Files

| File | Purpose |
|---|---|
| `store.ts` | `wordStates: WordState[]`, `wordDetails: Map<string, WordDetail>`, `deckId: string` — module-level singletons. `seedStore(states, details)` populates state at startup. `setWordStates(states)` is called after answer processing. |
| `engine.ts` | `SrsEngine` singleton with `DEFAULT_SRS_CONFIG`. `initEngine(config?)` reinitialises with a partial config override. `getEngine()` returns the active instance. |
| `batchRegistry.ts` | `Map<batchId, BatchEntry>` tracking active batches. `BatchEntry = { questions: QuizQuestion[]; correctKeys: Record<string, string> }`. `register(batchId, entry)` stores a batch with server-held correct keys. `get(batchId)` retrieves it. `clearRegistry()` is a test helper. |
