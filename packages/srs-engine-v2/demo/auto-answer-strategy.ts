import type { MCQQuestion } from '../src/learn/index.js';

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

export class DeterministicAccuracyAutoAnswerStrategy implements AutoAnswerStrategy {
  private questionCount = 0;

  constructor(private accuracy: number) {
    if (accuracy < 0 || accuracy > 1) {
      throw new Error('Accuracy must be between 0 and 1');
    }
  }

  selectAnswer(question: MCQQuestion): number {
    // Use a small denominator (10) so pattern repeats frequently
    // For 0.8 accuracy: 8 correct out of every 10 questions
    const denominator = 10;
    const numCorrectPerCycle = Math.round(this.accuracy * denominator);
    const positionInCycle = this.questionCount % denominator;
    this.questionCount++;

    const shouldBeCorrect = positionInCycle < numCorrectPerCycle;

    if (shouldBeCorrect) {
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

      return wrongChoices[0];
    }
  }
}
