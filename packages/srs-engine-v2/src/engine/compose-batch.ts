import type { MockConsonant } from '../../data/mock/mock-consonants.js';
import type { MockWord } from '../../data/mock/mock-words.js';
import type { QuizChoice, QuizQuestion } from '../types/quiz.js';

export type QuizItem = MockConsonant | MockWord;

function getEnglishLabel(item: QuizItem): string {
  return 'class' in item ? `${item.english} (${item.class})` : item.english;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(correct: string, distractors: string[]): QuizChoice[] {
  const labels = ['a', 'b', 'c', 'd'] as const;
  const values = shuffle([correct, ...distractors.slice(0, 3)]);
  return values.map((value, i) => ({
    label: labels[i],
    value,
    isCorrect: value === correct,
  }));
}

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

export function composeBatch(item: QuizItem, pool: QuizItem[]): QuizQuestion[] {
  const others = pool.filter(c => c.id !== item.id);

  return [
    {
      wordId: item.id,
      direction: 'native-to-english',
      prompt: item.native,
      choices: makeChoices(getEnglishLabel(item), others.map(getEnglishLabel)),
    },
    {
      wordId: item.id,
      direction: 'english-to-native',
      prompt: getEnglishLabel(item),
      choices: makeChoices(item.native, others.map(c => c.native)),
    },
    {
      wordId: item.id,
      direction: 'native-to-romanization',
      prompt: item.native,
      choices: makeChoices(item.romanization, others.map(c => c.romanization)),
    },
    {
      wordId: item.id,
      direction: 'romanization-to-native',
      prompt: item.romanization,
      choices: makeChoices(item.native, others.map(c => c.native)),
    },
  ];
}
