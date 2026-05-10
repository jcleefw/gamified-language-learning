# @gll/api-contract

Types-only package that defines the HTTP wire format between the GLL server and any client (frontend, CLI, tests). No runtime code — importing this package adds zero bytes to a bundle.

## Purpose

Keeps the server and client in sync on exact request/response shapes, and standardises the naming conventions used over HTTP (snake_case, readable enum values) independently of internal engine conventions.

**Engine-internal → wire-format mappings:**

| Internal | Wire |
|---|---|
| `'mc'` | `'multiple_choice'` |
| `'wordBlock'` | `'word_block'` |
| `'srsM2_review'` | `'anki_review'` |

## Endpoints

### `POST /srs/batch`

Request: `GetBatchRequest` — `{ deckId, size? }`  
Response: `ApiResponse<BatchPayload>` — batch of quiz questions

### `POST /srs/answers`

Request: `SubmitAnswersRequest` — `{ batchId, answers: QuizAnswer[] }`  
Response: `ApiResponse<SubmitAnswersResponse>` — per-word results with correct/submitted keys and updated mastery state

### `POST /srs/seed`

Response: `ApiResponse<SeedPayload>` — seeded deck info

## Response envelope

All endpoints return `ApiResponse<T>`:

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

Error codes are defined in `ErrorCode` — notably `INSUFFICIENT_WORD_POOL` for when the deck doesn't have enough words to compose a batch.

## Deferred

- `auth.ts` — Stage 5
- `curation.ts` — Stage 7
