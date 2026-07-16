import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../../../data/mock/mock-consonants.js';
import { mockWords } from '../../../../data/mock/mock-words.js';
import { mockVowels } from '../../../../data/mock/mock-vowels.js';
import { mockTones } from '../../../../data/mock/mock-tones.js';
import { composeWordBatch, composeWordBatchMulti } from '../../engine/compose-word-batch.js';

const consonant = mockConsonants[0]; // ก (Ko Kai, k, middle)
const pool = mockConsonants;

describe('composeWordBatch', () => {
  it('returns exactly 4 questions for a consonant', () => {
    const batch = composeWordBatch(consonant, pool);
    expect(batch).toHaveLength(4);
  });

  it('each question has exactly 4 choices', () => {
    const batch = composeWordBatch(consonant, pool);
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
    }
  });

  it('exactly 1 choice is marked correct per question', () => {
    const batch = composeWordBatch(consonant, pool);
    for (const q of batch) {
      const correct = q.choices.filter(c => c.isCorrect);
      expect(correct).toHaveLength(1);
    }
  });

  it('native-to-english choices are all english(class) format', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'native-to-english')!;
    const pattern = /^[a-z]+ \((middle|high|low)\)$/;
    for (const choice of q.choices) {
      expect(choice.value).toMatch(pattern);
    }
  });

  it('english-to-native choices are all native Thai strings', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'english-to-native')!;
    const nativeValues = pool.map(c => c.native);
    for (const choice of q.choices) {
      expect(nativeValues).toContain(choice.value);
    }
  });

  it('native-to-romanization choices are all romanization strings', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'native-to-romanization')!;
    const romanizationValues = pool.map(c => c.romanization);
    for (const choice of q.choices) {
      expect(romanizationValues).toContain(choice.value);
    }
  });

  it('romanization-to-native choices are all native Thai strings', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'romanization-to-native')!;
    const nativeValues = pool.map(c => c.native);
    for (const choice of q.choices) {
      expect(nativeValues).toContain(choice.value);
    }
  });

  it('each question carries the wordId of the item', () => {
    const batch = composeWordBatch(consonant, pool);
    for (const q of batch) {
      expect(q.wordId).toBe(consonant.id);
    }
  });

  it('correct answer is always present in choices', () => {
    const batch = composeWordBatch(consonant, pool);

    const englishWithClass = `${consonant.english} (${consonant.class})`;
    const q1 = batch.find(q => q.direction === 'native-to-english')!;
    const q2 = batch.find(q => q.direction === 'english-to-native')!;
    const q3 = batch.find(q => q.direction === 'native-to-romanization')!;
    const q4 = batch.find(q => q.direction === 'romanization-to-native')!;

    expect(q1.choices.find(c => c.isCorrect)?.value).toBe(englishWithClass);
    expect(q2.choices.find(c => c.isCorrect)?.value).toBe(consonant.native);
    expect(q3.choices.find(c => c.isCorrect)?.value).toBe(consonant.romanization);
    expect(q4.choices.find(c => c.isCorrect)?.value).toBe(consonant.native);
  });
});

describe('composeWordBatch — prompt values', () => {
  it('native-to-english prompt is the native string', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'native-to-english')!;
    expect(q.prompt).toBe(consonant.native);
  });

  it('english-to-native prompt uses "english (class)" format for consonants', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'english-to-native')!;
    expect(q.prompt).toBe(`${consonant.english} (${consonant.class})`);
  });

  it('native-to-romanization prompt is the native string', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'native-to-romanization')!;
    expect(q.prompt).toBe(consonant.native);
  });

  it('romanization-to-native prompt is the romanization string', () => {
    const q = composeWordBatch(consonant, pool).find(q => q.direction === 'romanization-to-native')!;
    expect(q.prompt).toBe(consonant.romanization);
  });
});

