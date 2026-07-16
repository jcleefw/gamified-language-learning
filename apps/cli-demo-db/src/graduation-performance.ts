import type { WordState } from '@gll/srs-engine-v2/learn';
import type { GraduationPerformance } from '@gll/srs-engine-v2/review';

/** App-layer mapping: Learning WordState → Review seed input (DS03 §3). */
export function toGraduationPerformance(ws: WordState): GraduationPerformance {
  return {
    correctStreak: ws.correctStreak,
    lapses: ws.lapses,
    correctRatio: ws.seen > 0 ? ws.correct / ws.seen : 0,
  };
}
