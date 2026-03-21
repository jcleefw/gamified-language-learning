/* eslint-disable no-console */

import type { QuizQuestion } from '../types/quiz.js';
import type { AnswerStrategy } from '../types/answer-strategy.js';

export interface QuizResult {
  wordId: string;
  correct: boolean;
}

/**
 * Automatically answer a batch of quiz questions using a provided strategy.
 * Mirrors runInteractive() contract but with no user input.
 */
export function runAutoInteractive(
  questions: QuizQuestion[],
  strategy: AnswerStrategy,
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

    // Use strategy to select answer
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
