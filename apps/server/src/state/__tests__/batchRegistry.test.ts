import { describe, it, expect, beforeEach } from 'vitest';
import { register, get, clearRegistry } from '../batchRegistry.js';

const BATCH_ID = 'test-batch-uuid';
const MOCK_QUESTIONS = [
  { wordId: 'foundational:ko-kai', questionType: 'multiple_choice' as const, targetText: 'ก' },
  { wordId: 'curated:หิว', questionType: 'word_block' as const, targetText: 'หิว' },
];

describe('batchRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('get returns the questions for a registered batchId', () => {
    register(BATCH_ID, MOCK_QUESTIONS);
    expect(get(BATCH_ID)).toEqual(MOCK_QUESTIONS);
  });

  it('get returns undefined for an unknown batchId', () => {
    expect(get('does-not-exist')).toBeUndefined();
  });

  it('registering a second batchId does not affect the first', () => {
    register(BATCH_ID, MOCK_QUESTIONS);
    register('other-batch-uuid', []);
    expect(get(BATCH_ID)).toEqual(MOCK_QUESTIONS);
  });
});