describe('composeWordBatch — choice structure', () => {
  it('choice labels are exactly a, b, c, d', () => {
    const batch = composeWordBatch(consonant, pool);
    for (const q of batch) {
      expect(q.choices.map(c => c.label)).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('all 4 choice values are distinct within each question', () => {
    const batch = composeWordBatch(consonant, pool);
    for (const q of batch) {
      const values = q.choices.map(c => c.value);
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe('composeWordBatch with Vowel', () => {
  const vowel = mockVowels[0];
  const vowelPool = mockVowels;

  it('returns exactly 4 questions for a vowel', () => {
    const batch = composeWordBatch(vowel, vowelPool);
    expect(batch).toHaveLength(4);
  });

  it('includes all four directions', () => {
    const directions = composeWordBatch(vowel, vowelPool).map(q => q.direction);
    expect(directions).toContain('native-to-english');
    expect(directions).toContain('english-to-native');
    expect(directions).toContain('native-to-romanization');
    expect(directions).toContain('romanization-to-native');
  });

  it('correct answer for native-to-english is plain english string', () => {
    const batch = composeWordBatch(vowel, vowelPool);
    const q = batch.find(q => q.direction === 'native-to-english')!;
    expect(q.choices.find(c => c.isCorrect)?.value).toBe(vowel.english);
  });

  it('english-to-native prompt is plain english (no class suffix)', () => {
    const q = composeWordBatch(vowel, vowelPool).find(q => q.direction === 'english-to-native')!;
    expect(q.prompt).toBe(vowel.english);
  });
});

describe('composeWordBatch with Tone', () => {
  const tone = mockTones[0]; // ่ (mai ek, low tone)
  const tonePool = mockTones;

  it('returns exactly 2 questions for a tone', () => {
    const batch = composeWordBatch(tone, tonePool);
    expect(batch).toHaveLength(2);
  });

  it('only includes native-to-english and english-to-native directions', () => {
    const batch = composeWordBatch(tone, tonePool);
    const directions = batch.map(q => q.direction);
    expect(directions).toContain('native-to-english');
    expect(directions).toContain('english-to-native');
    expect(directions).not.toContain('native-to-romanization');
    expect(directions).not.toContain('romanization-to-native');
  });

  it('correct answer for native-to-english is tone name', () => {
    const batch = composeWordBatch(tone, tonePool);
    const q = batch.find(q => q.direction === 'native-to-english')!;
    expect(q.choices.find(c => c.isCorrect)?.value).toBe(tone.english);
  });
});

describe('composeWordBatchMulti', () => {
  const words = mockConsonants.slice(0, 3);
  const pool = mockConsonants;
  const questionLimit = 5;

  it('returns exactly questionLimit questions', () => {
    const batch = composeWordBatchMulti(words, pool, { questionLimit });
    expect(batch).toHaveLength(questionLimit);
  });

  it('every input word appears in at least 1 question', () => {
    const batch = composeWordBatchMulti(words, pool, { questionLimit });
    const prompts = batch.map(q => q.prompt);
    for (const word of words) {
      const covered = prompts.includes(word.native) || prompts.includes(`${word.english} (${word.class})`) || prompts.includes(word.romanization);
      expect(covered, `word ${word.id} not covered`).toBe(true);
    }
  });

  it('each question has exactly 4 choices, exactly 1 correct', () => {
    const batch = composeWordBatchMulti(words, pool, { questionLimit });
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
    }
  });

  it('no duplicate word+direction pairs', () => {
    const batch = composeWordBatchMulti(words, pool, { questionLimit });
    const seen = new Set<string>();
    for (const q of batch) {
      const key = `${q.prompt}::${q.direction}`;
      expect(seen.has(key), `duplicate: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('returns all questions when questionLimit >= total possible', () => {
    const batch = composeWordBatchMulti(words, pool, { questionLimit: 100 });
    expect(batch).toHaveLength(words.length * 4);
  });

  it('with shuffle: false, returns deterministic question order', () => {
    const batch1 = composeWordBatchMulti(words, pool, { questionLimit: 5, shuffle: false });
    const batch2 = composeWordBatchMulti(words, pool, { questionLimit: 5, shuffle: false });

    expect(batch1).toHaveLength(5);
    expect(batch2).toHaveLength(5);

    // Same input → same output with shuffle: false
    for (let i = 0; i < batch1.length; i++) {
      expect(batch1[i].wordId).toBe(batch2[i].wordId);
      expect(batch1[i].direction).toBe(batch2[i].direction);
      expect(batch1[i].prompt).toBe(batch2[i].prompt);
    }
  });

  it('with shuffle: true, may return different order', () => {
    const orderings = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const batch = composeWordBatchMulti(words, pool, { questionLimit: 5, shuffle: true });
      const ordering = batch.map(q => `${q.wordId}::${q.direction}`).join('|');
      orderings.add(ordering);
    }

    // With shuffle: true, we expect variation (low probability all 10 are identical)
    expect(orderings.size).toBeGreaterThan(1);
  });

  it('defaults to shuffle: true for backward compatibility', () => {
    const batchDefault = composeWordBatchMulti(words, pool, { questionLimit: 5 });
    const batchExplicit = composeWordBatchMulti(words, pool, { questionLimit: 5, shuffle: true });

    expect(batchDefault).toHaveLength(5);
    expect(batchExplicit).toHaveLength(5);
    // Both should have valid structure (not checking order since both are shuffled)
    for (const q of batchDefault) {
      expect(q.choices).toHaveLength(4);
    }
  });
});

describe('composeWordBatchMulti — edge cases', () => {
  it('returns empty array when words is empty', () => {
    const batch = composeWordBatchMulti([], mockConsonants, { questionLimit: 5 });
    expect(batch).toHaveLength(0);
  });

  it('returns empty array when questionLimit is 0', () => {
    const batch = composeWordBatchMulti(mockConsonants.slice(0, 3), mockConsonants, { questionLimit: 0 });
    expect(batch).toHaveLength(0);
  });

  it('when questionLimit < words.length, still returns questionLimit questions', () => {
    const words = mockConsonants.slice(0, 4);
    const batch = composeWordBatchMulti(words, mockConsonants, { questionLimit: 2 });
    expect(batch).toHaveLength(2);
  });
});

describe('composeWordBatch with MockWord', () => {
  const word = mockWords[0]; // หิว (hungry)
  const wordPool = mockWords;

  it('native-to-english choices are exact english values from the pool', () => {
    const batch = composeWordBatch(word, wordPool);
    const q = batch.find(q => q.direction === 'native-to-english')!;
    const englishValues = wordPool.map(w => w.english);
    for (const choice of q.choices) {
      expect(englishValues).toContain(choice.value);
    }
  });
});

describe('composeWordBatchMulti with word pool', () => {
  const words = mockWords.slice(0, 3);
  const wordPool = mockWords;
  const questionLimit = 5;

  it('returns exactly questionLimit questions', () => {
    const batch = composeWordBatchMulti(words, wordPool, { questionLimit });
    expect(batch).toHaveLength(questionLimit);
  });

  it('every input word appears in at least 1 question', () => {
    const batch = composeWordBatchMulti(words, wordPool, { questionLimit });
    const prompts = batch.map(q => q.prompt);
    for (const word of words) {
      const covered = prompts.includes(word.native) || prompts.includes(word.english) || prompts.includes(word.romanization);
      expect(covered, `word ${word.id} not covered`).toBe(true);
    }
  });

  it('each question has exactly 4 choices, exactly 1 correct', () => {
    const batch = composeWordBatchMulti(words, wordPool, { questionLimit });
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
    }
  });

  it('no duplicate word+direction pairs', () => {
    const batch = composeWordBatchMulti(words, wordPool, { questionLimit });
    const seen = new Set<string>();
    for (const q of batch) {
      const key = `${q.prompt}::${q.direction}`;
      expect(seen.has(key), `duplicate: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('native-to-english choices are plain english strings (no class suffix)', () => {
    const batch = composeWordBatchMulti(words, wordPool, { questionLimit: 100 });
    const nativeToEnglish = batch.filter(q => q.direction === 'native-to-english');
    const englishValues = wordPool.map(w => w.english);
    for (const q of nativeToEnglish) {
      for (const choice of q.choices) {
        expect(englishValues).toContain(choice.value);
      }
    }
  });
});

