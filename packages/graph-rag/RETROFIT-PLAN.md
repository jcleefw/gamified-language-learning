# Graph RAG — Retrofit Plan (Two-Axis Reader)

**Status:** Proposed
**Date:** 2026-07-18
**Decision:** Option B — reader-only retrofit onto the two-axis artifacts
**Nature:** Experimental. This package is **fully isolated** — it reads the knowledge
artifacts, it never writes them and nothing else in the repo depends on it.

---

## Why this plan exists

The current package is the failure mode the knowledge-architecture ADRs were written to
kill. It ingests **raw** `.agents/plans/epics/*` and `.agents/changelogs/EP*/*` and groups
nodes **by episode** — which the two-axis ADR names directly as *"the knowledge-graph
grouping bug"* (an epic is a unit of work in time, not a unit of knowledge; grouping by it
fragments every domain).

The two ADRs that supersede this design:

- **DS Lifecycle Compaction** (`product-documentation/architecture/20260718T021231Z-…`)
  — docs decay by rewrite-then-delete; git is the detail store; docs never duplicate
  `file:line`.
- **Two-Axis Knowledge Architecture** (`…20260718T094101Z-…`) — the one that governs this
  package. **D7** fixes what a graph must consume and how it must be shaped.

This retrofit realigns the package to **D7**: consume the two compacted artifacts, group by
domain, make the epic an *edge target only*.

---

## What the ADRs mandate for this package (D7)

> When a retrieval layer exists, it ingests these two artifacts, **not raw changelogs**:
> - Archive JSON → story/epic nodes on a timeline.
> - Domain `KNOWLEDGE.md` frontmatter → domain nodes (grouped by workspace unit), with
>   **`sources` IDs as provenance edges** to the archive's epic/story nodes.
> - The epic is thus always an *edge target, never the grouping* — which structurally
>   prevents the fragmentation bug.

Two source artifacts, both already specified and partially live:

| Artifact | Location | State today |
| --- | --- | --- |
| Time axis (JSON) | `.agents/changelogs/archive/index.json` (+ `schema.json`) | Exists, schema-valid, **1 story** (AGN05) |
| Domain axis (MD) | `{apps,packages}/<unit>/KNOWLEDGE.md` | **0 files** — populated as epics compact |

The graph therefore starts nearly empty and **accretes for free** each time an epic is
compacted. That is expected and correct — no big-bang backfill is part of this plan.

---

## The five mismatches this retrofit closes

| # | Current (delete) | Target (build) |
| - | --- | --- |
| 1 | Episode is the grouping node (`episode --contains--> story`) | Domain (workspace unit) is the grouping node; **epic is an edge target only** |
| 2 | Ontology: episode, story, design-spec, problem, component, decision | Ontology: **story, epic** (time) · **domain, concern** (domain) |
| 3 | Mines `file:path` component nodes from "Files Modified" | **Removed** — graph never duplicates git (Compaction D6) |
| 4 | Ingests raw epics + changelogs | Ingests `archive/index.json` + `**/KNOWLEDGE.md` only |
| 5 | Provenance by filename regex (DS/EP) | Structured `pr`, `sources`, `supersedes`, `fixes`, `track`, `concern` from the schema |

---

## Scope

### In scope (Option B — reader-only)
- New two-axis node/edge model.
- Two readers: archive JSON + KNOWLEDGE.md frontmatter.
- Keyword/traversal query engine retained; two known bugs fixed.
- Config reshaped from episode-range filters to track/domain filters.
- Delete the epic-grouped + file-node ingestion (rewrite-then-delete).

