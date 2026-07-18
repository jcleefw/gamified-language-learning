import type { WordState } from '@gll/srs-engine/learn';
import type { GraduationPerformance } from '@gll/srs-engine/review';

/**
 * Learning WordState → Review seed input. Server-owned copy of the same mapping
 * used by cli-demo-db; parity is enforced by the PH04 golden-master test, not a
 * shared constant (behavioural glue has no clean library home — @gll/srs-engine/review
 * never imports WordState by design).
 */
export function toGraduationPerformance(ws: WordState): GraduationPerformance {
  return {
    correctStreak: ws.correctStreak,
    lapses: ws.lapses,
    correctRatio: ws.seen > 0 ? ws.correct / ws.seen : 0,
  };
}
