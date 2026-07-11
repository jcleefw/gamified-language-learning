import type { StreakThresholds, SentenceQuestion } from '@gll/srs-engine-v2';
import type { IUserConfigStore, UserConfigRecord } from '@gll/db';
import {
  DEFAULT_PRESET,
  isDifficultyPreset,
  resolvePreset,
  type DifficultyPreset,
} from './difficulty-presets.js';

/**
 * T1 base — the fallback values for the per-user tunable preferences that are NOT
 * part of the difficulty bundle. A user's override wins; an absent override falls
 * back here. Difficulty itself is a preset name resolved via `difficulty-presets`.
 */
export const T1_BASE: {
  wordsPerBatch: number;
  sentenceDirections: SentenceQuestion['direction'][];
} = {
  wordsPerBatch: 3,
  sentenceDirections: [
    'english-to-native',
    'romanization-to-native',
    'native-to-romanization',
  ],
};

/**
 * T3 fixed system constants — engine mechanics and the fixed mastery bar. Identical
 * for every user/preset and never user-writable (the `PUT /api/config` schema has no
 * key for any of them). `masteryThreshold`/`maxMastery` are the single fixed bar:
 * per-user tuning would desync analytics + review-card seeding. Served read-only under
 * `system` (the client legitimately applies these), but never written back.
 */
export const FIXED_SYSTEM = {
  masteryThreshold: 2, // fixed bar (completed-deck detection + graduation trigger)
  maxMastery: 2, // fixed scale (also inside every preset bundle; drives the progress bar)
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
  sentenceScheduling: { minSeenForSentence: 1, sentenceBatchGap: 2 },
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: 2,
    sentenceWrongStreakThreshold: 3,
  },
} as const;

/**
 * The default learning policy as a single `{ masteryThreshold, streakThresholds }`
 * bundle — the fixed T3 bar plus the default preset's forgiveness. Derived, not an
 * independent source of truth. Used by server-side tooling (replay/seed) that needs
 * the default-user policy as one object; the live `/api/answer` transition resolves
 * `streakThresholds` per user instead.
 */
export const DEFAULT_LEARNING: {
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
} = {
  masteryThreshold: FIXED_SYSTEM.masteryThreshold,
  streakThresholds: resolvePreset(DEFAULT_PRESET),
};

/**
 * The preset name in effect for a stored config: the stored name if it is currently
 * selectable, otherwise the default. Guarding with `isDifficultyPreset` keeps the hot
 * path robust if a once-stored name is later deferred (falls back rather than
 * throwing). The write path is the primary guard; this is defence.
 */
function resolvePresetName(cfg: UserConfigRecord | null): DifficultyPreset {
  return cfg && isDifficultyPreset(cfg.difficultyPreset)
    ? cfg.difficultyPreset
    : DEFAULT_PRESET;
}

/** Resolve the difficulty `StreakThresholds` in effect for a user. */
export async function resolveUserThresholds(
  store: IUserConfigStore,
  userId: string,
): Promise<StreakThresholds> {
  return resolvePreset(resolvePresetName(await store.get(userId)));
}

/**
 * Wire shape for GET /api/config, tier-shaped and asymmetric: `user` (T1, resolved
 * from defaults ← overrides, the only writable surface) and `system` (T3, fixed,
 * served read-only because the client applies it but a route never writes it). No
 * `pedagogy` key (the empty T2 tier was eliminated). Declared server-side on purpose:
 * config is server-owned and must not surface in @gll/api-contract.
 */
export interface AppConfigResponse {
  user: {
    difficultyPreset: DifficultyPreset;
    streakThresholds: StreakThresholds;
    wordsPerBatch: number;
    sentenceDirections: SentenceQuestion['direction'][];
  };
  system: {
    masteryThreshold: number;
    maxRetryPerSession: number;
    maxRetryPerWord: number;
    sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
    sentenceGraduation: {
      sentenceCorrectStreakThreshold: number;
      sentenceWrongStreakThreshold: number;
    };
  };
}

/**
 * Assemble the config served read-only to clients: base ← the current user's
 * overrides. Reads the preset name + standalone prefs from the store, falls back to
 * `DEFAULT_PRESET`/`T1_BASE` per absent field, resolves the preset to its bundle, and
 * returns `{ user, system }`. A user with no overrides (NULL blob) resolves to today's
 * values, so the default user's response is byte-identical (minus `pedagogy`, plus
 * `system`).
 */
export async function getAppConfig(
  store: IUserConfigStore,
  userId: string,
): Promise<AppConfigResponse> {
  const cfg = await store.get(userId);
  const presetName = resolvePresetName(cfg);

  return {
    user: {
      difficultyPreset: presetName,
      streakThresholds: resolvePreset(presetName),
      wordsPerBatch: cfg?.wordsPerBatch ?? T1_BASE.wordsPerBatch,
      sentenceDirections:
        (cfg?.sentenceDirections as SentenceQuestion['direction'][] | null) ??
        T1_BASE.sentenceDirections,
    },
    system: {
      masteryThreshold: FIXED_SYSTEM.masteryThreshold,
      maxRetryPerSession: FIXED_SYSTEM.maxRetryPerSession,
      maxRetryPerWord: FIXED_SYSTEM.maxRetryPerWord,
      sentenceScheduling: { ...FIXED_SYSTEM.sentenceScheduling },
      sentenceGraduation: { ...FIXED_SYSTEM.sentenceGraduation },
    },
  };
}
