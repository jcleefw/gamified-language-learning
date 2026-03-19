import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../../data/mock/mock-consonants.js';
import { mockWords } from '../../../data/mock/mock-words.js';
import { composeBatch, composeBatchMulti } from '../../engine/compose-batch.js';

const consonant = mockConsonants[0]; // ก (Ko Kai, k, middle)
const pool = mockConsonants;

describe('composeBatch', () => {
  it('returns exactly 4 questions', () => {
    const batch = composeBatch(consonant, pool);
    expect(batch).toHaveLength(4);
  });

  it('each question has exactly 4 choices', () => {
    const batch = composeBatch(consonant, pool);
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
    }
  });

  it('exactly 1 choice is marked correct per question', () => {
    const batch = composeBatch(consonant, pool);
    for (const q of batch) {
      const correct = q.choices.filter(c => c.isCorrect);
      expect(correct).toHaveLength(1);
    }
  });

  it('native-to-english choices are all english(class) format', () => {
    const q = composeBatch(consonant, pool).find(q => q.direction === 'native-to-english')!;
    const pattern = /^[a-z]+ \((middle|high|low)\)$/;
    for (const choice of q.choices) {
      expect(choice.value).toMatch(pattern);
    }
  });

  it('english-to-native choices are all native Thai strings', () => {
    const q = composeBatch(consonant, pool).find(q => q.direction === 'english-to-native')!;
    const nativeValues = pool.map(c => c.native);
    for (const choice of q.choices) {
      expect(nativeValues).toContain(choice.value);
    }
  });

  it('native-to-romanization choices are all romanization strings', () => {
    const q = composeBatch(consonant, pool).find(q => q.direction === 'native-to-romanization')!;
    const romanizationValues = pool.map(c => c.romanization);
    for (const choice of q.choices) {
      expect(romanizationValues).toContain(choice.value);
    }
  });

  it('romanization-to-native choices are all native Thai strings', () => {
    const q = composeBatch(consonant, pool).find(q => q.direction === 'romanization-to-native')!;
    const nativeValues = pool.map(c => c.native);
    for (const choice of q.choices) {
      expect(nativeValues).toContain(choice.value);
    }
  });

  it('correct answer is always present in choices', () => {
    const batch = composeBatch(consonant, pool);

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

describe('composeBatchMulti', () => {
  const words = mockConsonants.slice(0, 3);
  const pool = mockConsonants;
  const questionLimit = 5;

  it('returns exactly questionLimit questions', () => {
    const batch = composeBatchMulti(words, pool, { questionLimit });
    expect(batch).toHaveLength(questionLimit);
  });

  it('every input word appears in at least 1 question', () => {
    const batch = composeBatchMulti(words, pool, { questionLimit });
    const prompts = batch.map(q => q.prompt);
    for (const word of words) {
      const covered = prompts.includes(word.native) || prompts.includes(`${word.english} (${word.class})`) || prompts.includes(word.romanization);
      expect(covered, `word ${word.id} not covered`).toBe(true);
    }
  });

  it('each question has exactly 4 choices, exactly 1 correct', () => {
    const batch = composeBatchMulti(words, pool, { questionLimit });
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
    }
  });

  it('no duplicate word+direction pairs', () => {
    const batch = composeBatchMulti(words, pool, { questionLimit });
    const seen = new Set<string>();
    for (const q of batch) {
      const key = `${q.prompt}::${q.direction}`;
      expect(seen.has(key), `duplicate: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('returns all questions when questionLimit >= total possible', () => {
    const batch = composeBatchMulti(words, pool, { questionLimit: 100 });
    expect(batch).toHaveLength(words.length * 4);
  });
});

describe('composeBatch with MockWord', () => {
  const word = mockWords[0]; // หิว (hungry)
  const wordPool = mockWords;

  it('native-to-english choices are exact english values from the pool', () => {
    const batch = composeBatch(word, wordPool);
    const q = batch.find(q => q.direction === 'native-to-english')!;
    const englishValues = wordPool.map(w => w.english);
    for (const choice of q.choices) {
      expect(englishValues).toContain(choice.value);
    }
  });
});

describe('composeBatchMulti with word pool', () => {
  const words = mockWords.slice(0, 3);
  const wordPool = mockWords;
  const questionLimit = 5;

  it('returns exactly questionLimit questions', () => {
    const batch = composeBatchMulti(words, wordPool, { questionLimit });
    expect(batch).toHaveLength(questionLimit);
  });

  it('every input word appears in at least 1 question', () => {
    const batch = composeBatchMulti(words, wordPool, { questionLimit });
    const prompts = batch.map(q => q.prompt);
    for (const word of words) {
      const covered = prompts.includes(word.native) || prompts.includes(word.english) || prompts.includes(word.romanization);
      expect(covered, `word ${word.id} not covered`).toBe(true);
    }
  });

  it('each question has exactly 4 choices, exactly 1 correct', () => {
    const batch = composeBatchMulti(words, wordPool, { questionLimit });
    for (const q of batch) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
    }
  });

  it('no duplicate word+direction pairs', () => {
    const batch = composeBatchMulti(words, wordPool, { questionLimit });
    const seen = new Set<string>();
    for (const q of batch) {
      const key = `${q.prompt}::${q.direction}`;
      expect(seen.has(key), `duplicate: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('native-to-english choices are plain english strings (no class suffix)', () => {
    const batch = composeBatchMulti(words, wordPool, { questionLimit: 100 });
    const nativeToEnglish = batch.filter(q => q.direction === 'native-to-english');
    const englishValues = wordPool.map(w => w.english);
    for (const q of nativeToEnglish) {
      for (const choice of q.choices) {
        expect(englishValues).toContain(choice.value);
      }
    }
  });
});
