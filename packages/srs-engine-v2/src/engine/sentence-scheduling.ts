import type { SentenceContext } from '../types/sentence.js';
import type { SentenceRunState } from '../types/sentence-state.js';
import type { SentenceQuizResult } from '../types/quiz.js';
import type { RunState } from '../types/word-state.js';
import type { QuizItem } from './compose-word-batch.js';
import type { SentenceTile } from '../types/quiz.js';
import { defaultSentenceState } from '../types/sentence-state.js';

export function resolveEligibleContexts(
  corpus: SentenceContext[],
  runState: RunState,
  allPool: QuizItem[],
  sentenceRunState: SentenceRunState,
  batchNum: number,
  config: { minSeenForSentence: number; sentenceBatchGap: number },
): { ctx: SentenceContext; tiles: SentenceTile[] }[] {
  const poolMap = new Map(allPool.map((w) => [w.id, w]));

  return corpus
    .filter((ctx) => {
      const wordSeenPass = ctx.wordOrder.every(
        (id) => (runState.get(id)?.seen ?? 0) >= config.minSeenForSentence,
      );
      if (!wordSeenPass) return false;

      const sState =
        sentenceRunState.get(ctx.sentenceId) ?? defaultSentenceState(ctx.sentenceId);

      if (!sState.active) return false;

      if (sState.lastBatchSeen !== -1) {
        const gap = batchNum - sState.lastBatchSeen;
        if (gap <= config.sentenceBatchGap) return false;
      }

      return true;
    })
    .map((ctx) => {
      const tiles: SentenceTile[] = ctx.wordOrder.flatMap((id) => {
        const item = poolMap.get(id);
        if (!item) return [];
        return [{ wordId: item.id, native: item.native, romanization: item.romanization, english: item.english }];
      });
      return { ctx, tiles };
    })
    .filter(({ ctx: c, tiles }) => tiles.length === c.wordOrder.length);
}

export function updateSentenceRunState(
  sentenceRunState: SentenceRunState,
  results: SentenceQuizResult[],
  batchNum: number,
  config: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  },
): SentenceRunState {
  for (const r of results) {
    const existing =
      sentenceRunState.get(r.sentenceId) ?? defaultSentenceState(r.sentenceId);

    if (r.correct) {
      existing.sentenceStreak += 1;
      existing.sessionWrongStreak = 0;
      if (existing.sentenceStreak >= config.sentenceCorrectStreakThreshold) {
        existing.active = false;
      }
    } else {
      existing.sessionWrongStreak += 1;
      existing.sentenceStreak = 0;
      if (existing.sessionWrongStreak >= config.sentenceWrongStreakThreshold) {
        existing.active = false;
      }
    }
    existing.lastBatchSeen = batchNum;
    sentenceRunState.set(r.sentenceId, existing);
  }
  return sentenceRunState;
}
