import { describe, it, expect } from 'vitest';
import { validateBatch } from '../../engine/validate-batch.js';
import type { MCQQuestion, SentenceQuestion, SentenceTile } from '../../types/quiz.js';

function mcq(wordId: string, direction: MCQQuestion['direction'] = 'native-to-english'): MCQQuestion {
  return { kind: 'mcq', wordId, direction, prompt: wordId, choices: [] };
}

function tile(wordId: string): SentenceTile {
  return { wordId, native: wordId, romanization: wordId, english: wordId };
}

function sentence(
  sentenceId: string,
  wordIds: string[],
  direction: SentenceQuestion['direction'] = 'native-to-english',
): SentenceQuestion {
  return {
    kind: 'word-block',
    sentenceId,
    direction,
    prompt: sentenceId,
    tiles: wordIds.map(tile),
    answer: wordIds,
  };
}

describe('validateBatch — excluded words', () => {
  it('clean batch with no excluded words is valid', () => {
    const result = validateBatch([mcq('w1'), sentence('s1', ['w2', 'w3'])], {
      excludeIds: new Set(['shelved']),
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('flags an excluded word as a standalone MCQ', () => {
    const result = validateBatch([mcq('w1'), mcq('shelved')], {
      excludeIds: new Set(['shelved']),
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      { kind: 'excluded-word', questionIndex: 1, questionKind: 'mcq', wordId: 'shelved' },
    ]);
  });

  it('flags an excluded word leaking in as a sentence tile', () => {
    const result = validateBatch([sentence('s1', ['w1', 'shelved', 'w3'])], {
      excludeIds: new Set(['shelved']),
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      {
        kind: 'excluded-word',
        questionIndex: 0,
        questionKind: 'word-block',
        wordId: 'shelved',
        sentenceId: 's1',
      },
    ]);
  });

  it('reports every excluded tile within a single sentence', () => {
    const result = validateBatch([sentence('s1', ['a', 'b', 'c'])], {
      excludeIds: new Set(['a', 'c']),
    });
    expect(result.violations).toHaveLength(2);
    expect(result.violations.map((v) => v.kind === 'excluded-word' && v.wordId)).toEqual(['a', 'c']);
  });

  it('no excludeIds → excluded-word rule is skipped', () => {
    const result = validateBatch([mcq('anything'), sentence('s1', ['x', 'y'])]);
    expect(result.valid).toBe(true);
  });

  it('empty excludeIds set → excluded-word rule is skipped', () => {
    const result = validateBatch([mcq('anything')], { excludeIds: new Set() });
    expect(result.valid).toBe(true);
  });
});

describe('validateBatch — duplicate questions', () => {
  it('flags the same word+direction MCQ appearing twice', () => {
    const result = validateBatch([mcq('w1'), mcq('w1')]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      { kind: 'duplicate-question', questionIndex: 1, identity: 'mcq:w1:native-to-english' },
    ]);
  });

  it('same word in two directions is NOT a duplicate', () => {
    const result = validateBatch([mcq('w1', 'native-to-english'), mcq('w1', 'english-to-native')]);
    expect(result.valid).toBe(true);
  });

  it('flags a repeated sentence+direction', () => {
    const result = validateBatch([sentence('s1', ['a']), sentence('s1', ['a'])]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      { kind: 'duplicate-question', questionIndex: 1, identity: 'word-block:s1:native-to-english' },
    ]);
  });
});

describe('validateBatch — combined', () => {
  it('reports both an excluded word and a duplicate together', () => {
    const result = validateBatch([mcq('shelved'), mcq('w1'), mcq('w1')], {
      excludeIds: new Set(['shelved']),
    });
    expect(result.violations).toHaveLength(2);
    expect(result.violations.map((v) => v.kind)).toEqual(['excluded-word', 'duplicate-question']);
  });

  it('empty batch is valid', () => {
    expect(validateBatch([]).valid).toBe(true);
  });
});
