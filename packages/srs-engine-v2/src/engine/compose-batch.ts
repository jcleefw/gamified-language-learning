import type { MockWord } from '../../data/mock/mock-words.js';
import type { QuizChoice, QuizDirection, QuizQuestion } from '../types/quiz.js';
import type { MockFoundational } from '../types/foundational.js';
import { shuffle } from '../utils/shuffle.js';

export type QuizItem = MockFoundational | MockWord;

export const FOUNDATIONAL_DIRECTIONS: Record<
  MockFoundational['foundationalType'],
  QuizDirection[]
> = {
  consonant: [
    'native-to-english',
    'english-to-native',
    'native-to-romanization',
    'romanization-to-native',
  ],
  vowel: [
    'native-to-english',
    'english-to-native',
    'native-to-romanization',
    'romanization-to-native',
  ],
  tone: [
    'native-to-english',
    'english-to-native',
  ],
};

/** Consonants are formatted as "sound (class)", e.g. "k (middle)". */
function getEnglishLabel(item: QuizItem): string {
  if ('foundationalType' in item && item.foundationalType === 'consonant') {
    return `${item.english} (${item.class})`;
  }
  return item.english;
}

/**
 * Builds a 4-choice set from one correct value and up to 3 distractors,
 * shuffled and labelled a–d.
 */
function makeChoices(correct: string, distractors: string[]): QuizChoice[] {
  const labels = ['a', 'b', 'c', 'd'] as const;
  const values = shuffle([correct, ...distractors.slice(0, 3)]);
  return values.map((value, i) => ({
    label: labels[i],
    value,
    isCorrect: value === correct,
  }));
}

/**
 * Generates up to `questionLimit` questions across multiple items,
 * guaranteeing at least one question per item.
 */
export function composeBatchMulti(
  words: QuizItem[],
  pool: QuizItem[],
  options: { questionLimit: number; shuffle?: boolean },
): QuizQuestion[] {
  const { questionLimit, shuffle: shouldShuffle = true } = options;

  const questionsByWord = words.map(word => {
    const questions = composeBatch(word, pool);
    return shouldShuffle ? shuffle(questions) : questions;
  });

  const coverage = questionsByWord.map(qs => qs[0]).slice(0, questionLimit);
  const leftover = questionsByWord.flatMap(qs => qs.slice(1));
  const fillCount = Math.max(0, questionLimit - coverage.length);
  const filler = shouldShuffle ? shuffle(leftover).slice(0, fillCount) : leftover.slice(0, fillCount);

  const batch = [...coverage, ...filler];
  return shouldShuffle ? shuffle(batch) : batch;
}

/** Builds one question for a given direction, drawing distractors from pool. */
function makeQuestion(item: QuizItem, direction: QuizDirection, pool: QuizItem[]): QuizQuestion {
  const others = pool.filter(c => c.id !== item.id);

  switch (direction) {
    case 'native-to-english':
      return {
        wordId: item.id,
        direction: 'native-to-english',
        prompt: item.native,
        choices: makeChoices(getEnglishLabel(item), others.map(getEnglishLabel)),
      };
    case 'english-to-native':
      return {
        wordId: item.id,
        direction: 'english-to-native',
        prompt: getEnglishLabel(item),
        choices: makeChoices(item.native, others.map(c => c.native)),
      };
    case 'native-to-romanization':
      return {
        wordId: item.id,
        direction: 'native-to-romanization',
        prompt: item.native,
        choices: makeChoices(item.romanization, others.map(c => c.romanization)),
      };
    case 'romanization-to-native':
      return {
        wordId: item.id,
        direction: 'romanization-to-native',
        prompt: item.romanization,
        choices: makeChoices(item.native, others.map(c => c.native)),
      };
  }
}

/**
 * Generates one question per direction for a single item. Foundational
 * types use their type-specific direction set; words use all four.
 */
export function composeBatch(item: QuizItem, pool: QuizItem[]): QuizQuestion[] {
  const directions: QuizDirection[] =
    'foundationalType' in item
      ? FOUNDATIONAL_DIRECTIONS[item.foundationalType]
      : [
          'native-to-english',
          'english-to-native',
          'native-to-romanization',
          'romanization-to-native',
        ];

  return directions.map(direction => makeQuestion(item, direction, pool));
}

