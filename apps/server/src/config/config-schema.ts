import { z } from 'zod';
import type { SentenceQuestion } from '@gll/srs-engine-v2/learn';
import { DIFFICULTY_PRESETS, type DifficultyPreset } from './difficulty-presets.js';

/**
 * Server-side validation for `PUT /api/user/config` — the SOLE guard of the
 * preset-name-only invariant (DS01 stores config as a JSON blob, so storage cannot
 * reject a raw threshold). Load-bearing, not defence-in-depth.
 *
 * `.strict()` makes any unknown key a 400 — so a T3 field (e.g. `masteryThreshold`)
 * is rejected as an unknown key, never silently ignored. The preset enum is DERIVED
 * from the presets that currently ship a bundle (today: `normal` only), so
 * `gentle`/`intense` are rejected until their bundles land — no schema edit needed.
 * Never in @gll/api-contract: config validation is server-owned.
 */
const selectablePresets = Object.keys(DIFFICULTY_PRESETS) as [
  DifficultyPreset,
  ...DifficultyPreset[],
];

const KNOWN_DIRECTIONS = [
  'english-to-native',
  'native-to-english',
  'native-to-romanization',
  'romanization-to-native',
] as const satisfies readonly SentenceQuestion['direction'][];

export const putConfigSchema = z
  .object({
    difficultyPreset: z.enum(selectablePresets).optional(),
    wordsPerBatch: z.number().int().min(1).max(10).optional(),
    // `.min(1)`: an empty list is not "no preference" — it silently disables all
    // sentence questions (startBatch flat-maps to zero thunks). Reject it, mirroring
    // `wordsPerBatch`'s lower bound.
    sentenceDirections: z.array(z.enum(KNOWN_DIRECTIONS)).min(1).optional(),
  })
  .strict();

export type PutConfigRequest = z.infer<typeof putConfigSchema>;
