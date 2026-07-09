// Utils
export { shuffle } from './utils/shuffle.js';

// Engine — question generation
export { composeWordBatch, composeWordBatchMulti, composeWordBatchItems, FOUNDATIONAL_DIRECTIONS } from './engine/compose-word-batch.js';
export { composeSentenceBatch } from './engine/compose-sentence-batch.js';
export { createComposerRegistry, assembleBatchQuestions } from './engine/compose-registry.js';
export type { ComposerRegistry } from './engine/compose-registry.js';
export type { QuizItem } from './engine/compose-word-batch.js';

export { processRecheckResult, classifyRechecks, nextActivePool, updateMasteryState, getNewlyMasteredIds } from './engine/session.js';
export type { RecheckResultOutput, MasteryUpdateResult } from './engine/session.js';
export { initAdaptiveSession, advanceAdaptiveSession } from './engine/adaptive-session.js';
export type { AdaptiveSessionState, SessionConfig } from './engine/adaptive-session.js';
export { initBatchState, nextQuestion, submitBatchResult, finishBatch, isBatchDone } from './engine/batch-queue.js';
export type { BatchOutput, BatchState } from './engine/batch-queue.js';
export { assembleBatch } from './engine/assemble-batch.js';
export type { AssembleBatchOptions } from './engine/assemble-batch.js';

// Word state
export { updateRunState, isMastered } from './types/word-state.js';
export type { WordState, RunState, StreakThresholds, GraduationHook } from './types/word-state.js';

// Sentence state
export { defaultSentenceState } from './types/sentence-state.js';
export type { SentenceState, SentenceRunState } from './types/sentence-state.js';
export { resolveEligibleContexts, updateSentenceRunState } from './engine/sentence-scheduling.js';

// Types
export type { QuizQuestion, MCQQuestion, SentenceQuestion, SentenceTile, QuizChoice, QuizDirection, QuizResult, WordQuizResult, SentenceQuizResult } from './types/quiz.js';
export type { SentenceContext } from './types/sentence.js';

// Config
export { LANGUAGE_CONFIG } from './config/language.js';
export type { LanguageConfig, WordJoin } from './config/language.js';
export type { MockDeck, MockLine } from './types/deck.js';
export type { MockFoundational, ThaiFoundational, MockVowel, MockTone, ThaiFoundationalType, JapaneseFoundationalType } from './types/foundational.js';
