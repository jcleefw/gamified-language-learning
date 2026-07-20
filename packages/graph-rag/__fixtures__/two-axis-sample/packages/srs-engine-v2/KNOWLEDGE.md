---
unit: packages/srs-engine-v2
sources: [EP44-RV01]
updated: 2026-07-19
---

# srs-engine-v2 — Domain Knowledge

## Batch Composition

- Batch assembly randomizes item order with an unbiased Fisher-Yates shuffle drawn
  from the shared shuffle utility. Ordering is a uniform permutation of the batch —
  it never uses a comparator-based `sort` with a random result, which is
  statistically biased and unspecified.

## Type Definitions

- ANOMALY FIXTURE: this ryoiki is blacklisted globally (the "*" key), so it should
  never have been written here. Graph-rag must warn about it and leave it out of
  the graph.
