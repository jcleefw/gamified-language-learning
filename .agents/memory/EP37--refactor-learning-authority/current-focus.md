# Current Focus — Refactor: Learning Authority (foundation epic)

**Branch**: `EP37--refactor-learning-authority`
**Last updated**: 20260708T131500Z

---

## Reference point — the ADR

**All authority/integrity/observability decisions are settled in the ADR:**
[`product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md`](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md)
(**Status: Accepted**).

Treat that ADR as the source of truth. The pre-ADR open questions (is Learning client- or
server-authority? which Review authority? integrity rules?) are **decided there** — don't re-derive
them from DS03's wording or from `recent-decisions.md`'s archaeology.

## What this epic is

**EP37 is now the Learning-authority foundation epic** (renamed from the former "review in
`srs-demo`" scope). It delivers **ADR pillars 1 + 3 + the transition channel + the rollout gate** —
the change that makes `srs-demo`'s persisted Learning state authoritative on the server, which the
other two epics depend on.

## Scope — from the ADR

- **Pillar 1 — Learning state authority → server.** New `POST /api/answer` (contract in
  `@gll/api-contract`) receives `{ wordId, correct, latencyMs }`, runs the **same pure
  `@gll/srs-engine-v2` transition** the client runs today, persists `WordState`, returns authoritative
  state + events (`newlyMastered`, `graduated`). Client adopts the returned state instead of
  computing-then-POSTing. Client keeps question-gen, grading, and orchestration (`advanceAdaptiveSession`,
  `nextActivePool`, recheck, shelving). Scoped as *state* authority, **not** full EP15 quiz authority.
- **Pillar 3 — Integrity in the store layer (`@gll/db`)**: re-graduation ignore-if-exists (don't reset
  FSRS progress); readers tolerate orphaned review cards; graduation is one-way. Rules in `@gll/db`,
  **not** the Hono route, so `cli-demo-db` inherits them.
- **Transition channel** — the authoritative per-answer `WordState` event stream (byproduct of pillar 1;
  the durable/replayable half of the debug-trace epic's pillar 4).
- **Rollout gate** (mandatory): same pure engine both sides → parity by construction; feature flag
  (strangler-fig) keeps the current compute-then-POST path until flipped; **parallel-run/shadow**
  compares client vs. server before the server becomes source of truth; **golden-master** on captured
  `WordState` sequences is the acceptance gate.

## Related epics (numbers not fixed by the ADR)

- **Review-mode epic** (was EP37's old scope) — Review UI/flow in `srs-demo`. **Depends on this epic**
  for the server-side `graduated` hook + ADR pillar 2. To be created separately.
- **Debug-trace epic** — ADR pillar 4 (all three channels). Shares the correlation id with this epic;
  its client channels can proceed in parallel.

## Guardrails

- `cli-demo-db` is intentionally different (full local authority, server-free) and **stays as-is** —
  out of scope. But it **does** inherit pillar-3 integrity rules via `@gll/db`.
- Do not chase EP15's full answer-verification (question-gen + key-withholding) — the ADR explicitly
  defers it; client self-reporting `correct` is an accepted risk for `srs-demo`.

## Next Steps

1. Plan EP37 stories against ADR pillars 1 + 3 + transition channel + rollout gate.
2. Define the `POST /api/answer` contract in `@gll/api-contract`.
3. Stand up the flag + shadow parallel-run harness early (it's the acceptance gate).
