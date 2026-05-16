import { createComposerRegistry, assembleBatchQuestions } from './compose-registry.js';
import { composeWordBatchItems, type QuizItem } from './compose-word-batch.js';
import { type QuizQuestion } from '../types/quiz.js';

export interface AssembleBatchOptions {
  /** If true, the final batch of questions will be shuffled. Defaults to true. */
  shuffle?: boolean;
  /** Optional array of additional thunks (e.g. for sentences) to include in the batch. */
  extraThunks?: (() => QuizQuestion[])[];
}

/**
 * Orchestrates the assembly of a quiz batch.
 * Handles partitioning active items into foundational vs. vocabulary and calculating limits.
 */
export function assembleBatch(
  active: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,
  options: AssembleBatchOptions = {},
): QuizQuestion[] {
  const { shuffle = true, extraThunks = [] } = options;

  const activeFoundational = active.filter((item) => 'foundationalType' in item);
  const activeWords = active.filter((item) => !('foundationalType' in item));

  // Partition the questionLimit proportionally between foundational and vocabulary
  const foundationalLimit = active.length > 0
    ? Math.round((wordsPerBatch * activeFoundational.length) / active.length)
    : 0;
  const wordLimit = wordsPerBatch - foundationalLimit;

  const registry = createComposerRegistry();

  if (activeFoundational.length > 0) {
    registry.add(() =>
      composeWordBatchItems(activeFoundational, foundationalPool, {
        questionLimit: foundationalLimit,
        shuffle,
      }),
    );
  }

  if (activeWords.length > 0) {
    registry.add(() =>
      composeWordBatchItems(activeWords, wordPool, {
        questionLimit: wordLimit,
        shuffle,
      }),
    );
  }

  for (const thunk of extraThunks) {
    registry.add(thunk);
  }

  const questions = assembleBatchQuestions(registry);

  if (shuffle) {
    return questions.sort(() => Math.random() - 0.5);
  }

  return questions;
}
