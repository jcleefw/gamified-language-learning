import {
  createComposerRegistry,
  assembleBatchQuestions,
} from './compose-registry.js';
import { composeWordBatchItems, type QuizItem } from './compose-word-batch.js';
import { type QuizQuestion } from '../types/quiz.js';
import { shuffle as shuffleArray } from '../utils/shuffle.js';

export interface AssembleBatchOptions {
  /** If true, the final batch of questions will be shuffled. Defaults to true. */
  shuffle?: boolean;
  /** Optional array of additional thunks (e.g. for sentences) to include in the batch. */
  extraThunks?: (() => QuizQuestion[])[];
  /** Optional set of item IDs to exclude from question generation. */
  excludeIds?: Set<string>;
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
  const { shuffle = true, extraThunks = [], excludeIds } = options;

  const eligible = excludeIds?.size
    ? active.filter((item) => !excludeIds.has(item.id))
    : active;

  const activeFoundational = eligible.filter(
    (item) => 'foundationalType' in item,
  );
  const activeWords = eligible.filter((item) => !('foundationalType' in item));

  // Partition the questionLimit proportionally between foundational and vocabulary
  const foundationalLimit =
    eligible.length > 0
      ? Math.round((wordsPerBatch * activeFoundational.length) / eligible.length)
      : 0;
  const wordLimit = wordsPerBatch - foundationalLimit;

  const registry = createComposerRegistry();

  // shuffle: false — stop shuffling in the inner thunk
  // delegating shuffle to code below. Avoid double shuffling
  if (activeFoundational.length > 0) {
    registry.add(() =>
      composeWordBatchItems(activeFoundational, foundationalPool, {
        questionLimit: foundationalLimit,
        shuffle: false,
      }),
    );
  }

  // shuffle: false — stop shuffling in the inner thunk
  // delegating shuffle to code below. Avoid double shuffling
  if (activeWords.length > 0) {
    registry.add(() =>
      composeWordBatchItems(activeWords, wordPool, {
        questionLimit: wordLimit,
        shuffle: false,
      }),
    );
  }

  for (const thunk of extraThunks) {
    registry.add(thunk);
  }

  const questions = assembleBatchQuestions(registry);

  return shuffle ? shuffleArray(questions) : questions;
}
