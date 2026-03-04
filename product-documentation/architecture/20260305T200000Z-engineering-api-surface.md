# ADR: API Surface Design

**Status:** Accepted

**Date:** 2026-03-05

**Deciders:** Solo founder

---

## Context

The Hono backend ADR (`20260303T195134Z-engineering-headless-hono-backend.md`) established Hono on Cloudflare Workers as the sole orchestration layer. It described responsibilities but left the API surface undefined — no route structure, response shapes, auth convention, or error contract.

Without a locked surface, Hono and Nuxt agents will make incompatible assumptions during Stage 2 build. This ADR locks the structural conventions that all routes must follow, and defines the known Stage 2 SRS endpoints as the first concrete surface.

Engine-internal types (`WordState`, `Batch`, `ParsedConversation`, etc.) are owned by their respective packages and never cross the HTTP boundary. The API surface is a separate mapping layer — HTTP wire format types that Hono produces and Nuxt consumes.

---

## Decision

### 1. Route Namespace

Flat — no version prefix in the path.

```
/api/{domain}/{resource}
```

| Domain | Prefix | Stage |
|---|---|---|
| SRS learning | `/api/srs/` | Stage 2 |
| Auth | `/api/auth/` | Stage 5 |
| Curation | `/api/curation/` | Stage 7 |
| Admin | `/api/admin/` | Stage 10 |

No `/v1/` or `/v2/` in paths. If breaking changes are needed post-MVP, versioning strategy will be addressed in a future ADR.

---

### 2. Response Envelope

Every successful response is wrapped:

```ts
// Success
{
  data: T           // payload, typed per route
  meta?: {
    page?: number
    total?: number
    [key: string]: unknown
  }
}
```

`meta` is optional. Included only when the route has pagination or supplementary context. Single-resource responses omit `meta`.

---

### 3. Error Envelope

Every error response uses a consistent shape regardless of HTTP status:

```ts
{
  error: {
    code: string       // machine-readable, UPPER_SNAKE_CASE — e.g. "NOT_FOUND", "VALIDATION_ERROR"
    message: string    // human-readable description
    details?: unknown  // optional — field-level errors, engine validation output, extra context
  }
}
```

HTTP status carries the error category:

| Status | Meaning |
|---|---|
| `400` | Invalid request — bad input, failed validation |
| `401` | Unauthenticated — missing or invalid token |
| `403` | Forbidden — authenticated but not authorised |
| `404` | Resource not found |
| `409` | Conflict — state violation (e.g. invalid lifecycle transition) |
| `422` | Unprocessable — input valid but business rule rejected |
| `500` | Internal server error |

---

### 4. Auth Header Convention

Bearer JWT via `Authorization` header:

```
Authorization: Bearer <token>
```

- Stage 2–4 routes are unauthenticated — auth middleware is wired but no-ops (passes through)
- Stage 5 adds Google OAuth + JWT issuance; middleware begins enforcing the header
- Token format and claims are deferred to the Auth ADR (Stage 5)

Protected routes must declare their auth requirement in route registration so it is visible during code review and testing.

---

### 5. Shared Types — `packages/api-contract`

Request and response TypeScript types are co-located in a dedicated package consumed by both Hono and Nuxt:

```
packages/api-contract/
├── src/
│   ├── srs.ts          // SRS route request/response types
│   ├── auth.ts         // Auth types (placeholder until Stage 5)
│   ├── curation.ts     // Curation types (placeholder until Stage 7)
│   ├── errors.ts       // ApiError, ErrorCode enum
│   └── index.ts        // Re-exports
├── package.json        // No runtime dependencies — types only
└── tsconfig.json
```

**Rules:**
- No runtime code — types, interfaces, and enums only
- Engine types (`WordState`, `Batch`, `ParsedConversation`, etc.) are **never** imported or re-exported here — they are internal to Hono
- Hono maps engine output → API response shape before returning; the API contract reflects the wire format, not the engine shape
- Both `apps/api` and `apps/web` declare `@repo/api-contract` as a dev dependency

---

## Stage 2 SRS Endpoints

These are the only concrete endpoints defined now. All others are placeholders until their stage begins.

### `POST /api/srs/batch`

Request a quiz batch for a user + deck.

```ts
// Request body
interface GetBatchRequest {
  deckId: string
}

// Response: ApiResponse<BatchPayload>
interface BatchPayload {
  batchId: string
  deckId: string
  questions: QuizQuestion[]
}

interface QuizQuestion {
  wordId: string
  questionType: 'multiple_choice' | 'word_block' | 'audio'
  targetText: string
  options?: string[]          // multiple_choice only
  audioUrl?: string           // audio type only
}
```

Stage 2: `deckId` resolves against in-memory seed data. Stage 3+: resolves against D1.

---

### `POST /api/srs/answers`

Submit completed batch answers, receive updated mastery summary.

