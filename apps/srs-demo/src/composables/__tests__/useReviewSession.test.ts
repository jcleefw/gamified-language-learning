import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { QuizItem, RunState, WordState } from '@gll/srs-engine/learn';
import type { DueReviewItem } from '@gll/api-contract';
import { useReviewSession } from '../useReviewSession';
import type { ConfigType } from '../../types';

// The composable's only I/O is these useStore helpers — mock the module so the
// tests exercise orchestration logic, not the HTTP layer.
const loadDueReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const loadAnytimeReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const postReviewAnswer =
  vi.fn<
    (req: unknown) => Promise<{ wordId: string; due: string; advanced: boolean }>
  >();
vi.mock('../useStore', () => ({
  loadDueReviews: (...args: []) => loadDueReviews(...args),
  loadAnytimeReviews: (...args: []) => loadAnytimeReviews(...args),
  postReviewAnswer: (...args: [unknown]) => postReviewAnswer(...args),
}));

function makeItem(id: string): QuizItem {
  return {
    id,
    native: id,
    english: id,
    romanization: id,
    type: 'word',
    language: 'th',
  } as QuizItem;
}

function makeWordState(mastery: number): WordState {
  return {
    wordId: 'w',
    seen: 1,
    correct: 1,
    mastery,
    correctStreak: 0,
    wrongStreak: 0,
    lapses: 0,
  };
}

const CONFIG = { masteryThreshold: 3 } as ConfigType;

function setup(opts: {
  pool?: QuizItem[];
  runState?: RunState;
  configReady?: boolean;
}) {
  const deps = {
    wordPool: ref(opts.pool ?? []),
    globalRunState: ref(opts.runState ?? (new Map() as RunState)),
    configReady: ref(opts.configReady ?? true),
    CONFIG: ref(CONFIG),
    apiError: ref<string | null>(null),
  };
  return { deps, session: useReviewSession(deps) };
}

beforeEach(() => {
  loadDueReviews.mockReset();
  loadAnytimeReviews.mockReset();
  postReviewAnswer.mockReset();
});

describe('reviewUnlocked gate', () => {
  it('is locked when no word is mastered', () => {
    const runState: RunState = new Map([['w', makeWordState(2)]]);
    const { session } = setup({ runState });
    expect(session.reviewUnlocked.value).toBe(false);
  });

  it('unlocks once any word reaches the mastery threshold', () => {
    const runState: RunState = new Map([['w', makeWordState(3)]]);
    const { session } = setup({ runState });
    expect(session.reviewUnlocked.value).toBe(true);
  });

  it('is fail-closed (locked) when config is not ready', () => {
    const runState: RunState = new Map([['w', makeWordState(5)]]);
    const { session } = setup({ runState, configReady: false });
    expect(session.reviewUnlocked.value).toBe(false);
  });

  // EP39-BUG01: a due/existing card must unlock Review even with no locally-mastered
  // word (e.g. a returning user, or the review-only seed fixture).
  it('unlocks when the user has review cards even if no word is mastered locally', async () => {
    loadAnytimeReviews.mockResolvedValueOnce([
      { wordId: 'a', due: '2027-01-01T00:00:00Z' }, // not-due card; no mastered word state
    ]);
    const { session } = setup({ runState: new Map() }); // nothing mastered locally
    expect(session.reviewUnlocked.value).toBe(false); // before the availability fetch
    await session.refreshReviewAvailability();
    expect(session.hasReviewCards.value).toBe(true);
    expect(session.reviewUnlocked.value).toBe(true); // now unlocked purely by card existence
  });

  it('stays locked when there are neither mastered words nor review cards', async () => {
    loadAnytimeReviews.mockResolvedValueOnce([]);
    const { session } = setup({ runState: new Map() });
    await session.refreshReviewAvailability();
    expect(session.hasReviewCards.value).toBe(false);
    expect(session.reviewUnlocked.value).toBe(false);
  });
});

