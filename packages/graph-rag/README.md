# Graph RAG — Ryoiki-Centric Knowledge Reader

An **experimental, fully isolated** package that reads the repo's compacted
knowledge into a queryable graph. It only ever *reads* those artifacts; nothing
writes them except the one explicit ADR-link write-back described below, and no
other package depends on this one.

> **Status:** reader-only (with one narrow write-back). The graph portrays
> **knowledge and decisions, not work** — its nodes are domains, ryoiki, and
> ADRs. Stories and epics are provenance *metadata*, never nodes. This revises
> the Two-Axis ADR's D7 (which made story/epic first-class timeline nodes);
> that axis dominated the picture with work items, so it was demoted to
> citations. Recorded in the **D7 amendment (2026-07-19)** of the Two-Axis
> Knowledge Architecture ADR, and further refined by
> [20260720T235931Z-engineering-graph-rag-read-model.md](../../product-documentation/architecture/20260720T235931Z-engineering-graph-rag-read-model.md)
> (ryoiki blacklist filtering + alias resolution).

## What it portrays

The knowledge graph is the structure of the repo's `KNOWLEDGE.md` files, plus
its architecture decisions:

| Node | Source | Meaning |
| --- | --- | --- |
| `domain` | `{apps,packages}/<unit>/KNOWLEDGE.md` frontmatter | a workspace unit — a grouping of ryoiki |
| `ryoiki` | each `##` heading in a `KNOWLEDGE.md` | a named area of knowledge, carrying the prose beneath it |
| `adr` | `product-documentation/architecture/*.md` | an architecture decision (the *why*) |

`ryoiki` is the within-unit knowledge axis defined by **AGN06 (Package-Scoped
Knowledge Filtering)**. Two curated reference files drive how ryoiki are read
(both optional — a root without them degrades to include-everything):

- **`.agents/reference/ryoiki-aliases.json`** — heals naming drift (`fsrs`,
  `nav` → their canonical spelling) so the archive→heading provenance join, the
  ADR `**Decides:**` target, and cross-domain matching all still meet.
- **`.agents/reference/ryoiki-blacklist.json`** — per-unit (plus a global `"*"`)
  exclusion list, cascading longest-prefix-wins on the slash path. A blacklisted
  ryoiki is **never** added to the graph. Since the blacklist is enforced at
  *write* time in `KNOWLEDGE.md` (AGN06 D9), a blacklisted heading showing up
  there is an authoring anomaly — Graph RAG **warns loudly** (`console.warn`)
  and then skips it, rather than silently dropping or silently including it.

The archive (`.agents/changelogs/archive/index.json`) is **not** turned into
nodes. It is distilled into a provenance index and stamped onto each ryoiki as
metadata — which stories, epics, and PRs produced it — so "what produced this?"
is still answerable without work items cluttering the graph.

ADRs ingest **as-is**, standalone, and start *floating* (unlinked) — no prose is
mined for ryoiki links. A human links an ADR to the ryoiki/domain it governs;
that link is written back into the ADR's own `**Decides:**` field (the source
of truth), so a reset + rebuild reconstructs it by re-reading the ADR.

### The principle

**The graph shows knowledge and decisions; work is a citation, not the
skeleton.** An epic is a unit of work in *time*, not a unit of *knowledge*;
making epics/stories nodes fragmented every domain into an episode breakdown.
Here a ryoiki is the atom, its `content` is the durable description, and its
`sources`/`epics`/`prs` are the provenance. The graph also never mines `file:`
nodes — it does not duplicate what git already records (Compaction D6).

## Node & edge model

