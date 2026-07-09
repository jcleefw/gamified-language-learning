import type { StreakThresholds, SentenceQuestion } from '@gll/srs-engine-v2';

/**
 * Server-authoritative Learning policy. Behavioural config lives here, never in
 * @gll/api-contract — clients render UI and send raw answers; they must not carry
 * or version learning policy. Applied server-side on the /api/answer transition.
 */
export const LEARNING_CONFIG: { masteryThreshold: number; streakThresholds: StreakThresholds } = {
  masteryThreshold: 2,
  streakThresholds: {
    correctStreakThreshold: 2,
    wrongStreakThreshold: 2,
    maxMastery: 2,
  },
};

/**
 * User-tunable presentation/orchestration config (T1). Applied by the client,
 * but declared here — config is never spread into the FE. A per-user override +
 * write path arrive with accounts; hardcoded for now. See the Config Ownership &
 * Layering ADR (Amendment 1): system-vs-user is the axis, all config is
 * server-sourced.
 */
const USER_PRESENTATION: {
  wordsPerBatch: number;
  maxRetryPerSession: number;
  maxRetryPerWord: number;
  sentenceDirections: SentenceQuestion['direction'][];
} = {
  wordsPerBatch: 3,
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
  sentenceDirections: [
    'english-to-native',
    'romanization-to-native',
    'native-to-romanization',
  ],
};

/**
 * Pedagogy / content config (T2). Not user-writable: sentence unlock timing and
 * sentence graduation thresholds are authored course design, not personal taste.
 * Served globally for now; its eventual home is per-deck (see the Config
 * Ownership ADR). Distinct from T3 system internals, which are never served.
 */
const PEDAGOGY_CONFIG: {
  sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  };
} = {
  sentenceScheduling: { minSeenForSentence: 1, sentenceBatchGap: 2 },
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: 2,
    sentenceWrongStreakThreshold: 3,
  },
};

/**
 * Wire shape for GET /api/config — the config surface the FE applies,
 * categorized by who may change it: `user` (T1) and `pedagogy` (T2). T3 system
 * internals (FSRS params, seed heuristics, maxMastery-as-scale) are NEVER served
 * (D4). Declared server-side on purpose: config is server-owned and must not
 * surface in @gll/api-contract. The client consumes this read-only and declares
 * no config of its own.
 */
export interface AppConfigResponse {
  user: {
    masteryThreshold: number;
    streakThresholds: StreakThresholds;
    wordsPerBatch: number;
    maxRetryPerSession: number;
    maxRetryPerWord: number;
    sentenceDirections: SentenceQuestion['direction'][];
  };
  pedagogy: {
    sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
    sentenceGraduation: {
      sentenceCorrectStreakThreshold: number;
      sentenceWrongStreakThreshold: number;
    };
  };
}

/** Assemble the categorized config served read-only to clients. */
export function getAppConfig(): AppConfigResponse {
  return {
    user: {
      masteryThreshold: LEARNING_CONFIG.masteryThreshold,
      streakThresholds: LEARNING_CONFIG.streakThresholds,
      ...USER_PRESENTATION,
    },
    pedagogy: { ...PEDAGOGY_CONFIG },
  };
}
