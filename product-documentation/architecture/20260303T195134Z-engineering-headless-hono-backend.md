# ADR: Headless Hono Backend for Orchestration

**Status:** Accepted

**Date:** 2026-03-03

**Deciders:** Solo founder

---

## Context

The platform architecture is moving toward a highly decoupled model. The core logic (SRS and Curation) is being extracted into pure TypeScript packages (`packages/srs-engine`, `packages/curation-engine`).

Previously, we considered running this logic within Nuxt SSR server routes. However, the founder wants to treat the frontend (Nuxt) as a "plug-and-play" consumer. This requires a dedicated "Headless" backend that can be developed and tested independently (e.g., using Postman) before any UI exists.

The project is committed to the **Cloudflare Free Tier**, meaning we must minimize overhead while maximizing security for API keys (Gemini) and data persistence (D1).

---

## Decision

Implement a **Headless API** using **Hono on Cloudflare Workers** as the primary orchestration layer for the platform.

### Key Responsibilities

| Layer | Responsibility |
|---|---|
| **Auth** | Centralized session/JWT management. Nuxt and future clients authenticate against the API. |
| **Orchestration** | Calls the extracted logical engines (`srs-engine`, `curation-engine`) and maps their output to JSON responses. |
| **Secrets Management** | Holds the Gemini API keys and R2/D1 credentials. Secrets are never exposed to the frontend. |
| **Quota Control** | Enforces the 10 RPD (Requests Per Day) limit for Gemini free tier to prevent bill shock or quota exhaustion. |
| **I/O Gateway** | The only layer allowed to read/write to Cloudflare D1 and R2. |

### Architectural Position

```
[ Frontend: Nuxt / Mobile / Postman ]
          │
          ▼ (JSON / HTTPS)
[ Backend: Hono Worker (Orchestration) ] ◄── Holds Secrets (Gemini Key)
          │
    ┌─────┴─────────────────┐
    ▼                       ▼
[ Logic: SRS Engine ]   [ Logic: Curation Engine ] ◄── Pure Logic Packages
    │                       │
    └─────┬─────────────────┘
          ▼
[ Infra: D1 (DB) / R2 (Storage) / Gemini (AI) ]
```

---

## Rationale

1.  **Frontend Independence**: Decoupling allows the UI to be replaced or augmented (e.g., adding a Native Mobile App) without touching the business logic or database layer.
2.  **Developer Experience (Postman-First)**: The backend can be fully functional and tested via API clients before the frontend is even scaffolded.
3.  **Security**: Keeping Gemini keys and D1 access behind a Hono Gateway ensures that client-side vulnerabilities cannot lead to API abuse or data breaches.
4.  **Cost Efficiency**: Cloudflare Workers (Hono) are extremely lightweight and fit perfectly within the 100k daily requests of the free tier.
5.  **Testability**: The API can be integration-tested as a "Black Box" (Data In -> JSON Out) without the complexity of a browser or SSR environment.

---

## Consequences

**Positive**:
- Extremely clean "separation of concerns."
- Unified auth for all possible future frontends.
- Faster backend development cycles using Postman/CURL.
- Zero risk of leaking Gemini API keys to the browser.

**Negative / Risks**:
- **CORS Management**: Since Nuxt (Pages) and Hono (Workers) might live on different subdomains, CORS must be configured correctly.
- **Latency**: An extra network hop between the frontend and the database-calling worker (though negligible on the Cloudflare Edge).
- **Nuxt Complexity**: Moving Auth away from `nuxt-auth-utils` to a custom Backend JWT/Session strategy requires manual wiring in the Vue app.

---

## Open Questions

- **Shared Types**: How will we share the API response types (JSON interfaces) between the Hono Backend and the Nuxt Frontend? (Recommended: `packages/api-contract`).
- **Sync Granularity**: Should the frontend sync with the API after every question, or only at the end of a 15-question batch? (Recommended: per batch/deck completion to minimize D1 writes).
- **JWT vs. Session**: Should we use stateless JWTs or stateful session cookies managed by the Hono middleware?

---
*Related ADRs:*
- [Cloudflare Platform](20260301T161844Z-infra-cloudflare-platform.md)
- [SRS Engine Package](20260302T160536Z-engineering-srs-engine-package.md)
