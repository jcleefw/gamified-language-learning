export const AUTO_MODE = false;
export const ENABLE_MOCK_DB = true;

export const LEARNING_CONFIG = {
  wordsPerBatch: 3,
  masteryThreshold: 2,
  maxMastery: 2,
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
  minSeenForSentence: 2,
  sentenceBatchGap: 1, // D7 — min batches between appearances
  sentenceCorrectStreakThreshold: 3, // D7 — correct streak for graduation
  sentenceWrongStreakThreshold: 3, // D10 — wrong streak for shelving
  debugSentenceEligibility: false,
  maxRetryPerWord: 2,
  maxRetryPerSession: 5,
};

export const STREAK_THRESHOLDS = {
  correctStreakThreshold: LEARNING_CONFIG.correctStreakThreshold,
  wrongStreakThreshold: LEARNING_CONFIG.wrongStreakThreshold,
  maxMastery: LEARNING_CONFIG.maxMastery,
};
