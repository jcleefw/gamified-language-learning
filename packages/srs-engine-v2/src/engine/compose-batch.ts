import { MockConsonant } from '../../data/mock/mock-consonants.js';
import { QuizChoice, QuizQuestion } from '../types/quiz.js';

function englishWithClass(c: MockConsonant): string {
  return `${c.english} (${c.class})`;
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

export function composeBatch(consonant: MockConsonant, pool: MockConsonant[]): QuizQuestion[] {
  const others = pool.filter(c => c.id !== consonant.id);

  return [
    {
      direction: 'native-to-english',
      prompt: consonant.native,
      choices: makeChoices(englishWithClass(consonant), others.map(englishWithClass)),
    },
    {
      direction: 'english-to-native',
      prompt: englishWithClass(consonant),
      choices: makeChoices(consonant.native, others.map(c => c.native)),
    },
    {
      direction: 'native-to-romanization',
      prompt: consonant.native,
      choices: makeChoices(consonant.romanization, others.map(c => c.romanization)),
    },
    {
      direction: 'romanization-to-native',
      prompt: consonant.romanization,
      choices: makeChoices(consonant.native, others.map(c => c.native)),
    },
  ];
}
