import type { WordState, RunState } from '@gll/srs-engine-v2';
import type { QuizItem } from '@gll/srs-engine-v2';

interface PersistedSession {
  deckId: string;
  activeItems: QuizItem[];
  queue: QuizItem[];
  runState: [string, WordState][];
  recheckPending: string[];
  recheckReentered: string[];
}

const STORAGE_KEY = 'srs-demo-session';

export function saveSession(
  deckId: string,
  activeItems: QuizItem[],
  queue: QuizItem[],
  runState: RunState,
  recheckPending: Set<string>,
  recheckReentered: Set<string>,
): void {
  const data: PersistedSession = {
    deckId,
    activeItems,
    queue,
    runState: [...runState.entries()],
    recheckPending: [...recheckPending],
    recheckReentered: [...recheckReentered],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSession(): {
  deckId: string;
  activeItems: QuizItem[];
  queue: QuizItem[];
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PersistedSession;
    return {
      deckId: data.deckId,
      activeItems: data.activeItems,
      queue: data.queue,
      runState: new Map(data.runState),
      recheckPending: new Set(data.recheckPending),
      recheckReentered: new Set(data.recheckReentered),
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
