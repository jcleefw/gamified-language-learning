---
unit: packages/api-contract
sources: [EP11, EP15]
updated: 2026-08-01
---

# packages/api-contract — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## api-contract

The package exports TypeScript type declarations with zero runtime dependencies.


Contains common response envelope wraps all API responses. An error interface provides standardized error codes and messages for API consumption.

Answer submissions now identify the learner's chosen option by key rather than reporting correctness directly — the API no longer trusts the client's judgment of whether an answer was right.

