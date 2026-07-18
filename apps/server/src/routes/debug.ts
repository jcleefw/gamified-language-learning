import { Hono, type Context } from 'hono';
import {
  getDb,
  SqliteAnswerEventStore,
  type ResolvedThresholds,
  type AnswerEventRecord,
} from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2/learn';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { TransitionInput } from '../replay/artifact.js';
import { getCurrentUserId } from '../identity/current-user.js';
import { logger } from '../logger.js';

const USER_ID = getCurrentUserId();

// Post-hoc dump size guard: how many recent answer_events rows /transitions-recent
// will assemble at most, and its default when the caller omits `lastN`.
const RECENT_DEFAULT = 100;
const RECENT_MAX = 1000;

const router = new Hono();

/**
 * The transition slice of a debug-trace artifact (EP40-DS02). Assembled server-side
 * from `answer_events` because the server owns the WordState/threshold rows — the
 * browser does no WordState arithmetic, it only decorates with appearance + meta.
 */
export interface DebugTransitionsResponse {
  thresholds: ResolvedThresholds | null; // uniform across the rows; null ⟺ no transitions
  baseline: WordState[]; // first beforeState per touched word (brand-new words skipped)
  inputs: TransitionInput[]; // one per answer_events row, in application (id) order
}

/**
 * Assemble a transition slice from `answer_events` rows already in application order.
 * Shared by the armed path (rows fetched by correlation id) and the post-hoc path
 * (recent rows), so both produce byte-identical slices from the same logic.
 *
 * A `non-uniform` result means the rows span a config change (differing thresholds)
 * and must not be replayed as one session — the caller turns it into a 400.
 */
type SliceResult =
  | { kind: 'empty' }
  | { kind: 'non-uniform' }
  | { kind: 'ok'; data: DebugTransitionsResponse };

function assembleSlice(ordered: AnswerEventRecord[]): SliceResult {
  if (ordered.length === 0) return { kind: 'empty' };

  // A recording must not span a config change: every row's thresholds must match.
  // Serialize the reference once (not per row) and compare each row against it.
  const thresholds = ordered[0].resolvedThresholds;
  const ref = JSON.stringify(thresholds);
  const uniform = ordered.every((r) => JSON.stringify(r.resolvedThresholds) === ref);
  if (!uniform) return { kind: 'non-uniform' };

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

  return { kind: 'ok', data: { thresholds, baseline, inputs } };
}

function sliceToResponse(result: SliceResult, c: Context) {
  if (result.kind === 'non-uniform') {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.BAD_REQUEST,
        message: 'recording spans a non-uniform threshold set (config changed mid-session)',
      },
    };
    return c.json(body, 400);
  }
  const data: DebugTransitionsResponse =
    result.kind === 'empty'
      ? { thresholds: null, baseline: [], inputs: [] }
      : result.data;
  const body: ApiResponse<DebugTransitionsResponse> = { success: true, data };
  return c.json(body);
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

  return sliceToResponse(assembleSlice(ordered), c);
});

/**
 * Post-hoc transition assembly (EP40): assemble a replayable slice from the most recent
 * `lastN` answer_events — no prior arming needed, because every `/api/answer` already
 * persisted its transition. The resulting artifact carries an empty `appearance[]` (that
 * context is only buffered while a recording is armed); the replay fold does not use it.
 */
router.post('/debug/transitions-recent', async (c) => {
  const log = logger.child({ route: 'debug/transitions-recent' });

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    payload = {}; // body is optional — default lastN applies
  }

  const rawLastN = (payload as { lastN?: unknown })?.lastN;
  if (rawLastN !== undefined && (typeof rawLastN !== 'number' || !Number.isInteger(rawLastN) || rawLastN <= 0)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'lastN must be a positive integer' },
    };
    return c.json(body, 400);
  }
  const limit = Math.min(rawLastN ?? RECENT_DEFAULT, RECENT_MAX);

  const store = new SqliteAnswerEventStore(getDb(), log);
  const ordered = await store.getRecentAnswerEvents(USER_ID, limit);

  return sliceToResponse(assembleSlice(ordered), c);
});

export default router;
