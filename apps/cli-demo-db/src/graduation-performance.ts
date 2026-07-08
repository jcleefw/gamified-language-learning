import type { WordState } from '@gll/srs-engine-v2';
import type { GraduationPerformance } from '@gll/srs-review';

/** App-layer mapping: Learning WordState → Review seed input (DS03 §3). */
export function toGraduationPerformance(ws: WordState): GraduationPerformance {
  return {
    correctStreak: ws.correctStreak,
    lapses: ws.lapses,
    correctRatio: ws.seen > 0 ? ws.correct / ws.seen : 0,
  };
}
