# Graph RAG Architecture: Build Pipeline & Storage

## Data pipeline overview

```
┌─────────────────────────────────────────────────────────────────┐
│ SOURCE ARTIFACTS                                                  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  KNOWLEDGE (the graph's structure):                               │
│  <root>/{apps,packages}/<unit>/KNOWLEDGE.md                       │
│  └─ frontmatter (unit, sources, updated) + ## concern headings    │
│     + the prose beneath each heading (the durable knowledge)      │
│                                                                   │
│  PROVENANCE (citations only, never nodes):                        │
│  <root>/.agents/changelogs/archive/index.json                     │
│  └─ stories[] carry (domain, concern, epic, pr) — folded into a   │
│     provenance index keyed by (domain, concern)                   │
│                                                                   │
│  It never reads raw .agents/plans/epics or .agents/changelogs/EP* │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ READERS  (src/readers/, orchestrated by buildGraph)               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. buildProvenanceIndex(archive, filter)   [produces NO nodes]   │
│     ├─ byConcern:  (domain, concern) -> { stories, epics, prs }   │
│     └─ epicSpan:   epicId -> set of concern keys it produced      │
│                                                                   │
│  2. ingestKnowledge(graph, root, filter, provenance)              │
│     ├─ domain node per KNOWLEDGE.md    (id = `unit` frontmatter)   │
│     ├─ concern node per ## heading     (content = prose beneath)   │
│     │    + provenance stamped from the index (sources/epics/prs)  │
│     ├─ domain  --contains--> concern                              │
│     └─ concern --relates-->  concern   (cross-domain, shared epic) │
│                                                                   │
│  Stories and epics are NEVER nodes — only citations on concerns.  │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ IN-MEMORY GRAPH (ProjectGraph)                                    │
│   nodes: Map<id, Node>   edges: Edge[]   (dedup by from,to,type)   │
├──────────────────────────┬────────────────────────────────────────┤
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERIALIZATION → packages/graph-rag/.graph-data.json (gitignored)  │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ QUERYING (QueryEngine): keyword search → traverse → LLM reasoning │
│   graph:ui routes generation to a LOCAL Ollama; retrieval is      │
│   key-free. engine.query() uses the Anthropic client instead.     │
└───────────────────────────────────────────────────────────────────┘
```

## The organizing principle

The graph portrays **knowledge, not work**. Grouping is by workspace `domain`;
the atom of knowledge is the `concern`. Stories/epics are provenance metadata on
each concern, never nodes — so the picture can't fragment into an episode
breakdown. There are no `file:` nodes: the graph never duplicates what git stores
(Compaction D6). Enforced by `__tests__/unit/concern-reader.test.ts`.

> This revises the Two-Axis ADR's D7, which made story/epic first-class timeline
> nodes. The time axis survives only as provenance. Recorded in the D7 amendment
> (2026-07-19) of the Two-Axis Knowledge Architecture ADR.

## Node types

| Type | Source | Key metadata |
| --- | --- | --- |
| `domain` | `KNOWLEDGE.md` frontmatter | `unit`, `updated`, `sources`, `path` |
| `concern` | `KNOWLEDGE.md` `##` heading | `concern`, `unit`, `updated`, `content` (prose), `sources[]`, `epics[]`, `prs[]` |

## Edge types

| Edge | From → To | Derived from |
| --- | --- | --- |
| `contains` | domain → concern | a domain groups its concerns |
| `relates` | concern → concern | two concerns in *different* domains produced by the same epic (co-evolution); label is `via <epicId>` |

Concerns within one domain are already grouped by their shared domain node, so no
intra-domain `relates` edges are drawn.

## Provenance matching

A story's `concern` field is a slug (`app-shell`); a `KNOWLEDGE.md` heading is a
title (`App Shell`). They are matched by `normalizeConcern` (lowercase, strip
non-alphanumerics), keyed with the story's `domain`. A story with no `concern` (or
no matching `KNOWLEDGE.md`) contributes no provenance — it simply doesn't appear.

## Storage format

`packages/graph-rag/.graph-data.json` — regenerated by `graph:build`, never
hand-edited, gitignored. Shape (from the EP44 fixture):

```json
{
  "nodes": [
    {
      "id": "apps/srs-demo",
      "type": "domain",
      "label": "apps/srs-demo",
      "metadata": { "unit": "apps/srs-demo", "updated": "2026-07-19", "sources": ["EP44"] }
    },
    {
      "id": "apps/srs-demo#Routing",
      "type": "concern",
      "label": "apps/srs-demo · Routing",
      "metadata": {
        "concern": "Routing",
        "unit": "apps/srs-demo",
        "content": "- Navigation is handled by Vue Router 4. ...",
        "sources": ["EP44-ST01", "EP44-ST02", "EP44-ST03", "EP44-ST05"],
        "epics": ["EP44"],
        "prs": [41]
      }
    }
  ],
  "edges": [
    { "from": "apps/srs-demo", "to": "apps/srs-demo#Routing", "type": "contains", "label": "contains" },
    { "from": "apps/srs-demo#Routing", "to": "packages/srs-engine-v2#Batch Composition", "type": "relates", "label": "via EP44" }
  ],
  "summary": {
    "totalNodes": 5,
    "nodesByType": { "domain": 2, "concern": 3 },
    "totalEdges": 5
  }
}
```

## Filtering

`buildGraph(root, { tracks, domains })` (and the config's `filter` block) scope the
graph:

- `tracks`: keep only provenance from stories on these tracks (e.g. `['project']`
  drops `agentic`). Concern nodes still come from `KNOWLEDGE.md`; the filter only
  affects which work is credited as provenance.
- `domains`: keep only these workspace units.

`null`/omitted = no filter.

## Deduplication

- **Nodes**: adding an existing `id` overwrites — last write wins.
- **Edges**: `(from, to, type)` must be unique; duplicates are skipped. `relates`
  pairs are ordered deterministically so `A→B` and `B→A` collapse to one edge.
- **Determinism**: same artifacts in → same graph out. The JSON is a cache, not a
  source of truth.

## Reseeding

The graph accretes for free: it grows each time an epic is compacted into the
archive + `KNOWLEDGE.md`. To refresh, just rebuild — see
[RESEED_GUIDE.md](./RESEED_GUIDE.md).
