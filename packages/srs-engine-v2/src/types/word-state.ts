export interface WordState {
  wordId: string;
  seen: number;
  correct: number;
}

export type RunState = Map<string, WordState>;

export function updateRunState(state: RunState, wordId: string, wasCorrect: boolean): RunState {
  const next = new Map(state);
  const existing = next.get(wordId) ?? { wordId, seen: 0, correct: 0 };
  next.set(wordId, {
    wordId,
    seen: existing.seen + 1,
    correct: existing.correct + (wasCorrect ? 1 : 0),
  });
  return next;
}

export function isMastered(ws: WordState, threshold: number): boolean {
  return ws.correct >= threshold;
}
