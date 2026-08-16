# EP50 - Graph RAG Governance Retrofit

**Created**: 20260816T173728Z
**Status**: Draft

**Type**: Epic Plan
**Depends on**: N/A
**Parallel with**: N/A
**Predecessor**: N/A <!-- spike branch `spike/graph-rag` is prior art, not a completed epic, so not a formal predecessor -->

---

## Problem Statement

`packages/graph-rag` builds a knowledge graph from the repo's own governance artifacts — `KNOWLEDGE.md` files, the changelog archive, and ADRs — and serves it for querying. The package needs a proper Epic/DS trail: DS01 specifies the core graph pipeline (ingestion, storage, query, server), and DS02 specifies ADR consolidation, removal of the fixture-based build path, and documentation cleanup.

## Scope

**In scope**:

- DS01: specify the graph pipeline — provenance indexing, knowledge ingestion, the core graph engine, ADR/decision linking, config-driven filtering, CLI tools, the query engine, and the server UI.
- DS02: consolidate the two ADRs into one, remove the fixture-pointing capability from the build CLI, prune redundant documentation.

**Out of scope**:

- New features (custom field extraction, git history ingestion, validation CLI, web UI, API endpoint) — candidate future DS scope, not committed in this epic.
- Any change to the actual graph/query logic — this epic is a governance and cleanup pass, not a rewrite.

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

### Phase 2: Cleanup and Consolidation (EP50-DS02)

### EP50-ST09: Consolidate the two graph-rag ADRs

**Scope**: Merge `20260718T094101Z-agentic-two-axis-knowledge-architecture.md` and `20260720T235931Z-engineering-graph-rag-read-model.md` into one ADR with an options-considered section; delete the superseded file; update all references.

### EP50-ST10: Remove fixture-pointing and test fixtures

**Scope**: Delete `__fixtures__/two-axis-sample/`, remove `--root`/`config.root` from `src/cli/build.ts`, update the 3 affected unit tests. Runs after DS01 is complete.

### EP50-ST11: Prune documentation

**Scope**: Once DS01 is complete, delete or fold `ARCHITECTURE.md`/`EXTRACTION_PATTERNS.md`/`RESEED_GUIDE.md`/`docs/graph-model-explained.md` into it where redundant; keep `README.md` as a package-level pointer to DS01.

---

## Overall Acceptance Criteria

- [ ] Graph pipeline (ingestion, storage, query, server) is implemented per DS01 and passes its acceptance criteria.
- [ ] Exactly one graph-rag ADR remains; all references across the repo point to it.
- [ ] No test fixture or CLI path allows building the graph against anything other than repo root.
- [ ] No doc file under `packages/graph-rag` duplicates content now owned by DS01.
- [ ] Package builds and existing tests pass after fixture removal.

---

## Dependencies

- N/A

## Next Steps

1. Review and approve this plan.
2. Write DS01 (this epic's first deliverable).
3. Write DS02 covering ST09-ST11.
4. Begin implementation.
