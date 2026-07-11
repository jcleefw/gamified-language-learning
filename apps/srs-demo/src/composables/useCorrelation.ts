/**
 * Correlation-id foundation (EP40-ST01). A `CorrelationId` is minted once per
 * SERVED question and reused for that question's answer POST and any recheck
 * re-ask of the same word within the batch — it is the root of the debug-trace
 * timeline (question served → answer request → server transition row).
 *
 * Threading rule: the id is held app-side, keyed by wordId, NOT inside the pure
 * engine's batch-state/QuizResult types (the srs-engine-v2 library boundary
 * forbids app glue). A learning batch mints per served word and looks the id up
 * again at replay time; a recheck re-ask of the same word reuses it.
 */
export type CorrelationId = string;

/** Mint an opaque, url-safe correlation id. One per served question. */
export function mintCorrelationId(): CorrelationId {
  return crypto.randomUUID();
}

/**
 * Per-batch wordId → correlation-id ledger. `startBatch` resets it; each serve
 * of a word mints-or-reuses (so a recheck re-ask within the batch keeps the
 * original id); the answer replay reads it back per word.
 */
export function createCorrelationLedger() {
  const byWord = new Map<string, CorrelationId>();
  return {
    /** Mint on first serve of a word this batch; reuse it on a recheck re-ask. */
    forWord(wordId: string): CorrelationId {
      let id = byWord.get(wordId);
      if (!id) {
        id = mintCorrelationId();
        byWord.set(wordId, id);
      }
      return id;
    },
    /** The id already minted for a word this batch, or undefined if never served. */
    peek(wordId: string): CorrelationId | undefined {
      return byWord.get(wordId);
    },
    /** Clear at batch start so ids never bleed across batches. */
    reset(): void {
      byWord.clear();
    },
  };
}

export type CorrelationLedger = ReturnType<typeof createCorrelationLedger>;
