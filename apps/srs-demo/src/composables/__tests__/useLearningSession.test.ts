import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type {
  QuizItem,
  MCQQuestion,
  RunState,
  WordState,
} from '@gll/srs-engine-v2';
import type { AppDeckPayload } from '@gll/api-contract';
import { useLearningSession } from '../useLearningSession';
import { useDebugRecording } from '../useDebugRecording';
import type { ConfigType, Screen } from '../../types';

// The composable's I/O is these three modules — mock them so the tests exercise
// the state-machine orchestration (pools, batch handoff, persistence revert,
// shelving branch), not the HTTP/logging layers.
const loadRunState = vi.fn<() => Promise<RunState>>();
const postAnswer = vi.fn<(req: { wordId: string }) => Promise<WordState>>();
const clearStore = vi.fn<() => Promise<void>>();
vi.mock('../useStore', () => ({
  loadRunState: (...a: []) => loadRunState(...a),
  postAnswer: (...a: [{ wordId: string }]) => postAnswer(...a),
  clearStore: (...a: []) => clearStore(...a),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const loadShelvedWords = vi.fn<(...a: any[]) => Promise<unknown[]>>();
const applyShelving = vi.fn<(...a: any[]) => Promise<void>>();
const unshelveAll = vi.fn<(...a: any[]) => Promise<void>>();
const updateStagnationCounters = vi.fn<(...a: any[]) => Promise<void>>();
const getStagnantWords = vi.fn<(...a: any[]) => Promise<string[]>>();
const resetStagnationCounters = vi.fn<(...a: any[]) => Promise<void>>();
const getShelvingConfig =
  vi.fn<(...a: any[]) => Promise<{ stagnationBatchWindow: number; maxShelved: number }>>();
vi.mock('../useShelving', () => ({
  loadShelvedWords: (...a: any[]) => loadShelvedWords(...a),
  applyShelving: (...a: any[]) => applyShelving(...a),
  unshelveAll: (...a: any[]) => unshelveAll(...a),
  updateStagnationCounters: (...a: any[]) => updateStagnationCounters(...a),
  getStagnantWords: (...a: any[]) => getStagnantWords(...a),
  resetStagnationCounters: (...a: any[]) => resetStagnationCounters(...a),
  getShelvingConfig: (...a: any[]) => getShelvingConfig(...a),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

function makeWord(id: string): QuizItem {
  return {
    id,
    native: id,
    romanization: id,
    english: id,
    type: 'word',
    language: 'th',
  } as QuizItem;
}

const DECK_WORDS = [makeWord('w1'), makeWord('w2'), makeWord('w3'), makeWord('w4')];

function makeDeck(): AppDeckPayload {
  return {
    id: 'd1',
    topic: 'Test Deck',
    words: DECK_WORDS,
    lines: [], // no sentences — batch is pure word-MCQs
  } as AppDeckPayload;
}

const CONFIG = {
  wordsPerBatch: 2,
  maxRetryPerWord: 0,
  maxRetryPerSession: 5,
  masteryThreshold: 2,
  streakThresholds: {
    correctStreakThreshold: 2,
    wrongStreakThreshold: 2,
    maxMastery: 2,
  },
  sentenceScheduling: { minSeenForSentence: 999, sentenceBatchGap: 999 },
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: 2,
    sentenceWrongStreakThreshold: 2,
  },
  sentenceDirections: [],
} as unknown as ConfigType;

function makeWordState(mastery: number): WordState {
  return {
    wordId: 'x',
    seen: mastery,
    correct: mastery,
    mastery,
    correctStreak: mastery,
    wrongStreak: 0,
    lapses: 0,
  };
}

function setup(runState?: RunState) {
  const screen = ref<Screen>('home');
  const deps = {
    wordPool: ref<QuizItem[]>([...DECK_WORDS]),
    appDecks: ref<AppDeckPayload[]>([makeDeck()]),
    CONFIG: ref(CONFIG),
    configReady: ref(true),
    apiError: ref<string | null>(null),
    screen,
  };
  const session = useLearningSession(deps);
  if (runState) session.globalRunState.value = runState;
  return { deps, screen, session };
}

// The batch runs a couple of async awaits (answer replay + shelving pipeline);
// let all pending microtasks/macrotasks settle before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0));

// Answer every question in the current batch correctly, driving the state
// machine through onAnswered exactly as the QuizCard would. `isBatchDone` means
// "queue empty" (last card served, not yet answered), so we drive on the screen
// staying 'quiz' and flush after each answer to let the async batch-finish
// (answer replay + shelving) settle before the loop re-checks.
async function answerBatch(
  session: ReturnType<typeof setup>['session'],
  screen: ReturnType<typeof setup>['screen'],
) {
  let guard = 0;
  while (screen.value === 'quiz' && guard++ < 50) {
    const q = session.currentQuestion.value as MCQQuestion;
    session.onAnswered({ wordId: q.wordId, correct: true });
    await flush();
  }
}

const localStore: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(localStore)) delete localStore[k];
  vi.clearAllMocks();
  loadShelvedWords.mockResolvedValue([]);
  applyShelving.mockResolvedValue(undefined);
  unshelveAll.mockResolvedValue(undefined);
  updateStagnationCounters.mockResolvedValue(undefined);
  resetStagnationCounters.mockResolvedValue(undefined);
  clearStore.mockResolvedValue(undefined);
  getStagnantWords.mockResolvedValue([]);
  getShelvingConfig.mockResolvedValue({ stagnationBatchWindow: 3, maxShelved: 2 });
  postAnswer.mockImplementation(async ({ wordId }) => ({
    ...makeWordState(1),
    wordId,
  }));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  });
});

