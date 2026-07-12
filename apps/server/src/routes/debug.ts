import { Hono } from 'hono';
import { getDb, SqliteAnswerEventStore, type ResolvedThresholds } from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { TransitionInput } from '../replay/artifact.js';
import { getCurrentUserId } from '../identity/current-user.js';
import { logger } from '../logger.js';

const USER_ID = getCurrentUserId();

const router = new Hono();

/**
 * The transition slice of a debug-trace artifact (EP40-DS02). Assembled server-side
 * from `answer_events` because the server owns the WordState/threshold rows — the
 * browser does no WordState arithmetic, it only decorates with appearance + meta.
 */
export interface DebugTransitionsResponse {
  thresholds: ResolvedThresholds | null; // uniform across the rows; null ⟺ no transitions
  baseline: WordState[]; // first beforeState per touched word (brand-new words skipped)
  inputs: TransitionInput[]; // one per answer_events row, in the request's id order
}

router.post('/debug/transitions', async (c) => {
  const log = logger.child({ route: 'debug/transitions' });

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  const correlationIds = (payload as { correlationIds?: unknown })?.correlationIds;
  if (
    !Array.isArray(correlationIds) ||
    !correlationIds.every((id): id is string => typeof id === 'string')
  ) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'correlationIds must be a string[]' },
    };
    return c.json(body, 400);
  }

  const store = new SqliteAnswerEventStore(getDb(), log);
  const records = await store.getAnswerEventsByCorrelationIds(USER_ID, correlationIds);

  // Order by the request's id order and skip ids with no transition row (e.g. sentence
  // serves, which do not hit /api/answer). Map by correlationId — each served question
  // has a unique id, so each row maps to exactly one input.
  const byId = new Map(records.map((r) => [r.correlationId, r]));
  const ordered = correlationIds
    .map((id) => byId.get(id))
    .filter((r): r is (typeof records)[number] => r != null);

  if (ordered.length === 0) {
    const body: ApiResponse<DebugTransitionsResponse> = {
      success: true,
      data: { thresholds: null, baseline: [], inputs: [] },
    };
    return c.json(body);
  }

  // A recording must not span a config change: every row's thresholds must match.
  const thresholds = ordered[0].resolvedThresholds;
  const uniform = ordered.every(
    (r) => JSON.stringify(r.resolvedThresholds) === JSON.stringify(thresholds),
  );
  if (!uniform) {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: 'recording spans a non-uniform threshold set (config changed mid-session)',
      },
    };
    return c.json(body, 400);
  }

  // Lazy baseline: one snapshot per touched word = its state at first appearance.
  // Brand-new words (first beforeState null) contribute no baseline entry — an
  // absent entry lets replay's store return null, matching the live first-sighting.
  const baseline: WordState[] = [];
  const seen = new Set<string>();
  for (const r of ordered) {
    if (seen.has(r.wordId)) continue;
    seen.add(r.wordId);
    if (r.beforeState) baseline.push(r.beforeState);
  }

  const inputs: TransitionInput[] = ordered.map((r) => ({
    correlationId: r.correlationId ?? '',
    wordId: r.wordId,
    correct: r.correct,
    latencyMs: r.latencyMs,
    recheck: r.recheck,
    recordedAfter: r.afterState,
  }));

  const body: ApiResponse<DebugTransitionsResponse> = {
    success: true,
    data: { thresholds, baseline, inputs },
  };
  return c.json(body);
});

export default router;
