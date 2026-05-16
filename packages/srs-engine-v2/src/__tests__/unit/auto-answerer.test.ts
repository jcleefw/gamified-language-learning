import { describe, it, expect } from 'vitest';
import { runAutoInteractive } from '../../../demo/auto-answerer.js';
import {
  CorrectAutoAnswerStrategy,
  RandomAutoAnswerStrategy,
  WeightedAccuracyAutoAnswerStrategy,
} from '../../../demo/auto-answer-strategy.js';
import type { MCQQuestion } from '../../types/quiz.js';
import { BatchQueueManager } from '../../engine/batch-queue.js';

const createTestQuestion = (wordId: string = 'word1'): MCQQuestion => ({
  kind: 'mcq',
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

const createTestBatch = (count: number): MCQQuestion[] => {
  const batch: MCQQuestion[] = [];
  for (let i = 0; i < count; i++) {
    batch.push(createTestQuestion(`word${String(i + 1)}`));
  }
  return batch;
};

describe('runAutoInteractive', () => {
  it('with CorrectAnswerStrategy, returns all correct', () => {
    const strategy = new CorrectAutoAnswerStrategy();
    const questions = createTestBatch(4);
    const manager = new BatchQueueManager(questions, 1, new Map(), 5);

    const result = runAutoInteractive(manager, strategy);
    const output = manager.finish();

    expect(result.correct).toBe(4);
    expect(result.total).toBe(4);
    expect(output.results).toHaveLength(4);
    for (const res of output.results) {
      expect(res.correct).toBe(true);
    }
  });

  it('with WeightedAccuracyStrategy(0.0), returns all incorrect', () => {
    const strategy = new WeightedAccuracyAutoAnswerStrategy(0.0);
    const questions = createTestBatch(4);
    const manager = new BatchQueueManager(questions, 0, new Map(), 5);

    const result = runAutoInteractive(manager, strategy);
    const output = manager.finish();

    expect(result.correct).toBe(0);
    expect(result.total).toBe(4);
    for (const res of output.results) {
      expect(res.correct).toBe(false);
    }
  });

  it('with WeightedAccuracyStrategy(1.0), returns all correct', () => {
    const strategy = new WeightedAccuracyAutoAnswerStrategy(1.0);
    const questions = createTestBatch(4);
    const manager = new BatchQueueManager(questions, 1, new Map(), 5);

    const result = runAutoInteractive(manager, strategy);
    const output = manager.finish();

    expect(result.correct).toBe(4);
    expect(result.total).toBe(4);
    for (const res of output.results) {
      expect(res.correct).toBe(true);
    }
  });

  it('with WeightedAccuracyStrategy(0.5), returns mixed correct/incorrect', () => {
    const strategy = new WeightedAccuracyAutoAnswerStrategy(0.5);
    const questions = createTestBatch(100);
    const manager = new BatchQueueManager(questions, 0, new Map(), 5);

    const result = runAutoInteractive(manager, strategy);

    expect(result.correct).toBeGreaterThan(30);
    expect(result.correct).toBeLessThan(70);
    expect(result.total).toBe(100);
  });

  it('with RandomAnswerStrategy, returns unpredictable results', () => {
    const strategy = new RandomAutoAnswerStrategy();
    const questions = createTestBatch(10);
    const manager = new BatchQueueManager(questions, 0, new Map(), 5);

    const result = runAutoInteractive(manager, strategy);

    expect(result.total).toBe(10);
    expect(result.correct).toBeGreaterThanOrEqual(0);
    expect(result.correct).toBeLessThanOrEqual(10);
  });

  it('results array contains wordIds', () => {
    const strategy = new CorrectAutoAnswerStrategy();
    const questions = createTestBatch(5);
    const manager = new BatchQueueManager(questions, 1, new Map(), 5);

    runAutoInteractive(manager, strategy);
    const output = manager.finish();

    expect(output.results).toHaveLength(5);
    for (let iter = 0; iter < 5; iter++) {
      const r = output.results[iter];
      expect('wordId' in r ? r.wordId : undefined).toBe(`word${String(iter + 1)}`);
    }
  });

  it('throws error if question has no correct answer', () => {
    const strategy = new CorrectAutoAnswerStrategy();
    const questions = createTestBatch(1);
    questions[0].choices.forEach(c => (c.isCorrect = false));
    const manager = new BatchQueueManager(questions, 1, new Map(), 5);

    expect(() => runAutoInteractive(manager, strategy)).toThrow('no correct answer marked');
  });

  it('throws error if question has no choices', () => {
    const strategy = new CorrectAutoAnswerStrategy();
    const question = createTestQuestion();
    question.choices = [];
    const manager = new BatchQueueManager([question], 1, new Map(), 5);

    expect(() => runAutoInteractive(manager, strategy)).toThrow('has no choices');
  });
});
