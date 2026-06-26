import type {
  ApiResponse,
  GetShelvedWordsResponse,
  GetStagnantWordsResponse,
  ShelvedWordPayload,
  ApplyShelvingRequest,
  UnshelveAllRequest,
  UpdateStagnationCountersRequest,
  ResetStagnationCountersRequest,
} from '@gll/api-contract';

export async function loadShelvedWords(deckId: string): Promise<ShelvedWordPayload[]> {
  const res = await fetch(`/api/shelving?deckId=${encodeURIComponent(deckId)}`);
  if (!res.ok) throw new Error(`GET /api/shelving failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<GetShelvedWordsResponse>;
  if (!body.success) throw new Error(`GET /api/shelving error: ${body.error.message}`);
  return body.data;
}

export async function applyShelving(request: ApplyShelvingRequest): Promise<void> {
  const res = await fetch('/api/shelving/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`POST /api/shelving/apply failed: ${res.status}`);
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
