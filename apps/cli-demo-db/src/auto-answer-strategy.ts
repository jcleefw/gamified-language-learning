import type { MCQQuestion } from '@gll/srs-engine-v2/learn';

export interface AutoAnswerStrategy {
  selectAnswer(question: MCQQuestion): number;
}

export class CorrectAutoAnswerStrategy implements AutoAnswerStrategy {
  selectAnswer(question: MCQQuestion): number {
    const index = question.choices.findIndex(c => c.isCorrect);
    if (index === -1) {
      throw new Error(`No correct answer found for question ${question.wordId}`);
    }
    return index;
  }
}

export class RandomAutoAnswerStrategy implements AutoAnswerStrategy {
  selectAnswer(question: MCQQuestion): number {
    return Math.floor(Math.random() * question.choices.length);
  }
}

export class WeightedAccuracyAutoAnswerStrategy implements AutoAnswerStrategy {
  constructor(private accuracy: number) {
    if (accuracy < 0 || accuracy > 1) {
      throw new Error('Accuracy must be between 0 and 1');
    }
  }

  selectAnswer(question: MCQQuestion): number {
    if (Math.random() < this.accuracy) {
      const index = question.choices.findIndex(c => c.isCorrect);
      if (index === -1) {
        throw new Error(`No correct answer found for question ${question.wordId}`);
      }
      return index;
    } else {
      const wrongChoices = question.choices
        .map((c, i) => (!c.isCorrect ? i : null))
        .filter((i): i is number => i !== null);

      if (wrongChoices.length === 0) {
        return question.choices.findIndex(c => c.isCorrect);
      }

      return wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    }
  }
}

/** Always selects a wrong answer, keeping mastery at 0. Used to trigger shelving policy. */
export class StagnationAutoAnswerStrategy implements AutoAnswerStrategy {
  selectAnswer(question: MCQQuestion): number {
    const wrongChoices = question.choices
      .map((c, i) => (!c.isCorrect ? i : null))
      .filter((i): i is number => i !== null);

    if (wrongChoices.length === 0) {
      // All choices are marked correct — fall back to index 0
      return 0;
    }

    return wrongChoices[0];
  }
}
