import type { QuizItem, AdaptiveSessionState, WordState } from '@gll/srs-engine-v2';

interface PersistedSession {
  deckId: string;
  sessionState: {
    active: QuizItem[];
    queue: QuizItem[];
    runState: [string, WordState][];
    recheckPending: string[];
    recheckReentered: string[];
    batchNum: number;
    sessionRetryCounts: [string, number][];
  };
}

const STORAGE_KEY = 'srs-demo-session';

export function saveSession(
  deckId: string,
  sessionState: AdaptiveSessionState,
): void {
  const data: PersistedSession = {
    deckId,
    sessionState: {
      active: sessionState.active,
      queue: sessionState.queue,
      runState: [...sessionState.runState.entries()],
      recheckPending: [...sessionState.recheckPending],
      recheckReentered: [...sessionState.recheckReentered],
      batchNum: sessionState.batchNum,
      sessionRetryCounts: [...sessionState.sessionRetryCounts.entries()],
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSession(): {
  deckId: string;
  sessionState: AdaptiveSessionState;
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PersistedSession;
    return {
      deckId: data.deckId,
      sessionState: {
        active: data.sessionState.active,
        queue: data.sessionState.queue,
        runState: new Map(data.sessionState.runState),
        recheckPending: new Set(data.sessionState.recheckPending),
        recheckReentered: new Set(data.sessionState.recheckReentered),
        batchNum: data.sessionState.batchNum,
        sessionRetryCounts: new Map(data.sessionState.sessionRetryCounts),
      },
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
