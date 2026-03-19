export interface WordState {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;       // 0–5
  correctStreak: number; // consecutive correct answers
  wrongStreak: number;   // consecutive wrong answers
}

export type RunState = Map<string, WordState>;

export interface StreakThresholds {
  correctStreakThreshold: number;
  wrongStreakThreshold: number;
  maxMastery: number;
}

export function updateRunState(
  state: RunState,
  wordId: string,
  wasCorrect: boolean,
  thresholds: StreakThresholds,
): RunState {
  const next = new Map(state);
  const existing = next.get(wordId) ?? {
    wordId,
    seen: 0,
    correct: 0,
    mastery: 0,
    correctStreak: 0,
    wrongStreak: 0,
  };

  let { mastery, correctStreak, wrongStreak } = existing;

  if (wasCorrect) {
    correctStreak += 1;
    wrongStreak = 0;
    if (correctStreak >= thresholds.correctStreakThreshold) {
      mastery = Math.min(thresholds.maxMastery, mastery + 1);
    }
  } else {
    wrongStreak += 1;
    correctStreak = 0;
    if (wrongStreak >= thresholds.wrongStreakThreshold) {
      mastery = Math.max(0, mastery - 1);
    }
  }

  next.set(wordId, {
    wordId,
    seen: existing.seen + 1,
    correct: existing.correct + (wasCorrect ? 1 : 0),
    mastery,
    correctStreak,
    wrongStreak,
  });

  return next;
}

export function isMastered(ws: WordState, threshold: number): boolean {
  return ws.mastery >= threshold;
}
