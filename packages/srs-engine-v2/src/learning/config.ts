/**
 * Learning Phase Configuration
 *
 * Defines thresholds, counts, and behavior flags for the interactive
 * and automated learning sessions.
 */

// AUTO_MODE: Set to true to run automated quiz answering without user input
export const AUTO_MODE = true;

export const LEARNING_CONFIG = {
  foundationalWordsCount: 2,
  questionLimit: 6,
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
