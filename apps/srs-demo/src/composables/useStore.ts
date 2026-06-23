import type { RunState, WordState } from '@gll/srs-engine-v2';
import type { ApiResponse, GetStateResponse, WordStatePayload } from '@gll/api-contract';

function toRunState(words: WordStatePayload[]): RunState {
  return new Map(
    words.map((w) => [
      w.wordId,
      {
        wordId: w.wordId,
        seen: w.seen,
        correct: w.correct,
        mastery: w.mastery,
        correctStreak: w.correctStreak,
        wrongStreak: w.wrongStreak,
        lapses: w.lapses,
      } satisfies WordState,
    ]),
  );
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

export async function clearStore(): Promise<void> {
  const res = await fetch('/api/state', { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE /api/state failed: ${res.status}`);
}
