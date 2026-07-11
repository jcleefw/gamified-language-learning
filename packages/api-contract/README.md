# @gll/api-contract

Types-only package defining the HTTP wire format between the GLL server (`@gll/server`) and any client (Vue frontend, CLI, tests). No runtime code — importing it adds zero bytes to a bundle. Keeps server and client in sync on exact request/response shapes.

## Public API

```ts
import type {
  ApiResponse, ApiError,
  AnswerRequest, AnswerResponse,
  GetStateResponse, WordStatePayload,
  GetDecksResponse, AppDeckPayload,
} from '@gll/api-contract';
import { ErrorCode, DeckDocSchema } from '@gll/api-contract';
```

Modules: `errors` (envelope + codes), `srs` (state/answer/shelving DTOs), `content` (decks/curriculum, incl. zod schemas). `auth` (Stage 5) and `curation` (Stage 7) are deferred stubs.

## Response envelope

Every endpoint returns `ApiResponse<T>`:

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

`ErrorCode`: `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_ERROR`, `UNAUTHORIZED`, `UNPROCESSABLE_ENTITY`.

## Endpoints

All are served under `/api` by `@gll/server`.

| Method + path | Request | Response data |
|---|---|---|
| `GET /api/state` | — | `GetStateResponse` |
| `POST /api/state/word` | `UpsertWordStateRequest` | `WordStatePayload` |
| `POST /api/answer` | `AnswerRequest` | `AnswerResponse` |
| `GET /api/decks` | — | `GetDecksResponse` |
| `GET /api/shelving` | — | `GetShelvedWordsResponse` |
| `POST /api/shelving/apply` | `ApplyShelvingRequest` | — |
| `POST /api/shelving/unshelve-all` | `UnshelveAllRequest` | — |
| `POST /api/shelving/unshelve-word` | `UnshelveWordRequest` | — |
| `POST /api/stagnation/update` | `UpdateStagnationCountersRequest` | — |
| `GET /api/stagnation/stagnant` | — | `GetStagnantWordsResponse` |
| `POST /api/stagnation/reset` | `ResetStagnationCountersRequest` | — |
| `POST /api/stagnation/reset-words` | `ResetStagnationCountersForWordsRequest` | — |

`AnswerRequest` — `{ wordId, correct, latencyMs, recheck? }`: the raw answer the server derives authoritative state from. `AnswerResponse` — `{ wordState, graduated }`.

`POST /api/debug-logs` and the `POST /api/test/*` config/seed routes exist for diagnostics and tests; `GET /health` is served at the root (not under `/api`).

## Compile-time guards

`type-tests/` holds `tsc`-only assertions that the DTOs keep their shape. They never run — see the `typecheck` script (`tsconfig.typecheck.json`).
