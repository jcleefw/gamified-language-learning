import { describe, it, expect } from 'vitest';
import type { ShelvingConfig } from '../../types.js';
import { evaluateShelving, unshelveAll } from '../../policy.js';

const config: ShelvingConfig = {
  stagnationBatchWindow: 3,
  maxShelved: 2,
};

// ---------------------------------------------------------------------------
// evaluateShelving
// ---------------------------------------------------------------------------

describe('evaluateShelving', () => {
  it('no stagnant + no shelved → { toShelve: [], toUnshelve: [] }', () => {
    const result = evaluateShelving([], new Set(), config);
    expect(result).toEqual({ toShelve: [], toUnshelve: [] });
  });

  it('1 stagnant, 0 shelved, maxShelved=2 → shelves it', () => {
    const result = evaluateShelving(['a'], new Set(), config);
    expect(result.toShelve).toEqual(['a']);
    expect(result.toUnshelve).toEqual([]);
  });

  it('2 stagnant exactly fills slots → shelves both', () => {
    const result = evaluateShelving(['a', 'b'], new Set(), config);
    expect(result.toShelve).toEqual(['a', 'b']);
    expect(result.toUnshelve).toEqual([]);
  });

  it('3 stagnant, maxShelved=2 → caps at first 2', () => {
    const result = evaluateShelving(['a', 'b', 'c'], new Set(), config);
    expect(result.toShelve).toEqual(['a', 'b']);
    expect(result.toUnshelve).toEqual([]);
  });

  it('2 stagnant, 1 already shelved, maxShelved=2 → shelves only 1 new', () => {
    const result = evaluateShelving(['a', 'b'], new Set(['x']), config);
    expect(result.toShelve).toEqual(['a']);
    expect(result.toUnshelve).toEqual([]);
  });

  it('cap already reached (2 shelved, maxShelved=2) → toShelve: []', () => {
    const result = evaluateShelving(['a', 'b'], new Set(['x', 'y']), config);
    expect(result.toShelve).toEqual([]);
    expect(result.toUnshelve).toEqual([]);
  });

  it('stagnant candidate already in currentlyShelved → filtered out (not re-shelved)', () => {
    const result = evaluateShelving(['a', 'b'], new Set(['a']), config);
    expect(result.toShelve).toEqual(['b']);
    expect(result.toUnshelve).toEqual([]);
  });

  it('input order preserved when capping — first N from input array', () => {
    const result = evaluateShelving(['c', 'a', 'b'], new Set(), config);
    expect(result.toShelve).toEqual(['c', 'a']);
  });

  it('toUnshelve is always empty from evaluateShelving', () => {
    const result = evaluateShelving(['a', 'b', 'c'], new Set(['x']), config);
    expect(result.toUnshelve).toEqual([]);
  });

  it('maxShelved=0 → toShelve: [] always', () => {
    const zeroConfig: ShelvingConfig = { ...config, maxShelved: 0 };
    const result = evaluateShelving(['a', 'b'], new Set(), zeroConfig);
    expect(result.toShelve).toEqual([]);
    expect(result.toUnshelve).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// unshelveAll
// ---------------------------------------------------------------------------

describe('unshelveAll', () => {
  it('returns an empty Set<string>', () => {
    const result = unshelveAll();
    expect(result).toBeInstanceOf(Set);
  });

  it('returned set has size 0', () => {
    const result = unshelveAll();
    expect(result.size).toBe(0);
  });
});
