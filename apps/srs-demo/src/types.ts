import type { SessionConfig, SentenceQuestion } from '@gll/srs-engine-v2';

export type Screen =
  | 'home'
  | 'select'
  | 'quiz'
  | 'results'
  | 'overview'
  | 'review-hub'
  | 'review'
  | 'curate'
  | 'mark';

export type ConfigType = SessionConfig & {
  maxRetryPerWord: number;
  sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  };
  sentenceDirections: SentenceQuestion['direction'][];
};
