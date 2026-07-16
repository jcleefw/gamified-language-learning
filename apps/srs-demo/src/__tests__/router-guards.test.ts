import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Router, RouteLocationNormalized } from 'vue-router';
import { registerNavigationGuard, markInternalNavigation } from '../router-guards';
import { ROUTE_NAMES } from '../routeNames';
import {
  setLearningSession,
  resetLearningSessionForTest,
} from '../composables/learningSessionSingleton';

const isRecording = { value: false };
let finalizeOutcome: 'not-needed' | 'finalized' | 'failed' = 'not-needed';

vi.mock('../composables/useDebugRecording', () => ({
  useDebugRecording: () => ({ isRecording }),
  finalizeRecordingOnNav: vi.fn(async () => finalizeOutcome),
  crossesPhaseOrMidQuiz: (
    fromPhase: 'learning' | 'review' | null,
    targetPhase: 'learning' | 'review',
    isMidQuiz: boolean,
  ) => (fromPhase !== null && fromPhase !== targetPhase) || isMidQuiz,
}));

type RouteStub = Pick<RouteLocationNormalized, 'name' | 'meta'>;

function route(name: string | null, meta: RouteStub['meta'] = {}): RouteStub {
  return { name: name ?? undefined, meta };
}

function installGuard() {
  let guard!: (to: RouteStub, from: RouteStub) => Promise<unknown>;
  const router = {
    beforeEach: (fn: typeof guard) => {
      guard = fn;
    },
  } as unknown as Router;
  registerNavigationGuard(router);
  return (to: RouteStub, from: RouteStub) => guard(to, from);
}

describe('registerNavigationGuard', () => {
  const finishBatchAndTransition = vi.fn(async () => {});
  const apiError = { value: null as string | null };
  const batchState = {
    value: { results: [] as unknown[] } as { results: unknown[] } | null,
  };
  let runGuard: (to: RouteStub, from: RouteStub) => Promise<unknown>;

  beforeEach(() => {
    resetLearningSessionForTest();
    isRecording.value = false;
    finalizeOutcome = 'not-needed';
    finishBatchAndTransition.mockClear();
    apiError.value = null;
    batchState.value = { results: [] };
    setLearningSession({
      session: { batchState, finishBatchAndTransition } as never,
      apiError: apiError as never,
    });
    runGuard = installGuard();
    vi.spyOn(window, 'confirm');
  });

  it('prompts to confirm on a Learning↔Review crossing, and stays when cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const result = await runGuard(
      route(ROUTE_NAMES.REVIEW_HUB),
      route(ROUTE_NAMES.DECK_SELECT),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('proceeds past the crossing confirm when accepted', async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    const result = await runGuard(
      route(ROUTE_NAMES.REVIEW_HUB),
      route(ROUTE_NAMES.DECK_SELECT),
    );
    expect(result).toBe(true);
  });

  it('flushes the active batch on a mid-quiz exit', async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    batchState.value = { results: [{ correct: true }] };
    const result = await runGuard(route(ROUTE_NAMES.RESULTS), route(ROUTE_NAMES.QUIZ));
    expect(finishBatchAndTransition).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('does not flush a mid-quiz exit with no answered results', async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    batchState.value = { results: [] };
    await runGuard(route(ROUTE_NAMES.RESULTS), route(ROUTE_NAMES.QUIZ));
    expect(finishBatchAndTransition).not.toHaveBeenCalled();
  });

  it('bypasses the confirm/flush/finalize logic exactly once after markInternalNavigation', async () => {
    markInternalNavigation();
    const bypassed = await runGuard(
      route(ROUTE_NAMES.REVIEW_HUB),
      route(ROUTE_NAMES.DECK_SELECT),
    );
    expect(bypassed).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();

    // The next navigation is a normal, guarded one again.
    vi.mocked(window.confirm).mockReturnValue(false);
    const guarded = await runGuard(
      route(ROUTE_NAMES.REVIEW_HUB),
      route(ROUTE_NAMES.DECK_SELECT),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(guarded).toBe(false);
  });

  it('always bypasses curation routes, without confirm or session access', async () => {
    const result = await runGuard(route(ROUTE_NAMES.CURATION), route(ROUTE_NAMES.HOME));
    expect(result).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(finishBatchAndTransition).not.toHaveBeenCalled();
  });

  it('blocks navigation and sets apiError when finalize fails', async () => {
    finalizeOutcome = 'failed';
    const result = await runGuard(route(ROUTE_NAMES.QUIZ), route(ROUTE_NAMES.DECK_SELECT));
    expect(result).toBe(false);
    expect(apiError.value).toMatch(/recording/i);
  });

  it('fails safe (allows navigation) when no session has been registered yet', async () => {
    resetLearningSessionForTest();
    const result = await runGuard(
      route(ROUTE_NAMES.REVIEW_HUB),
      route(ROUTE_NAMES.DECK_SELECT),
    );
    expect(result).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
