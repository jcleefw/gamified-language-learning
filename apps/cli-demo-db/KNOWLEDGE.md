---
unit: apps/cli-demo-db
sources: [EP30, EP31, EP36]
updated: 2026-08-16
---

# apps/cli-demo-db — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## data-access

A learner's progress is saved after every word or sentence answered, not
just at the end of a session — quitting mid-session doesn't lose progress.

## shelving

A shelved word stays excluded from both word-mode and sentence-tile
questions, including after resuming a session.

## review-session

Graduating a word seeds its first review card automatically. The review
runner loads due cards (either for one deck or across the whole pool) and
saves progress immediately after each answer. A rating is inferred from
response time — fast+correct, slow+correct, or wrong — so the learner is
never asked to self-rate.
