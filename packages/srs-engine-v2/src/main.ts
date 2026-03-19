import { mockConsonants } from '../data/mock/mock-consonants.js';
import { mockWords } from '../data/mock/mock-words.js';
import { runAdaptiveLoop } from './runner/interactive.js';

const NON_FOUNDATION_WORDS_COUNT = 2;
const FOUNDATION_WORDS_COUNT = 4;

const config = {
  nonFoundationWordsCount: NON_FOUNDATION_WORDS_COUNT,
  foundationalWordsCount: FOUNDATION_WORDS_COUNT,
  words: [...mockWords.slice(0, FOUNDATION_WORDS_COUNT + 1), ...mockConsonants.slice(0, NON_FOUNDATION_WORDS_COUNT + 1)],
  questionLimit: 7,
  masteryThreshold: 3,
};

await runAdaptiveLoop(config.words, mockWords, mockConsonants, config.questionLimit, config.masteryThreshold);
