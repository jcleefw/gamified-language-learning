import { mockConsonants } from '../data/mock/mock-consonants.js';
import { mockWords } from '../data/mock/mock-words.js';
import { runAdaptiveLoop } from './runner/interactive.js';

const config = {
  nonFoundationWordsCount: 3,
  foundationalWordsCount: 1,
  questionLimit: 4,
  masteryThreshold: 5,
  correctStreakThreshold: 3,
  wrongStreakThreshold: 2,
};

const words = [
  ...mockWords.slice(0, config.nonFoundationWordsCount),
  ...mockConsonants.slice(0, config.foundationalWordsCount),
];

await runAdaptiveLoop(
  words,
  mockWords,
  mockConsonants,
  config.questionLimit,
  config.masteryThreshold,
  { correctStreakThreshold: config.correctStreakThreshold, wrongStreakThreshold: config.wrongStreakThreshold },
);
