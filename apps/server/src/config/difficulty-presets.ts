import type { StreakThresholds } from '@gll/srs-engine-v2';
import { LEARNING_CONFIG } from './learning.js';

/**
 * Server-only difficulty knob (T1). The preset NAME is the unit of persistence
 * and API exchange; the resolved `StreakThresholds` bundle never leaves the
 * server. This keeps difficulty a bounded, validated choice — forgiveness and
 * pacing — rather than a free-form integer the user types.
 *
 * The full three names are RESERVED now; only `normal` ships a bundle this epic.
 * `gentle`/`intense` are named so the shape is stable, but their threshold
 * values are DEFERRED to a later story — the type carries them, the map does not.
 */
export type DifficultyPreset = 'gentle' | 'normal' | 'intense';

/**
 * Name → bundle map. Only `normal` is populated, pinned to today's
 * `LEARNING_CONFIG.streakThresholds`, so the default user sees zero behaviour
 * change. `maxMastery` is the fixed T3 scale and stays identical across every
 * preset once `gentle`/`intense` land. Server-only: never in `@gll/api-contract`
 * or `@gll/db`.
 */
export const DIFFICULTY_PRESETS: Partial<
  Record<DifficultyPreset, StreakThresholds>
> = {
  normal: LEARNING_CONFIG.streakThresholds, // == today's config
  // gentle:  DEFERRED — values TBD (more correct-in-a-row to graduate, forgiving on misses)
  // intense: DEFERRED — values TBD (graduate fast, punish misses)
};

export const DEFAULT_PRESET: DifficultyPreset = 'normal';

/**
 * True only for a preset that currently HAS a bundle (⟺ selectable). Drives the
 * write-path enum so `gentle`/`intense` are rejected until their bundles land.
 */
export function isDifficultyPreset(x: unknown): x is DifficultyPreset {
  return typeof x === 'string' && x in DIFFICULTY_PRESETS;
}

/** Resolve a preset name to its bundle. Throws for deferred/unknown names. */
export function resolvePreset(name: DifficultyPreset): StreakThresholds {
  const bundle = DIFFICULTY_PRESETS[name];
  if (!bundle) {
    throw new Error(`difficulty preset not available: ${name}`);
  }
  return bundle;
}
