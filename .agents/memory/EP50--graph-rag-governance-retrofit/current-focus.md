# Current Focus — EP50: Graph RAG Governance Retrofit

**Status**: Closing as-is. DS01 (core pipeline) and DS02 (fixture removal + doc pruning) are complete.
EP50-BUG01 (cross-domain ryoiki linking gated by epic co-occurrence) is fixed and merged. DS03
(enhancements) is **not** proceeding under this epic — see below.
**Branch**: `feat/EP50--graph-rag-with-ryoki`
**Last updated**: 20260816

---

## What shipped in this epic

- **DS01** — core graph pipeline: provenance indexing, `KNOWLEDGE.md`/ADR ingestion, `ProjectGraph`
  engine, config-driven filtering, CLI tools, keyword+traversal query engine, server UI. Status:
  Completed (`.agents/changelogs/EP50--graph-rag-governance-retrofit/20260816T175218Z-EP50-DS01-graph-rag-core-implementation.md`).
- **DS02** — removed the fixture-pointing build path (`--root` override, `__fixtures__/two-axis-sample/`),
  pruned redundant docs. Status: Draft doc, ST10 done
  (`.agents/changelogs/EP50--graph-rag-governance-retrofit/20260816T183415Z-EP50-DS02-cleanup-fixture-and-docs.md`).
- **EP50-BUG01** — `wireRelates()` in `src/readers/knowledge.ts` no longer gates cross-domain `relates`
  edges on shared epic co-occurrence; it now unions on shared bare ryoiki key across domains, with epic
  co-touch demoted to edge label only. 33 tests passing, typecheck clean
  (`.agents/changelogs/EP50--graph-rag-governance-retrofit/20260816T193855Z-EP50-BUG01-ryoiki-domain-linking-gated-by-epic.md`).

## What did NOT ship — DS03 pulled from this epic

DS03 was drafted (`.agents/changelogs/EP50--graph-rag-governance-retrofit/20260816T194520Z-EP50-DS03-graph-rag-enhancements.md`)
covering four items, renumbered during discussion to ST12–ST15:

- **ST12 — Ryoiki as a shared, deduplicated node.** During discussion it became clear BUG01 did not fully
  solve the underlying problem: `KNOWLEDGE.md` ingestion still creates one `ryoiki` node **per domain**
  (`id = domain#title`), so two domains with the same-named ryoiki are still two separate nodes, now
  joined by a `relates` edge (BUG01's fix) rather than genuinely merged. PO's target shape:
  `packages/srs-engine —contains→ batch composition ←contains— apps/srs-demo` — one shared node, not two
  domain-owned duplicates cross-linked. This is a real data-model change (node identity/dedup rules in
  `ProjectGraph`, what happens to each domain's own descriptive content for a shared ryoiki) and needs its
  own ideation + ADR before implementation.
- **ST13 — Orphan kettei surfacing.** A `kettei` node with no `decides`/`supersedes` edge is currently
  invisible in query results/UI (degree-0 nodes never surface). Needs a query-engine option
  (`includeOrphanKettei`) unioning zero-edge kettei into results, default off.
- **ST14 — Server UI toggle** for ST13's option.
- **ST15 — Hardcoded model string.** `src/query-engine.ts`'s `query()` hardcodes `'claude-opus-4-8'` at the
  Anthropic `messages.create` call. Currently dead code (nothing calls `query()` — `src/cli/query.ts` only
  prints extracted context, never invokes LLM reasoning), but the literal needs verifying/replacing with a
  named constant before anything exercises that path.

**Decision (this session)**: all four items need proper ideation and an ADR before any implementation —
this is scoped as a **separate epic**, not a DS03 continuation of EP50. EP50 closes with DS01+DS02+BUG01
as its delivered scope.

## Next steps

1. Treat `.agents/changelogs/EP50--graph-rag-governance-retrofit/20260816T194520Z-EP50-DS03-graph-rag-enhancements.md`
   as reference material only — do not implement directly from it. A new epic should re-derive its own
   scope from ideation + ADR, starting with ST12 (the ryoiki shared-node model) since it reshapes the data
   model the other three sit on top of.
2. Before starting that epic's ideation: decide what happens to a domain's own descriptive content for a
   ryoiki once it's shared across domains (own text per domain? merged? edge-scoped?) — this was the open
   fork identified but not resolved in this session.
3. EP50 itself: verify Overall Acceptance Criteria in the epic plan, mark epic Status → Done, decide on
   merging `feat/EP50--graph-rag-with-ryoki` to main.
