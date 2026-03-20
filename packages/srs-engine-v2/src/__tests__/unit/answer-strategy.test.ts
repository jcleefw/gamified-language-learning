import { describe, it, expect } from 'vitest';
import {
  CorrectAnswerStrategy,
  RandomAnswerStrategy,
  WeightedAccuracyStrategy,
} from '../../types/answer-strategy.js';
import { QuizQuestion } from '../../types/quiz.js';

const createTestQuestion = (wordId: string = 'word1'): QuizQuestion => ({
  wordId,
  direction: 'native-to-english',
  prompt: 'Test prompt',
  choices: [
    { label: 'a', value: 'wrong1', isCorrect: false },
    { label: 'b', value: 'correct', isCorrect: true },
    { label: 'c', value: 'wrong2', isCorrect: false },
    { label: 'd', value: 'wrong3', isCorrect: false },
  ],
});

describe('CorrectAnswerStrategy', () => {
  it('always returns index of correct choice', () => {
    const strategy = new CorrectAnswerStrategy();
    const question = createTestQuestion();

    for (let i = 0; i < 10; i++) {
      const index = strategy.selectAnswer(question);
      expect(index).toBe(1); // index 1 is correct
      expect(question.choices[index].isCorrect).toBe(true);
    }
  });

  it('works with correct choice at different positions', () => {
    const strategy = new CorrectAnswerStrategy();

    // Correct at index 0
    let question = createTestQuestion('word2');
    question.choices[0].isCorrect = true;
    question.choices[1].isCorrect = false;
    expect(strategy.selectAnswer(question)).toBe(0);

    // Correct at index 3
    question = createTestQuestion('word3');
    question.choices[3].isCorrect = true;
    question.choices[1].isCorrect = false;
    expect(strategy.selectAnswer(question)).toBe(3);
  });

  it('throws error when no correct answer exists', () => {
    const strategy = new CorrectAnswerStrategy();
    const question = createTestQuestion();
    question.choices.forEach(c => (c.isCorrect = false));

    expect(() => strategy.selectAnswer(question)).toThrow(
      'No correct answer found'
    );
  });
});

describe('RandomAnswerStrategy', () => {
  it('returns a valid choice index (0-3)', () => {
    const strategy = new RandomAnswerStrategy();
    const question = createTestQuestion();

    for (let i = 0; i < 20; i++) {
      const index = strategy.selectAnswer(question);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
    }
  });

  it('can select both correct and incorrect answers', () => {
    const strategy = new RandomAnswerStrategy();
    const question = createTestQuestion();
    const selected = new Set<number>();

    // Run many times to get variety (high probability of >1 different choice)
    for (let i = 0; i < 100; i++) {
      selected.add(strategy.selectAnswer(question));
    }

    expect(selected.size).toBeGreaterThan(1);
  });
});

describe('WeightedAccuracyStrategy', () => {
  it('constructor rejects invalid accuracy values', () => {
    expect(() => new WeightedAccuracyStrategy(-0.1)).toThrow(
      'Accuracy must be between 0 and 1'
    );
    expect(() => new WeightedAccuracyStrategy(1.1)).toThrow(
      'Accuracy must be between 0 and 1'
    );
  });

  it('with accuracy 1.0, always returns correct answer', () => {
    const strategy = new WeightedAccuracyStrategy(1.0);
    const question = createTestQuestion();

    for (let i = 0; i < 10; i++) {
      const index = strategy.selectAnswer(question);
      expect(question.choices[index].isCorrect).toBe(true);
    }
  });

  it('with accuracy 0.0, always returns incorrect answer', () => {
    const strategy = new WeightedAccuracyStrategy(0.0);
    const question = createTestQuestion();

    for (let i = 0; i < 10; i++) {
      const index = strategy.selectAnswer(question);
      expect(question.choices[index].isCorrect).toBe(false);
    }
  });

  it('with accuracy 0.5, returns mix of correct and incorrect', () => {
    const strategy = new WeightedAccuracyStrategy(0.5);
    const question = createTestQuestion();
    let correctCount = 0;

    for (let i = 0; i < 100; i++) {
      const index = strategy.selectAnswer(question);
      if (question.choices[index].isCorrect) {
        correctCount++;
      }
    }

    // With 100 samples at 50% accuracy, expect ~50 correct (allow ±20 for variance)
    expect(correctCount).toBeGreaterThan(30);
    expect(correctCount).toBeLessThan(70);
  });

  it('with accuracy 0.8, returns ~80% correct answers', () => {
    const strategy = new WeightedAccuracyStrategy(0.8);
    const question = createTestQuestion();
    let correctCount = 0;

    for (let i = 0; i < 200; i++) {
      const index = strategy.selectAnswer(question);
      if (question.choices[index].isCorrect) {
        correctCount++;
      }
    }

    // With 200 samples at 80% accuracy, expect ~160 correct (allow ±30 for variance)
    expect(correctCount).toBeGreaterThan(130);
    expect(correctCount).toBeLessThan(190);
  });

  it('when only correct choice exists, always returns correct', () => {
    const strategy = new WeightedAccuracyStrategy(0.0);
    const question = createTestQuestion();
    // Set all choices as correct (edge case)
    question.choices.forEach(c => (c.isCorrect = true));

    const index = strategy.selectAnswer(question);
    expect(question.choices[index].isCorrect).toBe(true);
  });
});
