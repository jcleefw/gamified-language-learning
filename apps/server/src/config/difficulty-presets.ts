import type { StreakThresholds } from '@gll/srs-engine-v2/learn';

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
 * Name → bundle map. Only `normal` is populated — its values are today's config,
 * so the default user sees zero behaviour change. `maxMastery` is the fixed T3
 * scale (== `FIXED_SYSTEM.maxMastery`) and stays identical across every preset
 * once `gentle`/`intense` land. Inlined here (not imported from `learning.ts`) so
 * the preset map is the single source of `streakThresholds`, with no import cycle.
 * Server-only: never in `@gll/api-contract` or `@gll/db`.
 */
export const DIFFICULTY_PRESETS: Partial<
  Record<DifficultyPreset, StreakThresholds>
> = {
  normal: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 }, // == today's config
  // gentle:  DEFERRED — values TBD (more correct-in-a-row to graduate, forgiving on misses)
  // intense: DEFERRED — values TBD (graduate fast, punish misses)
};

export const DEFAULT_PRESET: DifficultyPreset = 'normal';

/**
 * True only for a preset that currently HAS a bundle (⟺ selectable). Drives the
 * write-path enum so `gentle`/`intense` are rejected until their bundles land.
 */
export function isDifficultyPreset(x: unknown): x is DifficultyPreset {
  // `hasOwnProperty`, not `in`: `in` walks the prototype chain, so `'toString'`
  // /`'constructor'` would match and `resolvePreset` would return an inherited
  // function as a bundle. Only OWN, populated preset names are selectable.
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(DIFFICULTY_PRESETS, x);
}

/** Resolve a preset name to its bundle. Throws for deferred/unknown names. */
export function resolvePreset(name: DifficultyPreset): StreakThresholds {
  const bundle = DIFFICULTY_PRESETS[name];
  if (!bundle) {
    throw new Error(`difficulty preset not available: ${name}`);
  }
  return bundle;
}