```ts
// Request body
interface SubmitAnswersRequest {
  batchId: string
  answers: QuizAnswer[]
}

interface QuizAnswer {
  wordId: string
  correct: boolean
}

// Response: ApiResponse<AnswerResultPayload>
interface AnswerResultPayload {
  processed: number
  updatedWords: WordMasterySummary[]
}

interface WordMasterySummary {
  wordId: string
  masteryCount: number
  phase: 'learning' | 'anki_review'
}
```

Stage 2: mastery state held in memory (no persistence). Stage 3+: written to D1.

---

## Placeholder Routes (Shape Deferred)

| Route | Stage | Notes |
|---|---|---|
| `POST /api/auth/google` | 5 | Google OAuth callback |
| `POST /api/auth/refresh` | 5 | Token refresh |
| `DELETE /api/auth/session` | 5 | Sign out |
| `GET /api/curation/decks` | 7 | List published decks |
| `POST /api/curation/conversations` | 7 | Generate conversation |
| `GET /api/admin/users` | 10 | Admin user list |

---

## Rationale

**Flat namespace over versioned:** This is a solo MVP with a single client. Versioning adds path noise with no current benefit. If a breaking change is needed, the decision can be made at that point with full context.

**Wrapped response over bare:** Consistent envelope allows Nuxt composables to destructure `data` reliably and attach `meta` for future pagination. Bare responses save ~10 characters per call but create inconsistency when some routes need metadata.

**`UPPER_SNAKE_CASE` error codes:** Machine-readable codes decouple frontend error handling from English message strings. Frontend can switch on `code` to show localised UI feedback without parsing `message`.

**Bearer JWT over session cookies:** Hono is a headless API consumed by Nuxt, Postman, and potentially mobile clients. Stateless JWTs need no session store and work uniformly across all consumers. Cookie management in a cross-subdomain setup adds CORS and SameSite complexity.

**`packages/api-contract` over inline types:** Both Hono and Nuxt need the same wire-format types. Without a shared package, types drift silently — Hono returns `snake_case` field names, Nuxt expects `camelCase`. A single source enforces the contract at compile time.

**Engine types stay internal:** The SRS and curation engines define their own types for portability. Leaking `WordState` or `Batch` into the API contract would couple the wire format to engine internals. The calling layer's mapping responsibility is explicit and intentional.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| Versioned prefix (`/api/v1/`) | Future-proof for breaking changes | Unnecessary complexity for solo MVP | Deferred — add if and when needed |
| Bare responses | Simpler, less code | Inconsistent when pagination or metadata needed | Wrapped costs nothing and prevents future drift |
| Session cookies | No token management on client | Requires session store, CORS complexity across subdomains | Bearer JWT is simpler for a headless multi-client API |
| Inline types in each app | No shared package overhead | Types drift silently between Hono and Nuxt | Single source of truth enforced at compile time |
| Re-export engine types via api-contract | Convenient shortcut | Couples wire format to engine internals — breaks engine portability | Mapping layer is explicit and intentional |

---

## Consequences

**Positive:**
- Hono and Nuxt agents share a single type source — incompatible shapes caught at compile time
- Consistent error envelope means frontend error handling is uniform across all routes
- Auth middleware slot reserved from Stage 2 — no rework when Stage 5 adds enforcement
- Flat namespace is readable and avoids premature versioning overhead

**Negative / Risks:**
- `packages/api-contract` is a new package dependency — Turborepo pipeline must include it
- Engine-to-wire mapping boilerplate in Hono route handlers (same as existing engine ADR consequence)
- Stage 2 SRS endpoint schemas reference `wordId` as `string` — exact ID format (UUID vs. integer vs. slug) depends on the schema ADR (GAP-02). Update when schema is locked.

**Neutral:**
- All routes default to unauthenticated until Stage 5 — consistent, but test data must not be considered private
- `meta` in responses is optional — routes that never need pagination can ignore it entirely

---

## Open Questions

| Question | Owner | Target |
|---|---|---|
| `wordId` format — UUID, integer, or slug? | Architect | Schema ADR (GAP-02, Stage 3) |
| `batchId` — server-generated UUID or client-provided? | Dev | Before Stage 2 implementation |
| JWT claims shape — what goes in the token payload? | Architect | Auth ADR (Stage 5) |
| CORS configuration — what origins are allowed? | Dev | Stage 2 (Nuxt + Hono on different ports locally) |

---

*Related ADRs:*
- [Headless Hono Backend](20260303T195134Z-engineering-headless-hono-backend.md)
- [SRS Engine Package](20260302T160536Z-engineering-srs-engine-package.md)
- [Curation Engine Package](20260303T210000Z-engineering-curation-engine-package.md)
- [Monorepo Tooling](20260227T022513Z-engineering-monorepo-tooling.md)
- [Cloudflare Platform](20260301T161844Z-infra-cloudflare-platform.md)
- Database Schema — pending (GAP-02, Stage 3 prerequisite)
- Auth Design — pending (Stage 5 prerequisite)