export interface SentenceState {
  sentenceId: string;
  sentenceStreak: number;       // consecutive correct — exit gate (D7)
  lastBatchSeen: number;        // batch number — spacing gate (D7); -1 = never seen
  dailyCount: number;           // times served this session/day — daily cap (D7); deferred
  sessionWrongStreak: number;   // consecutive wrong this session — shelve gate (D10)
  active: boolean;              // false = shelved or graduated
}

export type SentenceRunState = Map<string, SentenceState>;

export function defaultSentenceState(sentenceId: string): SentenceState {
  return {
    sentenceId,
    sentenceStreak: 0,
    lastBatchSeen: -1, // -1 sentinel (never seen) ensures first appearance always passes spacing check
    dailyCount: 0,
    sessionWrongStreak: 0,
    active: true,
  };
}
