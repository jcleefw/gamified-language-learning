import type {
  RunState,
  WordState,
  StreakThresholds,
  SentenceQuestion,
} from '@gll/srs-engine-v2';
import type {
  AnswerRequest,
  AnswerResponse,
  AnytimeReviewsResponse,
  ApiResponse,
  DueReviewItem,
  DueReviewsResponse,
  GetStateResponse,
  ReviewAnswerRequest,
  ReviewAnswerResponse,
  WordStatePayload,
} from '@gll/api-contract';

/**
 * Local consuming shape for GET /api/user/config. The client owns how it reads the
 * server's config; it declares none of its own and imports no config type from
 * @gll/api-contract (none exists there — config is server-owned by design).
 * Categorized by who may change it: `user` (T1, resolved defaults ← overrides,
 * writable via PUT /api/user/config) and `system` (T3 fixed engine mechanics, served
 * read-only because the client applies them but never writes them).
 */
export interface AppConfig {
  user: {
    difficultyPreset: string;
    streakThresholds: StreakThresholds;
    wordsPerBatch: number;
    sentenceDirections: SentenceQuestion['direction'][];
  };
  system: {
    masteryThreshold: number;
    maxRetryPerSession: number;
    maxRetryPerWord: number;
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

/**
 * Pool-global due review cards, most-overdue-first (server-ordered). Throws a
 * typed error on failure so the caller can surface it rather than render a false
 * "caught up" empty session.
 */
export async function loadDueReviews(): Promise<DueReviewItem[]> {
  const res = await fetch('/api/reviews');
  if (!res.ok) throw new Error(`GET /api/reviews failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
  if (!body.success) throw new Error(`GET /api/reviews error: ${body.error.message}`);
  return body.data.reviews;
}

/**
 * All learned words (due and not-due), server-ordered and bounded to ≤50 — the
 * Practice-Anytime batch. Same wire shape as the due list. The server owns the
 * ordering (most-overdue-first, not-due tail least-recently-practised) and the
 * bound; the client renders whatever order comes back. Throws a typed error on
 * failure so the caller can surface it rather than render an empty session.
 */
export async function loadAnytimeReviews(): Promise<DueReviewItem[]> {
  const res = await fetch('/api/reviews/anytime');
  if (!res.ok) throw new Error(`GET /api/reviews/anytime failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
  if (!body.success)
    throw new Error(`GET /api/reviews/anytime error: ${body.error.message}`);
  return body.data.reviews;
}

/**
 * Post a review answer; the server maps it to an FSRS rating, advances the
 * schedule, and returns the new `due`. Throws a typed error on failure so the
 * caller can avoid advancing the queue past a lost answer (write-on-answer:
 * DS01 leaves the card unchanged on error). The client computes no rating or
 * interval — it adopts whatever schedule comes back.
 */
export async function postReviewAnswer(
  req: ReviewAnswerRequest,
): Promise<ReviewAnswerResponse> {
  const res = await fetch('/api/reviews/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /api/reviews/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
  if (!body.success)
    throw new Error(`POST /api/reviews/answer error: ${body.error.message}`);
  return body.data;
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
  const res = await fetch('/api/user/config');
  if (!res.ok) throw new Error(`GET /api/user/config failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AppConfig>;
  if (!body.success) throw new Error(`GET /api/user/config error: ${body.error.message}`);
  return body.data;
}
