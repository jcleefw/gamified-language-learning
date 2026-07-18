# Source Code Overview

How the files in `packages/graph-rag/src` fit together — 9 source files split into
**types → storage → ingestion → query → CLI**.

## Architecture diagram

```
                          ┌─────────────────────┐
                          │      types.ts        │  Node, Edge, GraphData,
                          │  (shared contracts)  │  GraphContext, QueryResult
                          └──────────┬───────────┘
                                     │ imported by everything below
                                     │
        ┌────────────────────────────────────────────────────┐
        │                                                      │
   ┌────▼─────┐                                          ┌─────▼─────┐
   │ graph.ts │◄─────────────────────────────────────────┤ config.ts │
   │          │                                          │           │
   │ProjectGraph│  in-memory graph store                 │ConfigLoader│
   │ .addNode() │  (Map<id,Node> + Edge[])                │shouldIngestEpisode()│
   │ .addEdge() │                                          └─────┬─────┘
   │ .traverse()│                                                │ config drives
   │ .findPath()│                                                │ what gets ingested
   │ .toJSON()  │                                                │
   └────┬───────┘                                                │
        │ ▲                                                      │
        │ │ builds graph by reading .md files                    │
        │ │                                                      │
   ┌────▼─┴──────────────┐                       ┌────────────────▼──────────┐
   │   ingestion.ts        │                     │ ingestion-configurable.ts │
   │  DataIngestion         │                     │ ConfigurableDataIngestion │
   │  (fixed, hardcoded     │                     │ (same logic, but gated    │
   │   ingest behavior)     │                     │  by GraphRagConfig flags  │
   │                        │                     │  + episode filters)      │
   │  reads:                │                     │  reads same sources,      │
   │  .agents/plans/epics   │                     │  paths come from config   │
   │  .agents/changelogs    │                     │                           │
   └────────────────────────┘                     └───────────────────────────┘
        │                                                      │
        │  both parse Markdown → Node/Edge objects             │
        │  (episodes, stories, design-specs, files-modified,   │
        │   corrections) via regex extraction                 │
        │                                                      │
        └───────────────┬──────────────────────────────────────┘
                         │ produces a populated ProjectGraph
                         ▼
                 ┌───────────────┐
                 │ graph.toJSON()│──► .graph-data.json (persisted graph)
                 └───────┬───────┘
                         │ later reloaded from disk
                         ▼
                 ┌─────────────────────┐
                 │   query-engine.ts    │
                 │     QueryEngine       │
                 │                       │
                 │ .getContext(query)    │  keyword search over nodes
                 │ .contextToString()    │  + BFS subgraph traversal
                 │ .query(question) ─────┼──► Anthropic SDK (claude-opus)
                 └──────────┬────────────┘     → natural-language answer
                            │
                            ▼
                      QueryResult
                (query, context, nodes, edges)


┌───────────────────────────── CLI entry points ─────────────────────────────┐
│                                                                              │
│  cli/ingest.ts              → uses DataIngestion (fixed)                    │
│  cli/ingest-configurable.ts → uses ConfigLoader + ConfigurableDataIngestion  │
│  cli/query.ts               → loads .graph-data.json, rebuilds ProjectGraph,│
│                                 runs QueryEngine.getContext() demo           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

index.ts re-exports: ProjectGraph, DataIngestion, QueryEngine, and the shared types
— this is the package's public API surface.
```

## Role of each file

**`types.ts`** — the shared vocabulary. Defines `NodeType` (episode, story, design-spec, problem, component, decision), `EdgeType` (contains, depends-on, solves, modified, etc.), and the shapes (`Node`, `Edge`, `GraphData`, `GraphContext`, `QueryResult`) that every other file imports.

**`graph.ts`** — the data structure. `ProjectGraph` is just a `Map<string, Node>` plus an `Edge[]` array, with graph algorithms bolted on: `traverse()` (BFS/DFS following specific edge types), `findPath()` (DFS between two nodes), and `toJSON()` for serialization. It has no knowledge of where nodes come from — pure storage + traversal.

**`config.ts`** — configuration schema and loader (`GraphRagConfig`, `ConfigLoader`). Controls which sources are enabled (epics/changelogs/git), episode filters, which extraction rules run, and output/validation/logging behavior. `shouldIngestEpisode()` is the filter predicate used by the configurable ingestion path.

**`ingestion.ts`** vs **`ingestion-configurable.ts`** — two ingestion strategies that do the actual ETL: read `.agents/plans/epics/*.md` and `.agents/changelogs/EP*/*.md`, regex-extract problem statements, dependencies, stories, design-spec IDs, modified files, and corrections, then call `graph.addNode()`/`graph.addEdge()` to populate a `ProjectGraph`. The plain `ingestion.ts` hardcodes paths/behavior; `ingestion-configurable.ts` is the same logic gated by a `GraphRagConfig` (so you can scope ingestion to specific episodes, toggle extraction rules, etc.) — this is the one `EXTRACTION_PATTERNS.md` documents.

**`query-engine.ts`** — the "RAG" half. `QueryEngine` wraps a `ProjectGraph` plus an Anthropic client. `getContext(query)` does simple keyword scoring over node labels to find relevant nodes, then BFS-expands to a subgraph. `contextToString()` formats that into a text block. `query()` sends that context + the question to Claude (`claude-opus-4-1`) and returns a `QueryResult`.

**`cli/ingest.ts`** / **`cli/ingest-configurable.ts`** — executable entry points that run the two ingestion strategies end-to-end and write the graph out to `.graph-data.json` (the configurable one also handles backups and config-driven output paths).

**`cli/query.ts`** — loads `.graph-data.json` back into memory, reconstructs a `ProjectGraph`, and demos `QueryEngine.getContext()` against it.

**`index.ts`** — the public export barrel: `ProjectGraph`, `DataIngestion`, `QueryEngine`, and the shared types.

## Data flow in one line

Markdown docs (`.agents/plans/epics`, `.agents/changelogs`) → **ingestion** (regex parse) → **ProjectGraph** (nodes/edges in memory) → `.graph-data.json` (persisted) → **QueryEngine** (keyword search + subgraph traversal) → context string → Claude → answer.
