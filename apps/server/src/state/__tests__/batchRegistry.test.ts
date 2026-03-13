import { describe, it, expect, beforeEach } from 'vitest';
import { register, get, clearRegistry, type BatchEntry } from '../batchRegistry.js';

const BATCH_ID = 'test-batch-uuid';
const MOCK_ENTRY: BatchEntry = {
  questions: [
    { wordId: 'foundational:ko-kai', questionType: 'multiple_choice', targetText: 'ก', choices: { a: 'ก', b: 'ข', c: 'ค', d: 'ง' } },
    { wordId: 'curated:หิว', questionType: 'word_block', targetText: 'หิว', choices: {} },
  ],
  correctKeys: { 'foundational:ko-kai': 'a' },
};

describe('batchRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('get returns the entry for a registered batchId', () => {
    register(BATCH_ID, MOCK_ENTRY);
    expect(get(BATCH_ID)).toEqual(MOCK_ENTRY);
  });

  it('get returns undefined for an unknown batchId', () => {
    expect(get('does-not-exist')).toBeUndefined();
  });

  it('registering a second batchId does not affect the first', () => {
    register(BATCH_ID, MOCK_ENTRY);
    register('other-batch-uuid', { questions: [], correctKeys: {} });
    expect(get(BATCH_ID)).toEqual(MOCK_ENTRY);
  });
});
