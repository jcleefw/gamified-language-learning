import { QuizQuestion } from './quiz';

/**
 * AnswerStrategy determines which choice a quiz runner will select
 * for a given question, without user input.
 */
export interface AnswerStrategy {
  /**
   * Select an answer choice index (0–3) for a question.
   * @param question - the quiz question
   * @returns choice index 0–3
   */
  selectAnswer(question: QuizQuestion): number;
}

/**
 * Always select the correct answer.
 * Used for "perfect run" test scenarios.
 */
export class CorrectAnswerStrategy implements AnswerStrategy {
  selectAnswer(question: QuizQuestion): number {
    const index = question.choices.findIndex(c => c.isCorrect);
    if (index === -1) {
      throw new Error(`No correct answer found for question ${question.wordId}`);
    }
    return index;
  }
}

/**
 * Select a random choice (including possibly the correct answer).
 * Used for edge case / chaos testing.
 */
export class RandomAnswerStrategy implements AnswerStrategy {
  selectAnswer(question: QuizQuestion): number {
    return Math.floor(Math.random() * question.choices.length);
  }
}

/**
 * Select an answer with a target accuracy rate.
 * If accuracy is 0.8, answer correctly ~80% of the time, randomly ~20%.
 * Used for "realistic accuracy" scenarios.
 */
export class WeightedAccuracyStrategy implements AnswerStrategy {
  constructor(private accuracy: number) {
    if (accuracy < 0 || accuracy > 1) {
      throw new Error('Accuracy must be between 0 and 1');
    }
  }

  selectAnswer(question: QuizQuestion): number {
    if (Math.random() < this.accuracy) {
      // Answer correctly
      const index = question.choices.findIndex(c => c.isCorrect);
      if (index === -1) {
        throw new Error(`No correct answer found for question ${question.wordId}`);
      }
      return index;
    } else {
      // Answer incorrectly (random wrong choice)
      const wrongChoices = question.choices
        .map((c, i) => (!c.isCorrect ? i : null))
        .filter((i): i is number => i !== null);

      if (wrongChoices.length === 0) {
        // Only one choice is correct and no wrong choices exist, must answer correctly
        const index = question.choices.findIndex(c => c.isCorrect);
        return index;
      }

      return wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    }
  }
}
