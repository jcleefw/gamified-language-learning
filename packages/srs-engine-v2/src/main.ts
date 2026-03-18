import { mockConsonants } from '../data/mock/mock-consonants.js';
import { composeBatchMulti } from './engine/compose-batch.js';
import { runInteractive } from './runner/interactive.js';

const FOUNDATIONAL_WORD_COUNT = 3;
const QUESTION_LIMIT = 5;

const words = mockConsonants.slice(0, FOUNDATIONAL_WORD_COUNT);
const questions = composeBatchMulti(words, mockConsonants, { questionLimit: QUESTION_LIMIT });

await runInteractive(questions);