### Out of scope (explicitly)
- **Backfill** of the 157 legacy changelogs (separate track; not this package's job).
- **`archive-check` validator** — stays the separate `.agents/tools/` script the ADR
  specifies. This package is reader-only. (Revisit only if we later decide one package
  should own read+validate.)
- Embeddings / semantic retrieval, exploration UI, API endpoint (Option C — deferred until
  real query patterns are known, per D7).
- Writing to *any* artifact. This package is a read-only consumer.

### Isolation guarantees (experimental)
- All new code stays under `packages/graph-rag/`.
- Reads `.agents/changelogs/archive/index.json` and `**/KNOWLEDGE.md` **read-only**.
- No other package imports from `@gll/graph-rag`; no workspace-wide type coupling.
- Output graph cache stays local (`.graph-data.json`, gitignored).

---

## Target model

### Nodes
| Type | Axis | Source | Key metadata |
| --- | --- | --- | --- |
| `story` | time | `index.json` stories[] | `epic`, `track`, `domain`, `concern`, `completed`, `duration`, `summary`, `pr` |
| `epic` | time | `index.json` epics{} | `title`, `domains[]`, `archived`, `notes` |
| `domain` | domain | KNOWLEDGE.md `unit` frontmatter | `unit` (workspace path), `updated` |
| `concern` | domain | KNOWLEDGE.md `concern` frontmatter | free-form label, scoped within a `domain` |

### Edges
| Edge | From → To | Derived from |
| --- | --- | --- |
| `contains` | epic → story | story.epic |
| `touches` | story → domain | story.domain |
| `about` | concern → domain | KNOWLEDGE.md scoping |
| `sources` (provenance) | domain/concern → story or epic | KNOWLEDGE.md `sources[]` — **epic as target, never grouping** |
| `supersedes` | story → story | story.supersedes[] |
| `fixes` | story → epic/story | story.fixes[] |

Dropped entirely: `component` nodes, `modified` edges, `defines`/`corrected-from` filename
heuristics.

---

## File-by-file change plan

| File | Action |
| --- | --- |
| `src/types.ts` | Rewrite — new 4-type ontology + edge set above |
| `src/ingestion.ts` | **`git rm`** — replaced by the two readers below |
| `src/ingestion-configurable.ts` | Rewrite → `src/readers/archive.ts` + `src/readers/knowledge.ts` |
| `src/graph.ts` | Minor — generic store reused; edge-type list updated |
| `src/query-engine.ts` | Fix 2 bugs: (a) `query()` computes `answer` but returns without it; (b) stale model id `claude-opus-4-1-20250805` → current model |
| `src/config.ts` + `.graph-rag-config.json` | Reshape: episode-range filters → `track` / `domain` filters |
| `src/cli/*` | Point at the new readers; drop `ingest-configurable` epic filters |
| `ARCHITECTURE.md` | Rewrite — remove file-node/raw-changelog pipeline; document two-axis reader |
| `EXTRACTION_PATTERNS.md`, `RESEED_GUIDE.md` | Rewrite/trim to the new sources |
| `.graph-data.json` | Ensure gitignored; regenerated, never hand-edited |

---

## Dependency: sample data first

Before the reader rewrite, run a **sample compaction** so we design against real artifacts,
not a 1-story stub:

1. Compact **EP44 (app-vue-router)** — recent, small, single-domain (`apps/srs-demo` /
   concern `routing`). Produces real `index.json` stories + a real
   `apps/srs-demo/KNOWLEDGE.md` with live `sources` frontmatter.
2. (Optional, second) Compact the **SRS-engine cluster (EP20/21/23/25)** — the canonical
   cross-epic fragmentation case the ADR cites — to validate `supersedes` chains and a
   multi-source domain node.

EP44 alone exercises the full path: story nodes → domain node → `sources` provenance edge →
epic-as-edge-target.

---

## Sequencing

1. **Sample compaction (EP44)** — ~40–80k tokens. *(prerequisite)*
2. **`types.ts`** — new ontology.
3. **Readers** — `archive.ts` (trivial, JSON) then `knowledge.ts` (frontmatter parse).
4. **`graph.ts` / `query-engine.ts`** — edge list + bug fixes.
5. **Config + CLI** — track/domain filters.
6. **Delete** old ingestion + file-node logic; rewrite docs.
7. **Verify** — `pnpm test` + typecheck; ingest EP44 sample → assert graph groups by domain,
   epic appears only as an edge target, zero `file:` nodes.

## Budget

- Reader-only B (this plan): **~200–330k tokens** incl. the EP44 sample, one sitting.
- Explicitly *not* incurred here: 157-file backfill (multi-million), validator (+~80–120k),
  Option C retrieval/UI (~1.5M+).

## Open items
- Confirm the exact current model id to pin in `query-engine.ts`.
- Decide `concern` representation: standalone node vs. a property on `story`/`domain`.
  (Leaning standalone node so the graph can group by concern later — cheap to change while
  the graph is small.)
- KNOWLEDGE.md frontmatter shape is fixed by D5 (`unit`, `concern`, `sources`, `updated`);
  confirm once the EP44 sample authors the first real one.
