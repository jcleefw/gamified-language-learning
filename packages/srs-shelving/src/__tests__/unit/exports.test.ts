import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHELVING_CONFIG,
  evaluateShelving,
  unshelveAll,
} from '../../index.js';

describe('Public API exports', () => {
  it('DEFAULT_SHELVING_CONFIG.stagnationBatchWindow equals 3', () => {
    expect(DEFAULT_SHELVING_CONFIG.stagnationBatchWindow).toBe(3);
  });

  it('DEFAULT_SHELVING_CONFIG.maxShelved equals 2', () => {
    expect(DEFAULT_SHELVING_CONFIG.maxShelved).toBe(2);
  });

  it('DEFAULT_SHELVING_CONFIG has exactly two keys', () => {
    expect(Object.keys(DEFAULT_SHELVING_CONFIG).length).toBe(2);
  });

  it('evaluateShelving is exported and is a function', () => {
    expect(typeof evaluateShelving).toBe('function');
  });

  it('unshelveAll is exported and is a function', () => {
    expect(typeof unshelveAll).toBe('function');
  });
});

// Compile-time type assertions — these lines must typecheck
import type { ShelvingConfig, ShelvedWord, ShelvingDecision } from '../../index.js';
const _config: ShelvingConfig = DEFAULT_SHELVING_CONFIG;
