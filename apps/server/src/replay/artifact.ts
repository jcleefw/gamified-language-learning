import { z } from 'zod';
import type { WordState } from '@gll/srs-engine-v2/learn';
import type { ResolvedThresholds } from '@gll/db';

/**
 * The self-contained, DB-independent replay artifact (EP40-DS01). A captured session serialises to
 * this shape; `pnpm seed replay` and the Vitest fixture runner consume it. Types are server-owned
 * (the composition layer), not `@gll/api-contract` — the artifact is a tool contract, not a wire DTO.
 * DS02's browser recorder writes JSON matching this.
 */

/** One recorded transition input, stitched to its served question by correlationId, in answer_events id order. */
export interface TransitionInput {
  correlationId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  recheck: boolean;
  recordedAfter: WordState; // the authoritative afterState this step is diffed against
}

/** Recorded orchestration context — read-only, NOT recomputed (ADR D4). Shape owned by DS02's recorder. */
export interface AppearanceEvent {
  correlationId: string | null;
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving';
  at: string;
  data: unknown;
}

export interface ReplayArtifact {
  version: 1;
  meta: {
    createdAt: string;
    sessionId: string;
    phase: 'learning' | 'review';
    originUserId: string;
  };
  thresholds: ResolvedThresholds;
  baseline: WordState[]; // lazy: one per touched word that had prior state
  inputs: TransitionInput[];
  appearance: AppearanceEvent[];
}

const wordStateSchema = z.object({
  wordId: z.string(),
  seen: z.number(),
  correct: z.number(),
  mastery: z.number(),
  correctStreak: z.number(),
  wrongStreak: z.number(),
  lapses: z.number(),
});

const thresholdsSchema = z.object({
  masteryThreshold: z.number(),
  streakThresholds: z.object({
    correctStreakThreshold: z.number(),
    wrongStreakThreshold: z.number(),
    maxMastery: z.number(),
  }),
});

const transitionInputSchema = z.object({
  correlationId: z.string(),
  wordId: z.string(),
  correct: z.boolean(),
  latencyMs: z.number(),
  recheck: z.boolean(),
  recordedAfter: wordStateSchema,
});

const appearanceEventSchema = z.object({
  correlationId: z.string().nullable(),
  kind: z.enum(['pool-selected', 'question-served', 'recheck-triggered', 'shelving']),
  at: z.string(),
  data: z.unknown(),
});

export const replayArtifactSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    createdAt: z.string(),
    sessionId: z.string(),
    phase: z.enum(['learning', 'review']),
    originUserId: z.string(),
  }),
  thresholds: thresholdsSchema,
  baseline: z.array(wordStateSchema),
  inputs: z.array(transitionInputSchema),
  appearance: z.array(appearanceEventSchema),
});

/** Parse+validate an artifact from arbitrary JSON. Throws a readable error on a malformed file. */
export function parseArtifact(json: unknown): ReplayArtifact {
  const result = replayArtifactSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid replay artifact: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  return result.data as ReplayArtifact;
}
