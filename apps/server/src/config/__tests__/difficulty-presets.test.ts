import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_PRESETS,
  DEFAULT_PRESET,
  isDifficultyPreset,
  resolvePreset,
} from '../difficulty-presets.js';
import { FIXED_SYSTEM } from '../learning.js';

describe('difficulty-presets', () => {
  it("resolvePreset('normal') is today's config (no behaviour change for the default user)", () => {
    expect(resolvePreset('normal')).toEqual({
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    });
  });

  it('DEFAULT_PRESET is normal, and normal keeps the fixed T3 maxMastery scale', () => {
    expect(DEFAULT_PRESET).toBe('normal');
    expect(resolvePreset('normal').maxMastery).toBe(FIXED_SYSTEM.maxMastery);
  });

  it('isDifficultyPreset is true for normal only (⟺ present in DIFFICULTY_PRESETS)', () => {
    expect(isDifficultyPreset('normal')).toBe(true);
    expect(isDifficultyPreset('gentle')).toBe(false);
    expect(isDifficultyPreset('intense')).toBe(false);
    expect(isDifficultyPreset('nonsense')).toBe(false);
    expect(isDifficultyPreset(undefined)).toBe(false);
    expect(isDifficultyPreset(null)).toBe(false);
    expect(isDifficultyPreset(2)).toBe(false);
  });

  it('resolvePreset throws for deferred (gentle/intense) and unknown names', () => {
    expect(() => resolvePreset('gentle')).toThrow();
    expect(() => resolvePreset('intense')).toThrow();
    // @ts-expect-error — resolvePreset rejects names outside the reserved set
    expect(() => resolvePreset('nonsense')).toThrow();
  });

  it('only normal ships a bundle this epic', () => {
    expect(Object.keys(DIFFICULTY_PRESETS)).toEqual(['normal']);
  });
});
