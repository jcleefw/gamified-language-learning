import { describe, it, expect } from 'vitest';
import { shuffle } from '../../utils/shuffle.js';

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it('returns a new array reference — does not mutate input', () => {
    const input = [1, 2, 3];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it('works with an empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('works with a single-element array', () => {
    expect(shuffle(['a'])).toEqual(['a']);
  });

  it('contains all original elements — no loss or duplication', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result.sort()).toEqual([...input].sort());
  });

  it('works with non-primitive types', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = shuffle(input);
    expect(result).toHaveLength(3);
    expect(result.map(x => x.id).sort()).toEqual([1, 2, 3]);
  });

  it('produces variation over many runs — is not a no-op', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const orderings = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orderings.add(shuffle(input).join(','));
    }
    expect(orderings.size).toBeGreaterThan(1);
  });
});
