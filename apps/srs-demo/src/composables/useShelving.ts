import type {
  ApiResponse,
  GetShelvedWordsResponse,
  GetStagnantWordsResponse,
  ShelvedWordPayload,
  ApplyShelvingRequest,
  UnshelveAllRequest,
  UnshelveWordRequest,
  UpdateStagnationCountersRequest,
  ResetStagnationCountersRequest,
  ResetStagnationCountersForWordsRequest,
} from '@gll/api-contract';
import { DEFAULT_SHELVING_CONFIG, type ShelvingConfig } from '@gll/srs-shelving';
import { getTraceSession } from './useTraceSession';

export async function loadShelvedWords(deckId: string): Promise<ShelvedWordPayload[]> {
  const res = await fetch(`/api/shelving?deckId=${encodeURIComponent(deckId)}`);
  if (!res.ok) throw new Error(`GET /api/shelving failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<GetShelvedWordsResponse>;
  if (!body.success) throw new Error(`GET /api/shelving error: ${body.error.message}`);
  return body.data;
}

export async function applyShelving(request: ApplyShelvingRequest): Promise<void> {
  // Appearance channel (EP40-ST04) — the shelve decision (why a word left the pool).
  // Not keyed to one question; fail-open (no-op when no trace is active).
  getTraceSession().record({
    correlationId: null,
    channel: 'appearance',
    data: { kind: 'shelving-decision', detail: { action: 'shelve', request } },
  });
  const res = await fetch('/api/shelving/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/shelving/apply failed: ${res.status} ${text}`);
  }
  const body = await res.json() as { success: boolean };
  if (!body.success) throw new Error('POST /api/shelving/apply returned success:false');
}

export async function unshelveAll(request: UnshelveAllRequest): Promise<void> {
  const res = await fetch('/api/shelving/unshelve-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/shelving/unshelve-all failed: ${res.status}`);
}

export async function updateStagnationCounters(request: UpdateStagnationCountersRequest): Promise<void> {
  const res = await fetch('/api/stagnation/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/stagnation/update failed: ${res.status}`);
}

export async function getStagnantWords(deckId: string, threshold: number): Promise<string[]> {
  const res = await fetch(
    `/api/stagnation/stagnant?deckId=${encodeURIComponent(deckId)}&threshold=${String(threshold)}`,
  );
  if (!res.ok) throw new Error(`GET /api/stagnation/stagnant failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<GetStagnantWordsResponse>;
  if (!body.success) throw new Error(`GET /api/stagnation/stagnant error: ${body.error.message}`);
  return body.data.stagnantWordIds;
}

export async function resetStagnationCounters(request: ResetStagnationCountersRequest): Promise<void> {
  const res = await fetch('/api/stagnation/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/stagnation/reset failed: ${res.status}`);
}

export async function unshelveWord(request: UnshelveWordRequest): Promise<void> {
  getTraceSession().record({
    correlationId: null,
    channel: 'appearance',
    data: { kind: 'shelving-decision', detail: { action: 'unshelve', request } },
  });
  const res = await fetch('/api/shelving/unshelve-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/shelving/unshelve-word failed: ${res.status}`);
}

export async function resetStagnationCountersForWords(request: ResetStagnationCountersForWordsRequest): Promise<void> {
  const res = await fetch('/api/stagnation/reset-words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/stagnation/reset-words failed: ${res.status}`);
}

export async function getShelvingConfig(): Promise<ShelvingConfig> {
  try {
    const res = await fetch('/api/test/config/shelving');
    if (!res.ok) return DEFAULT_SHELVING_CONFIG;
    const body = (await res.json()) as ApiResponse<ShelvingConfig>;
    if (!body.success) return DEFAULT_SHELVING_CONFIG;
    return body.data;
  } catch {
    return DEFAULT_SHELVING_CONFIG;
  }
}