```
domain  --contains-->  ryoiki      (a domain groups its ryoiki)
ryoiki  --relates-->   ryoiki      (two ryoiki co-evolved in the same epic,
                                     across different domains)
adr     --decides-->   ryoiki|domain  (an ADR governs a ryoiki or a whole domain;
                                        human-linked, written back into the ADR)
adr     --supersedes-->adr         (auto-parsed from "Superseded by" / "Amended by")

# provenance lives on the ryoiki as metadata, not as edges:
ryoiki.metadata = { content, sources:[storyIds], epics:[epicIds], prs:[numbers] }
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the pipeline and JSON shape, and
[EXTRACTION_PATTERNS.md](./EXTRACTION_PATTERNS.md) for exact field mappings.

## Usage

### Build the graph

```bash
pnpm --filter @gll/graph-rag graph:build
```

Reads `.graph-rag-config.json` for the `root`, `filter` (tracks/domains),
`adrs` (include/exclude, file allowlist), and output settings, then writes
`.graph-data.json` (gitignored). Point it elsewhere without editing config via
`--root=`:

```bash
pnpm --filter @gll/graph-rag graph:build -- --root=.
```

By default the config points `root` at the frozen **EP44 sample fixture**
(`__fixtures__/two-axis-sample/`), so a fresh checkout builds a real graph with
no setup. Point `root` at `.` to build from the live repo.

Building is pure file reading + parsing — it never calls an LLM.

**Reset vs. refresh** — the only persistent state besides the disposable
`.graph-data.json` cache is the `**Decides:**` field hand-written into ADR
files (the UI's "link ADR" writes there). So:

```bash
pnpm --filter @gll/graph-rag graph:refresh   # re-read latest sources, same as graph:build
pnpm --filter @gll/graph-rag graph:reset     # drop .graph-data.json, then rebuild clean
```

To fully reset *and* discard manually-drawn ADR links, also revert the ADR
files themselves (`git restore product-documentation/architecture/*.md`)
before rebuilding — the graph only reconstructs what's on disk.

After any of these, restart `graph:ui` (below) to pick up the change — it
builds once at boot and only rebuilds on an explicit `/api/link`.

### Filtering out ADR noise

Every ADR under `product-documentation/architecture/` ingests by default,
which can get noisy once there are dozens of them. Two ways to cut that down,
in both `graph:build` and `graph:ui`:

```bash
# Skip ADR ingestion entirely — domain/ryoiki nodes only.
pnpm --filter @gll/graph-rag graph:build -- --no-adrs

# Restrict to specific ADRs — comma-separated filename or bare slug, either works.
pnpm --filter @gll/graph-rag graph:build -- --adr=20260713T140218Z-engineering-audio-playback-model.md,fe-framework-toolchain
```

Or make it persistent in `.graph-rag-config.json`:

```json
"adrs": { "include": true, "files": ["fe-framework-toolchain", "engineering-graph-rag-read-model"] }
```

`files: null` (the default) means every ADR in the directory; `include: false`
skips the ADR reader altogether, same as `--no-adrs`.

### Explore it (graph + chat)

```bash
pnpm --filter @gll/graph-rag graph:ui        # http://localhost:5179
```

A local web app: a force-graph of the domains/ryoiki/ADRs on the left, and a
chat on the right. Retrieval runs **key-free** on the graph server-side; only
the final answer is generated by a **local Ollama** model
(`http://localhost:11434`, model picker defaults to `qwen3-coder:30b`). The
nodes grounding each answer light up in the graph. It's a local app — not a
hosted artifact — precisely because the chat must reach your local Ollama,
which a sandboxed browser page cannot. Override with
`-- --root=. --port=5173 --ollama=http://host:11434 --no-adrs`.

Dragging a link from an ADR to a ryoiki/domain node in the UI calls
`POST /api/link`, which writes the target into that ADR's `**Decides:**` field
on disk and rebuilds — the link survives a `graph:reset` because it's read
back from the ADR, not from the cache.

### Build programmatically

```typescript
import { buildGraph, QueryEngine } from '@gll/graph-rag';

const graph = buildGraph('/path/to/repo-or-fixture', { tracks: ['project'], includeAdrs: false });

// Ryoiki nodes carry their own provenance — no traversal needed:
const routing = graph.getNode('apps/srs-demo#Routing');
console.log(routing?.metadata.sources); // ['EP44-ST01', 'EP44-ST02', ...]

// Or reason over a subgraph with an LLM (Anthropic path):
const engine = new QueryEngine(graph);
const result = await engine.query('How does routing work in srs-demo and which work produced it, and which ADR governs it?');
console.log(result.answer); // engine.query() needs ANTHROPIC_API_KEY; the UI uses Ollama instead
```

### Query CLI (context preview)

```bash
pnpm --filter @gll/graph-rag graph:query
```

Loads `.graph-data.json`, runs the keyword search + traversal, and prints the
extracted graph context (no LLM call).

## Sample fixture

`__fixtures__/two-axis-sample/` is a frozen snapshot produced by a sample run of
the `archive-epic` skill over **EP44** (App.vue → Vue Router, PR #41). It yields
two workspace domains, three ryoiki with real prose and provenance, two
cross-domain `relates` edges (EP44 spanned both domains), a small set of ADR
fixtures (linked + floating + superseded), and two deliberately blacklisted
headings to exercise the loud-anomaly guard. See the fixture's own `README.md`
for its contract.

## Testing

```bash
pnpm --filter @gll/graph-rag test
```

Tests assert the ryoiki-centric invariants against the EP44 fixture: **no
story or epic nodes**, ryoiki grouped under their domain, provenance kept as
ryoiki metadata, cross-domain `relates` only, zero `file:` nodes, blacklisted
headings excluded with a warning, and alias-drift stories still joining their
canonical ryoiki. A separate suite covers the `adr` reader: parsing, `decides`
resolution (including unmatched targets staying floating), and `supersedes`
lineage.

## API

`src/types.ts` has the full definitions.

```typescript
buildGraph(root: string, opts?: {
  tracks?: string[] | null;
  domains?: string[] | null;
  includeAdrs?: boolean;       // default true
  adrFiles?: string[] | null;  // filename or slug allowlist; default = every ADR
}): ProjectGraph

// readers (composable)
loadRyoikiConfig(root)                              // alias map + blacklist -> RyoikiConfig
loadArchiveIndex(root)                              // archive JSON
buildProvenanceIndex(archive, filter?, canonicalize?) // -> ProvenanceIndex (no nodes)
ingestKnowledge(graph, root, filter?, provenance?, config?) // domain/ryoiki nodes + edges
ingestAdrs(graph, root, canonicalize?, only?)       // adr nodes + decides/supersedes edges

// graph
graph.getNode(id): Node | undefined
graph.nodesByType(type): Node[]                    // 'domain' | 'ryoiki' | 'adr'
graph.traverse(nodeId, edgeTypes, depth?): Node[]
graph.toJSON(): GraphData

// query
engine.getContext(query): GraphContext
engine.contextToString(context): string
engine.query(question): Promise<QueryResult>       // Anthropic; the UI uses Ollama
```

## Explicitly out of scope

- **Backfill** of legacy changelogs (separate track).
- The **`archive-check` validator** — stays the `.agents/tools/` script; this
  package is reader-only.
- Embeddings / semantic retrieval.
- Writing to any artifact other than an ADR's own `**Decides:**` field, and
  only in response to an explicit human link in the UI.
