import { describe, it, expect } from 'vitest';
import {
  resolveEligibleContexts,
  updateSentenceRunState,
  defaultSentenceState,
  type SentenceRunState,
  type RunState,
  type QuizItem,
  type SentenceContext,
} from '../../index.js';

const testConfig = {
  minSeenForSentence: 2,
  sentenceBatchGap: 1,
  sentenceCorrectStreakThreshold: 3,
  sentenceWrongStreakThreshold: 3,
};

const testCorpus: SentenceContext[] = [
  {
    sentenceId: 'sent::001',
    englishSentence: "I'm hungry, let's go eat something",
    wordOrder: ['th::หิว', 'th::แล้ว', 'th::ไป', 'th::กิน', 'th::อะไร', 'th::กัน'],
  },
  {
    sentenceId: 'sent::002',
    englishSentence: "It's really hot today",
    wordOrder: ['th::วันนี้', 'th::ร้อน', 'th::มาก', 'th::เลย'],
  },
];

describe('Sentence Spacing and Eligibility Gates', () => {
  const wordIds = [
    'th::หิว',
    'th::แล้ว',
    'th::ไป',
    'th::กิน',
    'th::อะไร',
    'th::กัน',
    'th::วันนี้',
    'th::ร้อน',
    'th::มาก',
    'th::เลย',
  ];

  const runState: RunState = new Map();
  for (const id of wordIds) {
    runState.set(id, {
      wordId: id,
      seen: 2, // passes the minSeenForSentence check which is 2
      correct: 2,
      mastery: 0,
      correctStreak: 0,
      wrongStreak: 0,
    });
  }

  const allPool: QuizItem[] = wordIds.map((id) => ({
    id,
    native: id.replace('th::', ''),
    romanization: '',
    english: '',
    type: 'word',
    language: 'th',
  }));

  it('allows sentence to pass spacing check if never seen before (lastBatchSeen = -1)', () => {
    const sentenceRunState: SentenceRunState = new Map();
    // Default/fresh sentence state starts with lastBatchSeen = -1
    const s1 = defaultSentenceState('sent::001');
    const s2 = defaultSentenceState('sent::002');
    sentenceRunState.set('sent::001', s1);
    sentenceRunState.set('sent::002', s2);

    const eligible = resolveEligibleContexts(testCorpus, runState, allPool, sentenceRunState, 1, testConfig);
    const eligibleIds = eligible.map((e) => e.ctx.sentenceId);

    expect(eligibleIds).toContain('sent::001');
    expect(eligibleIds).toContain('sent::002');
  });

  it('excludes sentence from consecutive batch (back-to-back spacing failure)', () => {
    const sentenceRunState: SentenceRunState = new Map();
    const s1 = defaultSentenceState('sent::001');
    s1.lastBatchSeen = 1; // seen in batch 1
    const s2 = defaultSentenceState('sent::002'); // never seen

    sentenceRunState.set('sent::001', s1);
    sentenceRunState.set('sent::002', s2);

    // Evaluating for batch 2 (gap = 2 - 1 = 1 <= sentenceBatchGap 1)
    const eligible = resolveEligibleContexts(testCorpus, runState, allPool, sentenceRunState, 2, testConfig);
    const eligibleIds = eligible.map((e) => e.ctx.sentenceId);

    expect(eligibleIds).not.toContain('sent::001');
    expect(eligibleIds).toContain('sent::002');
  });

  it('allows sentence to reappear after gap threshold is satisfied (spacing success)', () => {
    const sentenceRunState: SentenceRunState = new Map();
    const s1 = defaultSentenceState('sent::001');
    s1.lastBatchSeen = 1; // seen in batch 1
    const s2 = defaultSentenceState('sent::002');

    sentenceRunState.set('sent::001', s1);
    sentenceRunState.set('sent::002', s2);

    // Evaluating for batch 3 (gap = 3 - 1 = 2 > sentenceBatchGap 1)
    const eligible = resolveEligibleContexts(testCorpus, runState, allPool, sentenceRunState, 3, testConfig);
    const eligibleIds = eligible.map((e) => e.ctx.sentenceId);

    expect(eligibleIds).toContain('sent::001');
    expect(eligibleIds).toContain('sent::002');
  });

  it('excludes inactive sentences regardless of gap spacing', () => {
    const sentenceRunState: SentenceRunState = new Map();
    const s1 = defaultSentenceState('sent::001');
    s1.active = false; // graduated/shelved
    s1.lastBatchSeen = 1;
    const s2 = defaultSentenceState('sent::002');

    sentenceRunState.set('sent::001', s1);
    sentenceRunState.set('sent::002', s2);

    // Evaluating for batch 4
    const eligible = resolveEligibleContexts(testCorpus, runState, allPool, sentenceRunState, 4, testConfig);
    const eligibleIds = eligible.map((e) => e.ctx.sentenceId);

    expect(eligibleIds).not.toContain('sent::001');
    expect(eligibleIds).toContain('sent::002');
  });

  describe('Streak tracking, graduation, and shelving (ST10)', () => {

    it('increments correct streak and resets wrong streak on correct answer', () => {
      const sentenceRunState: SentenceRunState = new Map();
      const s = defaultSentenceState('sent::001');
      s.sessionWrongStreak = 2;
      sentenceRunState.set('sent::001', s);

      const results = [{ sentenceId: 'sent::001', correct: true }];
      updateSentenceRunState(sentenceRunState, results, 1, testConfig);

      const updated = sentenceRunState.get('sent::001')!;
      expect(updated.sentenceStreak).toBe(1);
      expect(updated.sessionWrongStreak).toBe(0);
      expect(updated.active).toBe(true);
      expect(updated.lastBatchSeen).toBe(1);
    });

    it('increments wrong streak and resets correct streak on wrong answer', () => {
      const sentenceRunState: SentenceRunState = new Map();
      const s = defaultSentenceState('sent::001');
      s.sentenceStreak = 2;
      sentenceRunState.set('sent::001', s);

      const results = [{ sentenceId: 'sent::001', correct: false }];
      updateSentenceRunState(sentenceRunState, results, 1, testConfig);

      const updated = sentenceRunState.get('sent::001')!;
      expect(updated.sessionWrongStreak).toBe(1);
      expect(updated.sentenceStreak).toBe(0);
      expect(updated.active).toBe(true);
      expect(updated.lastBatchSeen).toBe(1);
    });

    it('graduates sentence (active = false) when correct streak threshold is reached', () => {
      const sentenceRunState: SentenceRunState = new Map();
      const s = defaultSentenceState('sent::001');
      s.sentenceStreak = 2;
      sentenceRunState.set('sent::001', s);

      // 3rd correct answer hits threshold (3)
      const results = [{ sentenceId: 'sent::001', correct: true }];
      updateSentenceRunState(sentenceRunState, results, 1, testConfig);

      const updated = sentenceRunState.get('sent::001')!;
      expect(updated.sentenceStreak).toBe(3);
      expect(updated.active).toBe(false);
    });

    it('shelves sentence (active = false) when wrong streak threshold is reached', () => {
      const sentenceRunState: SentenceRunState = new Map();
      const s = defaultSentenceState('sent::001');
      s.sessionWrongStreak = 2;
      sentenceRunState.set('sent::001', s);

      // 3rd wrong answer hits threshold (3)
      const results = [{ sentenceId: 'sent::001', correct: false }];
      updateSentenceRunState(sentenceRunState, results, 1, testConfig);

      const updated = sentenceRunState.get('sent::001')!;
      expect(updated.sessionWrongStreak).toBe(3);
      expect(updated.active).toBe(false);
    });

    it('excludes graduated/shelved sentences from resolveEligibleContexts in subsequent batches', () => {
      const sentenceRunState: SentenceRunState = new Map();
      const s1 = defaultSentenceState('sent::001');
      s1.sentenceStreak = 2;
      const s2 = defaultSentenceState('sent::002');
      s2.sessionWrongStreak = 2;

      sentenceRunState.set('sent::001', s1);
      sentenceRunState.set('sent::002', s2);

      // s1 gets correct (threshold met), s2 gets wrong (threshold met)
      const results = [
        { sentenceId: 'sent::001', correct: true },
        { sentenceId: 'sent::002', correct: false },
      ];
      updateSentenceRunState(sentenceRunState, results, 1, testConfig);

      // Both should now be active = false
      expect(sentenceRunState.get('sent::001')!.active).toBe(false);
      expect(sentenceRunState.get('sent::002')!.active).toBe(false);

      // Subsequent resolveEligibleContexts call on batch 2 should exclude both
      const eligible = resolveEligibleContexts(testCorpus, runState, allPool, sentenceRunState, 2, testConfig);
      const eligibleIds = eligible.map((e) => e.ctx.sentenceId);

      expect(eligibleIds).not.toContain('sent::001');
      expect(eligibleIds).not.toContain('sent::002');
    });
  });
});
