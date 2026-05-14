/* eslint-disable no-console */

import type { MCQQuestion, QuizQuestion, QuizResult } from '../src/index.js';
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

    if (question.kind === 'word-block') {
      // word-block: always answer correctly (correct tile order)
      results.push({ sentenceId: question.sentenceId, correct: true });
      score++;
      continue;
    }

    const mcq = question as MCQQuestion;

    if (mcq.choices.length === 0) {
      throw new Error(`runAutoInteractive: Question ${String(i + 1)} has no choices`);
    }
    if (!mcq.choices.find(c => c.isCorrect)) {
      throw new Error(`runAutoInteractive: Question ${String(i + 1)} has no correct answer marked`);
    }

    const selectedIndex = strategy.selectAnswer(mcq);

    if (selectedIndex < 0 || selectedIndex >= mcq.choices.length) {
      throw new Error(
        `runAutoInteractive: Strategy returned invalid index ${String(selectedIndex)} for question ${String(i + 1)}`
      );
    }

    const selected = mcq.choices[selectedIndex];
    const wasCorrect = selected.isCorrect;

    if (wasCorrect) {
      score++;
    }

    results.push({ wordId: mcq.wordId, correct: wasCorrect });
  }

  console.log(`\nScore: ${String(score)} / ${String(questions.length)}`);
  return { correct: score, total: questions.length, results };
}
