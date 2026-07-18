import type {
  RunState,
  WordState,
  StreakThresholds,
  SentenceQuestion,
} from '@gll/srs-engine/learn';
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
    sentenceScheduling: {
      minSeenForSentence: number;
      sentenceBatchGap: number;
    };
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
  if (!body.success)
    throw new Error(`GET /api/state error: ${body.error.message}`);
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
 *
 * When a debug recording is active, `correlationId` stitches this answer's
 * authoritative transition (durable in `answer_events`) to the question that
 * was served (EP40-ST05). Off the recording path it is falsy and no header is
 * sent — the request is byte-identical to before.
 */
export async function postAnswer(
  req: AnswerRequest,
  correlationId?: string | null,
): Promise<WordState> {
  const res = await fetch('/api/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /api/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AnswerResponse>;
  if (!body.success)
    throw new Error(`POST /api/answer error: ${body.error.message}`);
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
  if (!body.success)
    throw new Error(`GET /api/reviews error: ${body.error.message}`);
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
  if (!res.ok)
    throw new Error(`GET /api/reviews/anytime failed: ${res.status}`);
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
  if (!res.ok)
    throw new Error(`POST /api/reviews/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
  if (!body.success)
    throw new Error(`POST /api/reviews/answer error: ${body.error.message}`);
  return body.data;
}

/**
 * Curator-only (EP42-DS02, ST09): upload a deck's conversation audio via the
 * gated server endpoint, which stores the file and inserts a current `audio` row
 * in one request. Resolves the server-owned key on success; throws the server's
 * error message on failure so the page can surface it rather than fail silently.
 */
export async function uploadDeckAudio(
  deckId: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append('audio', file);
  const res = await fetch(`/api/curation/decks/${deckId}/audio`, {
    method: 'POST',
    body: form,
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<{
    audioKey: string;
  }> | null;
  if (!res.ok || !body || !body.success) {
    throw new Error(
      body && !body.success
        ? body.error.message
        : `POST /api/curation/decks/${deckId}/audio failed: ${res.status}`,
    );
  }
  return body.data.audioKey;
}

/**
 * Curator-only (EP43-DS02, ST05): commit a deck's WebVTT timing via the gated
 * server-write endpoint, which validates the audio-sha256 stamp and writes the
 * `audio.vtt` DB column + the durable bucket `.vtt`. Throws the server error
 * (e.g. 409 stamp mismatch, 404 no current audio) so the tool can surface it.
 */
export async function commitDeckVtt(
  deckId: string,
  vtt: string,
): Promise<void> {
  const res = await fetch(`/api/curation/decks/${deckId}/audio/vtt`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/vtt' },
    body: vtt,
  });
  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => null)) as ApiResponse<unknown> | null;
    throw new Error(
      body && !body.success
        ? body.error.message
        : `PUT /api/curation/decks/${deckId}/audio/vtt failed: ${res.status}`,
    );
  }
}

/** Curator-only: fetch a deck's current committed VTT (for fine-tuning), or null. */
export async function fetchDeckVtt(deckId: string): Promise<string | null> {
  const res = await fetch(`/api/curation/decks/${deckId}/audio/vtt`);
  if (!res.ok) return null;
  return res.text();
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
  if (!body.success)
    throw new Error(`GET /api/user/config error: ${body.error.message}`);
  return body.data;
}
