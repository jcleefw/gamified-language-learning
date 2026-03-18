import { mockConsonants } from '../data/mock/mock-consonants.js';
import { composeBatch } from './engine/compose-batch.js';
import { runInteractive } from './runner/interactive.js';

const consonant = mockConsonants[0];
const questions = composeBatch(consonant, mockConsonants);

await runInteractive(questions);
