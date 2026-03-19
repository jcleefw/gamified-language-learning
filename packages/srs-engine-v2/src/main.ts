import { mockConsonants } from '../data/mock/mock-consonants.js';
import { mockWords } from '../data/mock/mock-words.js';
import { composeBatchMulti } from './engine/compose-batch.js';
import { runInteractive } from './runner/interactive.js';

const config = {
  foundationalWordCount: 3,
  nonFoundationalWordCount: 3,
  questionLimit: 8,
};

const consonantLimit = Math.ceil(config.questionLimit / 2);
const wordLimit = config.questionLimit - consonantLimit;

const consonants = mockConsonants.slice(0, config.foundationalWordCount);
const words = mockWords.slice(0, config.nonFoundationalWordCount);

const consonantQuestions = composeBatchMulti(consonants, mockConsonants, { questionLimit: consonantLimit });
const wordQuestions = composeBatchMulti(words, mockWords, { questionLimit: wordLimit });

const allQuestions = [...consonantQuestions, ...wordQuestions].sort(() => Math.random() - 0.5);

await runInteractive(allQuestions);
