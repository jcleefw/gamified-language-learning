export const AUTO_MODE = false;

export const LEARNING_CONFIG = {
  questionLimit: 8,
  masteryThreshold: 2,
  maxMastery: 2,
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
};

export const STREAK_THRESHOLDS = {
  correctStreakThreshold: LEARNING_CONFIG.correctStreakThreshold,
  wrongStreakThreshold: LEARNING_CONFIG.wrongStreakThreshold,
  maxMastery: LEARNING_CONFIG.maxMastery,
};
