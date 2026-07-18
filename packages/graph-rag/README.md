# Graph RAG: Project Development Knowledge Graph

A knowledge graph of how the gamified language learning platform was built, with LLM-powered querying to understand architecture decisions, evolution, and relationships.

## What is Graph RAG?

Graph RAG combines knowledge graphs with LLM reasoning:

1. **Knowledge Graph**: Structured representation of your project (episodes, stories, design specs, components, dependencies)
2. **Graph Traversal**: Multi-hop navigation through relationships (not just keyword matching)
3. **LLM Reasoning**: Use Claude to answer questions about the project based on graph context

## Use Cases

- *"How did the SRS engine evolve from EP02 to EP07?"*
- *"What design decisions were made for batch composition?"*
- *"Show me the dependency chain for the quiz runner"*
- *"Trace how active window complexity was addressed"*

## Architecture

### Core Modules

- **`ProjectGraph`**: Graph data structure (nodes + edges)
- **`DataIngestion`**: Parses `.agents/changelogs/` and `.agents/plans/epics/` to build the graph
- **`QueryEngine`**: Text search + LLM reasoning over graph context

### Entity Types

- **Episode**: A development phase (EP01, EP02, etc.)
- **Story**: A subtask within an episode (EP01-ST01, etc.)
- **Design Spec**: Design decisions (DS01, DS02, etc.)
- **Component**: Files or packages modified
- **Problem**: Issues solved by episodes

### Relationship Types

- `depends-on`: Episode dependency
- `contains`: Episode contains stories
- `defines`: Design spec defines episode
- `modified`: Episode modified a file
- `corrected-from`: Episode corrected a spec

## Usage

### 1. Seed the Graph

Seeding = running ingestion to build (or rebuild) `.graph-data.json` from the markdown source in `.agents/plans/epics/` and `.agents/changelogs/`. There are two ways to do it:

**Fixed ingest** — ingests everything, no configuration required:

```bash
pnpm --filter @gll/graph-rag ingest
```

Generates `.graph-data.json` with 200+ nodes and 300+ edges from your `.agents/` directory.

**Config-driven ingest** — lets you scope *which* episodes/sources/fields get ingested:

```bash
pnpm --filter @gll/graph-rag ingest:config
```

This reads `packages/graph-rag/.graph-rag-config.json` (falls back to sensible defaults if the file doesn't exist) to control:

- Which sources are enabled (`epics`, `changelogs`, `git`)
- Which episodes to include — all (`null`), a specific list (`[1, 2, 3]`), or ranges (`[[30, 44]]`)
- Which fields to extract (problem statements, dependencies, stories, design specs, files modified, corrections)
- Output filename, whether to pretty-print, whether to back up the previous graph before overwriting

Example config scoped to a single feature area:

```json
{
  "sources": {
    "epics": { "enabled": true, "filter": { "episodes": [2, 3, 4, 5, 6, 7] } },
    "changelogs": { "enabled": true, "filter": { "episodes": [2, 3, 4, 5, 6, 7] } }
  },
  "output": { "graph_file": ".graph-data-focused.json" }
}
```

#### Reseeding (updating the graph after source docs change)

Every ingest run does a **full rebuild from whatever files currently exist on disk** — it does not read the previous `.graph-data.json` back in or merge incrementally. So after adding/editing episodes or changelogs, just re-run the same command:

```bash
rm packages/graph-rag/.graph-data.json   # optional — ingest overwrites it anyway
pnpm --filter @gll/graph-rag ingest
```

This is deterministic (same files in → same graph out) but not additive across runs — if you want the graph to reflect new information, it must exist in the source markdown first. See [RESEED_GUIDE.md](./RESEED_GUIDE.md) for adding custom extraction fields, filtering by episode range, or merging in additional sources (e.g. git history).

Ingestion itself never calls an LLM — it's pure regex parsing over file text. An `ANTHROPIC_API_KEY` is only needed later, for `QueryEngine.query()`.

### 2. Query Programmatically

```typescript
import { DataIngestion, QueryEngine } from '@gll/graph-rag';

const ingestion = new DataIngestion(projectRoot);
const graph = await ingestion.ingest();
const engine = new QueryEngine(graph);

const result = await engine.query('How did the SRS engine evolve?');
console.log(result); // LLM-generated answer with graph context
```

### 3. Graph Traversal

```typescript
// Find all episodes that modify a specific file
const fileNode = graph.getNode('file:packages/srs-engine/src/index.ts');
const relatedEpisodes = graph.edges
  .filter(e => e.to === fileNode?.id)
  .map(e => graph.getNode(e.from));

// Find dependency paths
const path = graph.findPath('EP07', 'EP01'); // Trace backwards
```

## How It Works

### Data Flow

1. **Ingestion**: Reads `.agents/plans/epics/*.md` and `.agents/changelogs/*/*.md`
2. **Extraction**: Parses episodes, stories, dependencies, design specs, modified files
3. **Graph Building**: Constructs nodes and edges, deduplicates
4. **Serialization**: Exports to JSON for persistence
5. **Querying**: Takes user question → searches graph → extracts context → sends to LLM with context
6. **Response**: LLM reasons over graph structure to answer "why" questions

### Query Example

```
User: "Why was the foundational deck integrated into the SRS engine?"

Engine:
1. Searches for "foundational deck", "SRS engine"
2. Finds: EP06 (foundational deck), EP07 (orchestrator), EP02 (mastery)
3. Traverses edges: EP06 → depends-on → EP02, EP07 → depends-on → EP06
4. Extracts subgraph (10 nodes, 15 edges)
5. Sends to Claude with context:
   "Here's the graph showing foundational deck (EP06) depends on mastery (EP02),
    and orchestrator (EP07) depends on foundational deck. Why were these decisions made?"
6. Claude answers: "The foundational deck (consonants, vowels, tones) required the
    mastery tracking system from EP02. Then EP07 orchestrates all systems together..."
```

## Graph Statistics

From `.agents/` directory:

- **37 episodes** (EP01 → EP44+)
- **190 stories** (subtasks within episodes)
- **2 design specs** (DS01, DS02)
- **300+ edges** (dependencies, containment, modifications)

## Testing

```bash
pnpm test
```

Tests cover:
- Node/edge operations
- Graph traversal
- Duplicate prevention
- JSON serialization

## Future Extensions

- Visual graph explorer (web UI)
- Time-based queries ("What was built in week 3?")
- File dependency analysis
- Component evolution tracking
- Decision impact analysis
- Automated documentation generation

## API Reference

See `src/types.ts` for full TypeScript definitions.

### ProjectGraph

```typescript
graph.addNode(node: Node): void
graph.addEdge(edge: Edge): void
graph.getNode(id: string): Node | undefined
graph.nodesByType(type: NodeType): Node[]
graph.traverse(nodeId: string, edgeTypes: EdgeType[], depth?: number): Node[]
graph.findPath(fromId: string, toId: string, maxDepth?: number): Edge[]
graph.toJSON(): GraphData
```

### QueryEngine

```typescript
engine.getContext(query: string): GraphContext
engine.contextToString(context: GraphContext): string
engine.query(question: string): Promise<QueryResult>
```

## License

Part of the gamified language learning platform project.