describe('initSession', () => {
  it('excludes already-mastered words from the session pool', async () => {
    const runState: RunState = new Map([['w1', { ...makeWordState(2), wordId: 'w1' }]]);
    const { session, screen } = setup(runState);
    await session.initSession('d1');
    const pooled = [
      ...session.activeItems.value.map((w) => w.id),
      ...session.queue.value.map((w) => w.id),
    ];
    expect(pooled).not.toContain('w1');
    expect(pooled).toEqual(expect.arrayContaining(['w2', 'w3', 'w4']));
    expect(screen.value).toBe('quiz');
    expect(session.currentQuestion.value).not.toBeNull();
  });

  it('excludes shelved words when resuming (isNewSession=false)', async () => {
    const { session } = setup();
    session.shelvedSet.value = new Set(['w2']);
    await session.initSession('d1', false);
    const pooled = [
      ...session.activeItems.value.map((w) => w.id),
      ...session.queue.value.map((w) => w.id),
    ];
    expect(pooled).not.toContain('w2');
  });

  it('fails closed when config is not ready', async () => {
    const { deps, session, screen } = setup();
    deps.configReady.value = false;
    await session.initSession('d1');
    expect(session.currentQuestion.value).toBeNull();
    expect(screen.value).toBe('home');
    expect(deps.apiError.value).not.toBeNull();
  });
});

describe('batch completion handoff', () => {
  it('persists each answer and transitions to results', async () => {
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);
    expect(screen.value).toBe('results');
    // 2 active words → 2 unique answers replayed through /api/answer.
    expect(postAnswer).toHaveBeenCalledTimes(2);
    expect(session.batchScore.value.total).toBe(2);
    expect(session.summary.value.length).toBe(2);
  });

  it('surfaces an error and reverts when an answer POST fails', async () => {
    postAnswer.mockRejectedValue(new Error('save failed'));
    const { session, deps, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);
    expect(deps.apiError.value).not.toBeNull();
    // Local runState must not advance past the DB — the failed words are dropped
    // (they had no prior confirmed value), so no phantom mastery is recorded.
    expect(session.globalRunState.value.has('w1')).toBe(false);
    expect(session.globalRunState.value.has('w2')).toBe(false);
  });
});

describe('shelving pipeline', () => {
  it('shelves a stagnant active word and records it in shelvedSet', async () => {
    getStagnantWords.mockResolvedValue(['w1']);
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);
    expect(applyShelving).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: 'd1',
        toShelve: expect.arrayContaining([{ wordId: 'w1', batchNum: 1 }]),
      }),
    );
    expect(session.shelvedSet.value.has('w1')).toBe(true);
  });
});

