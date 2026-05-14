// Utils
export { shuffle } from './utils/shuffle.js';

// Engine — question generation
export { composeWordBatch, composeWordBatchMulti, composeWordBatchItems, FOUNDATIONAL_DIRECTIONS } from './engine/compose-word-batch.js';
export { composeSentenceBatch } from './engine/compose-sentence-batch.js';
export type { QuizItem } from './engine/compose-word-batch.js';

// Engine — session state
export { processRecheckResult, nextActivePool, updateMasteryState } from './engine/session.js';
export type { RecheckResultOutput, MasteryUpdateResult } from './engine/session.js';

// Word state
export { updateRunState, isMastered } from './types/word-state.js';
export type { WordState, RunState, StreakThresholds } from './types/word-state.js';

// Types
export type { QuizQuestion, MCQQuestion, SentenceQuestion, SentenceTile, QuizChoice, QuizDirection, QuizResult, WordQuizResult, SentenceQuizResult } from './types/quiz.js';
export type { SentenceContext } from './types/sentence.js';

// Config
export { LANGUAGE_CONFIG } from './config/language.js';
export type { LanguageConfig, WordJoin } from './config/language.js';
export type { MockDeck, MockLine } from './types/deck.js';
export type { MockFoundational, ThaiFoundational, MockVowel, MockTone, ThaiFoundationalType, JapaneseFoundationalType } from './types/foundational.js';
