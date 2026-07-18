# Graph RAG — Two-Axis Knowledge Reader

An **experimental, fully isolated** package that reads the repo's two compacted
knowledge artifacts into a queryable graph. It only ever *reads* those artifacts;
nothing writes them, and no other package depends on this one.

> **Status:** reader-only retrofit. See [RETROFIT-PLAN.md](./RETROFIT-PLAN.md) for
> the decision record and the mismatches this closed.

## What it reads

Governed by the **Two-Axis Knowledge Architecture** ADR (D7). The graph is built
from exactly two sources — never from raw epics or changelogs:

| Axis | Source | Becomes |
| --- | --- | --- |
| **Time** | `.agents/changelogs/archive/index.json` | `story` + `epic` nodes on a timeline |
| **Domain** | `{apps,packages}/<unit>/KNOWLEDGE.md` | `domain` + `concern` nodes, grouped by workspace unit |

The two axes are joined by the `sources` frontmatter in each `KNOWLEDGE.md`: a
domain points back at the stories/epics that produced its current state.

### The invariant that matters

**An epic is always an edge target, never a grouping node.** Grouping is by
workspace `domain`. This is what structurally prevents the "knowledge-graph
grouping bug" (an epic is a unit of work in *time*, not a unit of *knowledge*;
grouping by it fragments every domain). The graph also never mines `file:` nodes —
it does not duplicate what git already records (Compaction D6).

## Node & edge model

```
epic  --contains-->  story                 (story.epic)
story --touches-->   domain                (story.domain)
story --supersedes-> story                 (story.supersedes[])
story --fixes-->     epic | story          (story.fixes[])
concern --about-->   domain                (KNOWLEDGE.md ## heading)
domain  --sources--> story | epic          (KNOWLEDGE.md `sources` frontmatter)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full pipeline and the on-disk
JSON shape, and [EXTRACTION_PATTERNS.md](./EXTRACTION_PATTERNS.md) for exactly
which field maps to which node/edge.

## Usage

### Build the graph

```bash
pnpm --filter @gll/graph-rag graph:build
```

Reads `.graph-rag-config.json` for the `root`, `filter` (tracks/domains), and
output settings, then writes `.graph-data.json` (gitignored). Point it elsewhere
without editing config via `--root=`:

```bash
pnpm --filter @gll/graph-rag graph:build -- --root=.
```

By default the config points `root` at the frozen **EP44 sample fixture**
(`__fixtures__/two-axis-sample/`), so a fresh checkout builds a real graph with no
setup. Point `root` at `.` to build from the live repo once epics start compacting.

Building is pure file reading + parsing — it never calls an LLM. An
`ANTHROPIC_API_KEY` is only needed for `QueryEngine.query()`.

### Build programmatically

```typescript
import { buildGraph, QueryEngine } from '@gll/graph-rag';

const graph = buildGraph('/path/to/repo-or-fixture', { tracks: ['project'] });

// Traversal is synchronous and LLM-free:
const provenance = graph.edges.filter((e) => e.from === 'apps/srs-demo' && e.type === 'sources');

// Or reason over a subgraph with the LLM:
const engine = new QueryEngine(graph);
const result = await engine.query('How does routing work in srs-demo and which work produced it?');
console.log(result.answer);
```

### Query CLI (context preview)

```bash
pnpm --filter @gll/graph-rag graph:query
```

Loads `.graph-data.json`, runs the keyword search + traversal, and prints the
extracted graph context (no LLM call).

## Sample fixture

`__fixtures__/two-axis-sample/` is a frozen snapshot produced by a sample run of
the `archive-epic` skill over **EP44** (App.vue → Vue Router, PR #41), stopped
before the compact step. It exercises the full path: two real workspace domains,
epic-level and story-level provenance, a `fixes` cross-reference, and a
cross-track entry. See the fixture's own `README.md` for its contract.

## Testing

```bash
pnpm --filter @gll/graph-rag test
```

Tests cover the graph structure plus the ADR invariants against the EP44 fixture:
grouped by domain, epic appears only as an edge target, zero `file:` nodes,
provenance wired at both grains.

## API

`src/types.ts` has the full definitions.

```typescript
buildGraph(root: string, opts?: { tracks?: string[] | null; domains?: string[] | null }): ProjectGraph

// readers (composable)
ingestArchive(graph, root, filter?)     // time axis
ingestKnowledge(graph, root, filter?)   // domain axis

// graph
graph.getNode(id): Node | undefined
graph.nodesByType(type): Node[]
graph.traverse(nodeId, edgeTypes, depth?): Node[]
graph.findPath(fromId, toId, maxDepth?): Edge[]
graph.toJSON(): GraphData

// query
engine.getContext(query): GraphContext
engine.contextToString(context): string
engine.query(question): Promise<QueryResult>   // needs ANTHROPIC_API_KEY
```

## Explicitly out of scope

- **Backfill** of legacy changelogs (separate track).
- The **`archive-check` validator** — stays the `.agents/tools/` script the ADR
  specifies; this package is reader-only.
- Embeddings / semantic retrieval, exploration UI, API endpoint (deferred until
  real query patterns are known, per D7).
- Writing to *any* artifact.
