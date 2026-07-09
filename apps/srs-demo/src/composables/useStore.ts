import type {
  RunState,
  WordState,
  StreakThresholds,
  SentenceQuestion,
} from '@gll/srs-engine-v2';
import type {
  AnswerRequest,
  AnswerResponse,
  ApiResponse,
  GetStateResponse,
  WordStatePayload,
} from '@gll/api-contract';

/**
 * Local consuming shape for GET /api/config. The client owns how it reads the
 * server's config; it declares none of its own and imports no config type from
 * @gll/api-contract (none exists there — config is server-owned by design).
 * Categorized by who may change it: `user` (T1, eventually user-writable) and
 * `pedagogy` (T2 authored course design, read-only to the client). T3 system
 * internals are never served.
 */
export interface AppConfig {
  user: {
    masteryThreshold: number;
    streakThresholds: StreakThresholds;
    wordsPerBatch: number;
    maxRetryPerSession: number;
    maxRetryPerWord: number;
    sentenceDirections: SentenceQuestion['direction'][];
  };
  pedagogy: {
    sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
    sentenceGraduation: {
      sentenceCorrectStreakThreshold: number;
      sentenceWrongStreakThreshold: number;
    };
  };
}

function toWordState(p: WordStatePayload): WordState {
  return {
    wordId: p.wordId,
    seen: p.seen,
    correct: p.correct,
    mastery: p.mastery,
    correctStreak: p.correctStreak,
    wrongStreak: p.wrongStreak,
    lapses: p.lapses,
  } satisfies WordState;
}

function toRunState(words: WordStatePayload[]): RunState {
  return new Map(words.map((w) => [w.wordId, toWordState(w)]));
}

function toPayload(ws: WordState): WordStatePayload {
  return {
    wordId: ws.wordId,
    seen: ws.seen,
    correct: ws.correct,
    mastery: ws.mastery,
    correctStreak: ws.correctStreak,
    wrongStreak: ws.wrongStreak,
    lapses: ws.lapses,
  };
}

export async function loadRunState(): Promise<RunState> {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error(`GET /api/state failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<GetStateResponse>;
  if (!body.success) throw new Error(`GET /api/state error: ${body.error.message}`);
  return toRunState(body.data.words);
}

export async function saveWordState(ws: WordState): Promise<void> {
  const res = await fetch('/api/state/word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(ws)),
  });
  if (!res.ok) throw new Error(`POST /api/state/word failed: ${res.status}`);
}

/**
 * Server-authoritative persistence: POST a raw answer; the server runs the
 * transition and returns the canonical WordState. Throws a typed error on
 * failure so the caller can avoid overwriting local state with a lost answer.
 */
export async function postAnswer(req: AnswerRequest): Promise<WordState> {
  const res = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /api/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AnswerResponse>;
  if (!body.success) throw new Error(`POST /api/answer error: ${body.error.message}`);
  return toWordState(body.data.wordState);
}

export async function clearStore(): Promise<void> {
  const res = await fetch('/api/state', { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE /api/state failed: ${res.status}`);
}

/**
 * Fetch the server-authoritative config surface. The client holds no hardcoded
 * config of its own — it consumes the whole surface read-only at boot. Throws a
 * typed error on failure so the caller can fail closed rather than fall back to
 * built-in defaults (a fallback would be a second source of truth).
 */
export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`GET /api/config failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AppConfig>;
  if (!body.success) throw new Error(`GET /api/config error: ${body.error.message}`);
  return body.data;
}
