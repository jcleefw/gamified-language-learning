# EP50 - Graph RAG Governance Retrofit

**Created**: 20260816T173728Z
**Status**: Draft

**Type**: Epic Plan
**Depends on**: N/A
**Parallel with**: N/A
**Predecessor**: N/A <!-- spike branch `spike/graph-rag` is prior art, not a completed epic, so not a formal predecessor -->

---

## Problem Statement

`packages/graph-rag` builds a knowledge graph from the repo's own governance artifacts — `KNOWLEDGE.md` files, the changelog archive, and ADRs — and serves it for querying. The package needs a proper Epic/DS trail: DS01 specifies the core graph pipeline (ingestion, storage, query, server), and DS02 specifies removal of the fixture-based build path and documentation cleanup.

## Scope

**In scope**:

- DS01: specify the graph pipeline — provenance indexing, knowledge ingestion, the core graph engine, ADR/decision linking, config-driven filtering, CLI tools, the query engine, and the server UI.
- DS02: remove the fixture-pointing capability from the build CLI, prune redundant documentation.
- DS03: kettei-without-linkage visibility (query engine + server UI) and model-string housekeeping in the query engine.

**Out of scope**:

- New features (custom field extraction, git history ingestion, validation CLI, web UI, API endpoint) — candidate future DS scope, not committed in this epic.
- Domain-data ingestion (surfacing srs-engine's own domain concepts, e.g. shelving rules, in the graph) — parked pending a clearer shape; will get its own DS or epic.
- Any *other* change to the actual graph/query logic beyond DS03's scope — this epic is primarily a governance and cleanup pass. <!-- Exception already taken once: EP50-BUG01 fixed cross-domain ryoiki linking (wireRelates gated by epic co-occurrence instead of shared ryoiki key), logged as a defect against the read-model ADR's own stated intent, not scope creep. -->

---

## Stories

### Phase 1: Core Implementation (EP50-DS01)

### EP50-ST01: Provenance index reader

**Scope**: `buildProvenanceIndex` (`src/readers/archive.ts`) reads `.agents/changelogs/archive/index.json` into `byRyoiki`/`epicSpan` maps — citations only, no graph nodes.

### EP50-ST02: Knowledge ingestion

**Scope**: `ingestKnowledge` (`src/readers/knowledge.ts`) parses `KNOWLEDGE.md` files into `domain`/`ryoiki` nodes and `contains`/`relates` edges, stamped with provenance from ST01.

### EP50-ST03: Core graph engine

**Scope**: `ProjectGraph` (`src/graph.ts`, `src/types.ts`) — node/edge storage, dedup rules, serialization to `.graph-data.json`.

### EP50-ST04: ADR/kettei reader and linking

**Scope**: `src/readers/adr.ts` parses ADRs into `kettei` nodes (gated on `**Decides:**` + config allowlist) with `decides`/`supersedes` edges; `POST /api/link` write-back in `src/server/serve.ts`.

### EP50-ST05: Config-driven filtering

**Scope**: `src/config.ts`, `src/readers/ryoiki-config.ts`, `.graph-rag-config.json` — `tracks`/`domains` filters, ADR allowlist.

### EP50-ST06: CLI tools

**Scope**: `src/cli/build.ts` (`graph:build`) and `src/cli/query.ts`.

### EP50-ST07: Query engine

**Scope**: `src/query-engine.ts` — keyword search → traversal → LLM reasoning via Anthropic client.

### EP50-ST08: Server UI

**Scope**: `src/server/serve.ts` + `src/server/ui.html` (`graph:ui`), routes generation to local Ollama.

### Phase 2: Cleanup (EP50-DS02)

<!-- ADR consolidation was considered and dropped: the two ADRs are at different scope
     levels (Two-Axis is repo-wide governance; Graph RAG Read Model is package-specific
     and already correctly supersedes only Two-Axis's D7 clause). Left as-is. -->

### EP50-ST10: Remove fixture-pointing and test fixtures

**Scope**: Delete `__fixtures__/two-axis-sample/`, remove `--root`/`config.root` from `src/cli/build.ts` and `src/server/serve.ts`, update the 2 affected unit tests. Runs after DS01 is complete.

### EP50-ST11: Prune documentation

**Scope**: Once DS01 is complete, delete or fold `ARCHITECTURE.md`/`EXTRACTION_PATTERNS.md`/`RESEED_GUIDE.md`/`docs/graph-model-explained.md` into it where redundant; keep `README.md` as a package-level pointer to DS01.

### Phase 3: Enhancements (EP50-DS03)

### EP50-ST12: Orphan kettei surfacing in query engine

**Scope**: `src/query-engine.ts` — `includeOrphanKettei` option to union zero-edge `kettei` nodes into query results.

### EP50-ST13: Server UI toggle for orphan kettei

**Scope**: `src/server/serve.ts` (+ UI) — expose ST12's option as a user-facing toggle.

### EP50-ST14: Fix hardcoded model string in query engine

**Scope**: `src/query-engine.ts` — replace inline `'claude-opus-4-8'` literal with a verified, named model constant.

---

## Overall Acceptance Criteria

- [ ] Graph pipeline (ingestion, storage, query, server) is implemented per DS01 and passes its acceptance criteria.
- [ ] No test fixture or CLI path allows building the graph against anything other than repo root.
- [ ] No doc file under `packages/graph-rag` duplicates content now owned by DS01.
- [ ] Package builds and existing tests pass after fixture removal.

---

## Dependencies

- N/A

## Next Steps

1. Review and approve this plan.
2. Write DS01 (this epic's first deliverable).
3. Write DS02 covering ST10-ST11.
4. Begin implementation.