describe('recalculateCompletedDecks', () => {
  it('marks a deck completed once every word is mastered', () => {
    const runState: RunState = new Map(
      DECK_WORDS.map((w) => [w.id, { ...makeWordState(2), wordId: w.id }]),
    );
    const { session } = setup(runState);
    session.recalculateCompletedDecks();
    expect(session.completedDeckIds.value.has('d1')).toBe(true);
  });

  it('leaves a deck incomplete when a word is below mastery', () => {
    const runState: RunState = new Map(
      DECK_WORDS.map((w) => [w.id, { ...makeWordState(2), wordId: w.id }]),
    );
    runState.set('w1', { ...makeWordState(1), wordId: 'w1' });
    const { session } = setup(runState);
    session.recalculateCompletedDecks();
    expect(session.completedDeckIds.value.has('d1')).toBe(false);
  });
});

describe('onClear', () => {
  it('resets session state and returns to deck select', async () => {
    const { session, screen } = setup();
    await session.initSession('d1');
    await session.onClear();
    expect(clearStore).toHaveBeenCalled();
    expect(session.hasSavedSession.value).toBe(false);
    expect(session.deckId.value).toBeNull();
    expect(session.batchState.value).toBeNull();
    expect(session.globalRunState.value.size).toBe(0);
    expect(screen.value).toBe('select');
  });
});

describe('correlation-id stitch (EP40-ST05b)', () => {
  beforeEach(() => useDebugRecording().cancel());

  it('passes each answered word its served correlation id when recording', async () => {
    useDebugRecording().start('learning');
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);

    const cids = postAnswer.mock.calls.map((c) => (c as unknown[])[1] as string);
    expect(cids.length).toBeGreaterThanOrEqual(2);
    // Each answer carried a non-empty, distinct correlation id from the recorder.
    expect(cids.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    expect(new Set(cids).size).toBe(cids.length);
    // Every id posted was actually issued by the recorder, in the session's set.
    const issued = new Set(useDebugRecording().issuedIds());
    expect(cids.every((c) => issued.has(c))).toBe(true);
  });

  it('passes no correlation id when not recording (regression)', async () => {
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);

    const cids = postAnswer.mock.calls.map((c) => (c as unknown[])[1]);
    // Not recording ⇒ currentCorrelationId() is null ⇒ no header downstream.
    expect(cids.every((c) => c == null)).toBe(true);
  });
});

describe('appearance channel (EP40-ST06)', () => {
  beforeEach(() => useDebugRecording().cancel());

  it('records a correlated entry per orchestration decision', async () => {
    const rec = useDebugRecording();
    rec.start('learning');
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);

    const buf = rec.appearanceBuffer();
    const kinds = buf.map((e) => e.kind);
    // Initial pool selection + per-served-question serves are always present.
    expect(kinds).toContain('pool-selected');
    expect(kinds).toContain('question-served');
    // Every entry is well-formed: a kind, an ISO timestamp, a payload.
    for (const e of buf) {
      expect(typeof e.at).toBe('string');
      expect(e.data).toBeTypeOf('object');
    }
    // A served question carries the correlation id that was posted for its answer.
    const served = buf.filter((e) => e.kind === 'question-served');
    expect(served.length).toBeGreaterThanOrEqual(2);
    expect(served.every((e) => typeof e.correlationId === 'string')).toBe(true);
  });

  it('is read-only: recording does not change the batch outcome', async () => {
    useDebugRecording().start('learning');
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);
    // Orchestration reaches results and persists exactly the word answers, same as
    // the not-recording path — appearance capture is purely additive.
    expect(screen.value).toBe('results');
    expect(postAnswer).toHaveBeenCalledTimes(2);
  });

  it('produces no appearance events off the recording path (no cost)', async () => {
    const rec = useDebugRecording();
    const { session, screen } = setup();
    await session.initSession('d1');
    await answerBatch(session, screen);
    expect(rec.appearanceBuffer()).toEqual([]);
  });
});