describe('resolveDueItems', () => {
  it('resolves wordIds against the pool and skips orphans', () => {
    const pool = [makeItem('a'), makeItem('b')];
    const { session } = setup({ pool });
    const reviews: DueReviewItem[] = [
      { wordId: 'a', due: '2026-01-01T00:00:00Z' },
      { wordId: 'gone', due: '2026-01-01T00:00:00Z' }, // orphan → skipped
      { wordId: 'b', due: '2026-01-01T00:00:00Z' },
    ];
    const items = session.resolveDueItems(reviews);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('onReview', () => {
  it('surfaces an error and stays on home when the fetch fails', async () => {
    loadDueReviews.mockRejectedValueOnce(new Error('boom'));
    const { deps, session } = setup({ pool: [makeItem('a')] });
    const outcome = await session.onReview();
    expect(outcome).toBe('stayed');
    expect(session.badgeError.value).toBe(true);
    expect(deps.apiError.value).not.toBeNull();
  });

  it('enters the caught-up state when nothing is due', async () => {
    loadDueReviews.mockResolvedValueOnce([]);
    const { session } = setup({ pool: [makeItem('a')] });
    const outcome = await session.onReview();
    expect(outcome).toBe('entered');
    expect(session.reviewCaughtUp.value).toBe(true);
    expect(session.reviewQuestion.value).toBeNull();
    expect(session.dueReviewCount.value).toBe(0);
  });

  it('builds a question queue from resolved due items', async () => {
    const pool = [makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')];
    loadDueReviews.mockResolvedValueOnce([
      { wordId: 'a', due: '2026-01-01T00:00:00Z' },
    ]);
    const { session } = setup({ pool });
    const outcome = await session.onReview();
    expect(outcome).toBe('entered');
    expect(session.reviewCaughtUp.value).toBe(false);
    expect(session.reviewQuestion.value).not.toBeNull();
    expect(session.reviewBatchState.value).not.toBeNull();
  });
});

describe('onReviewAnswered', () => {
  const pool = [makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')];

  async function enterWithOneDue() {
    loadDueReviews.mockResolvedValueOnce([
      { wordId: 'a', due: '2026-01-01T00:00:00Z' },
    ]);
    const ctx = setup({ pool });
    await ctx.session.onReview();
    return ctx;
  }

  it('does not advance the queue when the answer POST fails', async () => {
    postReviewAnswer.mockRejectedValueOnce(new Error('save failed'));
    const { deps, session } = await enterWithOneDue();
    const before = session.reviewQuestion.value;
    await session.onReviewAnswered({ wordId: 'a', correct: true } as never);
    // Still on the same question, summary untouched, error surfaced.
    expect(session.reviewQuestion.value).toBe(before);
    expect(session.reviewSummary.value.reviewed).toBe(0);
    expect(deps.apiError.value).not.toBeNull();
  });

  it('adopts the server due and advances to summary on the last card', async () => {
    postReviewAnswer.mockResolvedValueOnce({
      wordId: 'a',
      due: '2026-02-01T00:00:00Z',
      advanced: true,
    });
    const { session } = await enterWithOneDue();
    await session.onReviewAnswered({ wordId: 'a', correct: true } as never);
    // Single due card exhausted → summary sub-state (question null), horizon adopted.
    expect(session.reviewQuestion.value).toBeNull();
    expect(session.reviewSummary.value.reviewed).toBe(1);
    expect(session.reviewSummary.value.advanced).toBe(1);
    expect(session.reviewSummary.value.nextDue).toBe('2026-02-01T00:00:00Z');
  });

  it('a read-only (advanced:false) answer counts as reviewed but does not move the horizon', async () => {
    postReviewAnswer.mockResolvedValueOnce({
      wordId: 'a',
      due: '2027-01-01T00:00:00Z', // unchanged far-future due — must NOT pollute nextDue
      advanced: false,
    });
    const { session } = await enterWithOneDue();
    await session.onReviewAnswered({ wordId: 'a', correct: true } as never);
    expect(session.reviewSummary.value.reviewed).toBe(1);
    expect(session.reviewSummary.value.advanced).toBe(0);
    expect(session.reviewSummary.value.nextDue).toBeNull();
  });
});

describe('onAnytimeReview', () => {
  const pool = [makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')];

  it('surfaces an error and stays when the anytime fetch fails', async () => {
    loadAnytimeReviews.mockRejectedValueOnce(new Error('boom'));
    const { deps, session } = setup({ pool });
    const outcome = await session.onAnytimeReview();
    expect(outcome).toBe('stayed');
    expect(deps.apiError.value).not.toBeNull();
  });

  it('builds a queue from all learned words and marks the session anytime', async () => {
    loadAnytimeReviews.mockResolvedValueOnce([
      { wordId: 'a', due: '2027-01-01T00:00:00Z' }, // not-due word still served
    ]);
    const { session } = setup({ pool });
    const outcome = await session.onAnytimeReview();
    expect(outcome).toBe('entered');
    expect(session.reviewMode.value).toBe('anytime');
    expect(session.reviewCaughtUp.value).toBe(false);
    expect(session.reviewQuestion.value).not.toBeNull();
  });

  it('resets the summary (incl. advanced) on entry and never calls the due endpoint', async () => {
    loadAnytimeReviews.mockResolvedValueOnce([
      { wordId: 'a', due: '2027-01-01T00:00:00Z' },
    ]);
    const { session } = setup({ pool });
    await session.onAnytimeReview();
    expect(session.reviewSummary.value).toEqual({
      reviewed: 0,
      advanced: 0,
      nextDue: null,
    });
    expect(loadDueReviews).not.toHaveBeenCalled();
  });
});
