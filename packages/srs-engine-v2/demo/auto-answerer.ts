/* eslint-disable no-console */

import type { QuizQuestion, QuizResult } from '../src/index.js';
import type { AutoAnswerStrategy } from './auto-answer-strategy.js';

export function runAutoInteractive(
  questions: QuizQuestion[],
  strategy: AutoAnswerStrategy,
): { correct: number; total: number; results: QuizResult[] } {
  if (questions.length === 0) {
    throw new Error('runAutoInteractive: No questions provided');
  }

  let score = 0;
  const results: QuizResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    if (question.choices.length === 0) {
      throw new Error(`runAutoInteractive: Question ${String(i + 1)} has no choices`);
    }
    if (!question.choices.find(c => c.isCorrect)) {
      throw new Error(`runAutoInteractive: Question ${String(i + 1)} has no correct answer marked`);
    }

    const selectedIndex = strategy.selectAnswer(question);

    if (selectedIndex < 0 || selectedIndex >= question.choices.length) {
      throw new Error(
        `runAutoInteractive: Strategy returned invalid index ${String(selectedIndex)} for question ${String(i + 1)}`
      );
    }

    const selected = question.choices[selectedIndex];
    const wasCorrect = selected.isCorrect;

    if (wasCorrect) {
      score++;
    }

    results.push({ wordId: question.wordId, correct: wasCorrect });
  }

  console.log(`\nScore: ${String(score)} / ${String(questions.length)}`);
  return { correct: score, total: questions.length, results };
}
