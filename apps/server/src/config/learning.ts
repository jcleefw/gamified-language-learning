import type { StreakThresholds } from '@gll/srs-engine-v2';

/**
 * Server-authoritative Learning policy. Behavioural config lives here, never in
 * @gll/api-contract — clients render UI and send raw answers; they must not carry
 * or version learning policy. Values mirror the current client CONFIG (parity is
 * enforced by the golden-master test, not a shared constant).
 */
export const LEARNING_CONFIG: { masteryThreshold: number; streakThresholds: StreakThresholds } = {
  masteryThreshold: 2,
  streakThresholds: {
    correctStreakThreshold: 2,
    wrongStreakThreshold: 2,
    maxMastery: 2,
  },
};
