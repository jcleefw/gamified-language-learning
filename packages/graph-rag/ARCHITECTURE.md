# Graph RAG Architecture: Build Pipeline & Storage

## Data Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ SOURCE DATA                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  .agents/plans/epics/*.md  (37 files)                          │
│  └─ Problem statements, scope, stories, dependencies           │
│                                                                 │
│  .agents/changelogs/EP*/*.md  (152 files)                      │
│  └─ Implementation details, files modified, corrections        │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ INGESTION (DataIngestion class)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Ingest Epics (.agents/plans/epics/*.md)              │
│  ├─ Extract: episodeNum from filename (EP01, EP02, ...)       │
│  ├─ Extract: title from filename                               │
│  ├─ Parse: Problem Statement section                           │
│  ├─ Parse: Dependencies (Depends on: EP01, EP02, ...)         │
│  ├─ Parse: Stories (### EP01-ST01: ...)                       │
│  ├─ Add: Episode node {id, type, label, metadata}             │
│  ├─ Add: Story nodes for each ### match                        │
│  └─ Add: Edges (episode → story [contains])                    │
│                                                                 │
│  Step 2: Ingest Changelogs (.agents/changelogs/*/*.md)        │
│  ├─ Extract: episodeNum from directory name                   │
│  ├─ Extract: designSpecId from filename (DS01, DS02, ...)    │
│  ├─ Parse: Files Modified section                              │
│  ├─ Add: File nodes {id: 'file:path/to/file.ts', ...}        │
│  ├─ Add: DesignSpec nodes (if found)                          │
│  └─ Add: Edges for all relationships                           │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ IN-MEMORY GRAPH (ProjectGraph class)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  nodes: Map<id, Node>  (229 entries)                           │
│  edges: Edge[]         (296 entries)                           │
│                                                                 │
│  Node structure:                                                │
│  {                                                              │
│    id: "EP02"                                                  │
│    type: "episode"                                             │
│    label: "EP02: srs engine mastery"                          │
│    metadata: {                                                 │
│      problem: "The SRS engine has no mastery tracking..."     │
│      dependencies: ["EP01"]                                   │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  Edge structure:                                                │
│  {                                                              │
│    from: "EP02"                                                │
│    to: "EP02-ST01"                                             │
│    type: "contains"                                            │
│    label: "contains story"                                     │
│  }                                                              │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERIALIZATION → JSON                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stored in: packages/graph-rag/.graph-data.json               │
│                                                                 │
│  {                                                              │
│    "nodes": [                                                  │
│      { "id": "EP01", "type": "episode", ... },                │
│      { "id": "EP01-ST01", "type": "story", ... },            │
│      ...  (229 total)                                          │
│    ],                                                           │
│    "edges": [                                                  │
│      { "from": "EP01", "to": "EP01-ST01", "type": "contains" },
│      ...  (296 total)                                          │
│    ],                                                           │
│    "summary": {                                                │
│      "totalNodes": 229,                                        │
│      "nodesByType": { "episode": 37, "story": 190, ... },    │
│      "totalEdges": 296                                         │
│    }                                                            │
│  }                                                              │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ QUERYING (QueryEngine)                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load .graph-data.json → reconstruct graph                 │
│  2. Parse user question                                        │
│  3. Search nodes (keyword matching)                           │
│  4. Traverse edges (follow relationships, depth=3)             │
│  5. Build subgraph (relevant nodes + edges)                    │
│  6. Format as string context                                   │
│  7. Send to Claude API with context                           │
│  8. Return answer + graph data                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Format: The Graph JSON

### File Location
```
packages/graph-rag/.graph-data.json
```

### Structure
```json
{
  "nodes": [
    {
      "id": "EP01",
      "type": "episode",
      "label": "EP01: monorepo scaffolding",
      "metadata": {
        "file": "EP01-monorepo-scaffolding.md",
        "problem": "No project structure exists. All Stage 1 work...",
        "dependencies": []
      }
    },
    {
      "id": "EP02",
      "type": "episode",
      "label": "EP02: srs engine mastery",
      "metadata": {
        "file": "EP02-srs-engine-mastery.md",
        "problem": "The SRS engine has no mastery tracking...",
        "dependencies": ["EP01"]
      }
    },
    {
      "id": "EP01-ST01",
      "type": "story",
      "label": "EP01-ST01: pnpm workspace + Turborepo",
      "metadata": {
        "episode": "EP01"
      }
    },
    {
      "id": "DS01",
      "type": "design-spec",
      "label": "DS01",
      "metadata": {
        "episode": "EP01",
        "file": "20260305T200100Z-DS01-monorepo-scaffolding.md"
      }
    },
    {
      "id": "file:packages/srs-engine/package.json",
      "type": "component",
      "label": "packages/srs-engine/package.json",
      "metadata": {
        "type": "file"
      }
    }
  ],
  "edges": [
    {
      "from": "EP01",
      "to": "EP01-ST01",
      "type": "contains",
      "label": "contains story"
    },
    {
      "from": "EP02",
      "to": "EP01",
      "type": "depends-on",
      "label": "depends on"
    },
    {
      "from": "EP01",
      "to": "file:packages/srs-engine/package.json",
      "type": "modified",
      "label": "modified"
    },
    {
      "from": "DS01",
      "to": "EP01",
      "type": "defines",
      "label": "defines"
    }
  ],
  "summary": {
    "totalNodes": 229,
    "nodesByType": {
      "episode": 37,
      "story": 190,
      "design-spec": 2,
      "problem": 0,
      "component": 0,
      "decision": 0
    },
    "totalEdges": 296
  }
}
```

## Extraction Rules

### Episode Extraction (from epic plan files)

**File pattern**: `.agents/plans/epics/EP##-*.md`

```typescript
// Filename → Episode ID
"EP01-monorepo-scaffolding.md" → id: "EP01"

// Filename → Title
"EP01-monorepo-scaffolding.md" → label: "EP01: monorepo scaffolding"

// Markdown → Problem statement
"## Problem Statement\n\nNo project structure exists..." → metadata.problem

// Markdown → Dependencies
"**Depends on**: EP01, EP02" → metadata.dependencies: ["EP01", "EP02"]

// Markdown → Stories
"### EP01-ST01: pnpm workspace + Turborepo" → creates story node + edge
```

### Changelog Extraction (from changelog files)

**File pattern**: `.agents/changelogs/EP##--*/.*-*.md`

```typescript
// Filename → Design Spec ID
"20260305T200100Z-DS01-monorepo-scaffolding.md" → designSpecId: "DS01"

// Section → Files Modified
"### `packages/srs-engine/package.json`" → file node + modified edge

// Section → Corrections
"## DS01 Spec Gaps Corrected" → corrected-from edge

// Directory → Episode
"/changelogs/EP01--monorepo-scaffolding/" → episode: "EP01"
```

## How Deduplication Works

### Duplicate Nodes
```typescript
// If you re-ingest and a node ID already exists
graph.addNode({ id: "EP01", ... })  // Overwrites previous
```

### Duplicate Edges
```typescript
// Edges are deduplicated: (from, to, type) tuple must be unique
if (edges.some(e => e.from === edge.from && e.to === edge.to && e.type === edge.type)) {
  // Skip, already exists
} else {
  edges.push(edge)  // Add new
}
```

### Result: Always Clean Graph
- Running `pnpm ingest` twice produces identical `.graph-data.json`
- No orphaned nodes or duplicate edges
- Safe to regenerate anytime

## How to Reseed/Rebuild the Graph

### Scenario 1: Quick Reseed (Delete & Regenerate)

```bash
# 1. Remove cached graph
rm packages/graph-rag/.graph-data.json

# 2. Rebuild from source
pnpm --filter @gll/graph-rag ingest

# Result: Fresh graph from .agents/ directory
```

### Scenario 2: Partial Update (Specific Episodes)

If you only want to re-ingest certain episodes, modify `src/ingestion.ts`:

```typescript
private ingestEpics(graph: ProjectGraph): void {
  const epicsDir = join(this.projectRoot, '.agents', 'plans', 'epics');
  let epicFiles = readdirSync(epicsDir).filter((f) => f.endsWith('.md'));
  
  // BEFORE: Process all 37 files
  // AFTER: Filter to specific episodes
  epicFiles = epicFiles.filter(f => {
    const match = f.match(/EP(\d+)/);
    const num = match ? parseInt(match[1]) : 0;
    return num >= 20;  // Only EP20 and above
  });
  
  // Rest of logic unchanged
}
```

### Scenario 3: Custom Data Source (Replace Entirely)

If you want to use a different data source (e.g., git logs, Jira, Notion):

**Create a new ingestion class:**
```typescript
// src/ingestion-custom.ts
export class CustomDataIngestion {
  async ingest(): Promise<ProjectGraph> {
    const graph = new ProjectGraph();
    
    // Your custom logic:
    // - Query git history
    // - Parse Jira tickets
    // - Read from database
    // - Call external API
    
    // Then: graph.addNode(...), graph.addEdge(...)
    return graph;
  }
}
```

**Use it in CLI:**
```typescript
// src/cli/ingest.ts
import { CustomDataIngestion } from '../ingestion-custom.js';

const ingestion = new CustomDataIngestion(projectRoot);
const graph = await ingestion.ingest();
```

### Scenario 4: Modify Extraction Rules

If you want to extract more data (e.g., decisions, problems, tradeoffs):

**Update the regex patterns in `ingestEpics()`:**

```typescript
// Extract decisions from epic plans
const decisionsMatch = content.match(/## Design Decisions\n\n([\s\S]*?)\n\n/);
if (decisionsMatch) {
  const decisions = decisionsMatch[1].split('\n-').map(d => d.trim());
  decisions.forEach((decision, idx) => {
    const decisionId = `${episodeNum}-DECISION-${idx}`;
    graph.addNode({
      id: decisionId,
      type: 'decision',
      label: decision,
      metadata: { episode: episodeNum }
    });
    
    graph.addEdge({
      from: episodeNum,
      to: decisionId,
      type: 'has-decision',
      label: 'makes decision'
    });
  });
}
```

Then reseed:
```bash
pnpm --filter @gll/graph-rag ingest
```

### Scenario 5: Validation & Repair

Check graph integrity before using:

```typescript
// src/validation.ts
export function validateGraph(graph: ProjectGraph): GraphValidationReport {
  const issues = [];
  
  // Check for orphaned nodes
  const referencedIds = new Set(graph.edges.flatMap(e => [e.from, e.to]));
  graph.nodes.forEach(node => {
    if (!referencedIds.has(node.id) && node.type !== 'episode') {
      issues.push(`Orphaned node: ${node.id}`);
    }
  });
  
  // Check for broken references
  graph.edges.forEach(edge => {
    if (!graph.getNode(edge.from)) {
      issues.push(`Broken edge from: ${edge.from}`);
    }
    if (!graph.getNode(edge.to)) {
      issues.push(`Broken edge to: ${edge.to}`);
    }
  });
  
  return { isValid: issues.length === 0, issues };
}
```

## Storage Decisions & Tradeoffs

| Approach | Pros | Cons | Used? |
|----------|------|------|-------|
| **JSON file (.graph-data.json)** | Fast, portable, human-readable, git-trackable | File system bound, eventual consistency | ✅ YES |
| **SQLite database** | ACID, complex queries, scalable | More setup, slower for small data | ❌ No (v1) |
| **In-memory only** | Fast, simple | Lost on restart, not persistent | ❌ No (v1) |
| **LLM-powered ingestion** | Flexible, semantic extraction | Slow, expensive, less reliable | ❌ No (v1) |
| **Graph database (Neo4j)** | Native graph queries, relationship indexes | External dependency, overkill for 229 nodes | ❌ No (v1) |

**Chosen approach (JSON)**:
- 229 nodes + 296 edges = ~50KB JSON (tiny)
- Re-ingestion from source is fast (~100ms)
- Deterministic: same input → same output
- Version-controllable (can track graph evolution)

## Performance Characteristics

### Ingestion
```
Parsing 37 epics:      ~10ms
Parsing 152 changelogs: ~80ms
Total:                 ~90ms

Graph size: 229 nodes, 296 edges
JSON size:  ~50KB
```

### Querying
```
Keyword search (top 10): <1ms
Graph traversal (depth=3): <5ms
Context formatting:      <10ms
LLM call:               ~2-5s (network bound)
```

## Future: Hybrid Storage

When you scale beyond this POC:

```
┌──────────────┐
│ Source Data  │  (.agents/plans, .agents/changelogs)
└──────┬───────┘
       │
       ├─→ Ingestion Pipeline
       │
       ├─→ Validation (check for issues)
       │
       └─→ Store in:
            ├─ JSON (cache, human-readable)
            ├─ SQLite (queryable, persistent)
            └─ Vector DB (semantic search, embeddings)
       
       Query:
       ├─ Keyword search → JSON (fast)
       ├─ Relationship queries → SQLite (reliable)
       └─ Semantic search → Vector DB (powerful)
```

## Summary: When to Reseed

**Do it when:**
- You add new episodes to `.agents/plans/epics/`
- You add new changelogs to `.agents/changelogs/`
- You want to change extraction rules
- You want to include new data sources
- You suspect the cached graph is stale

**How:**
```bash
# Full reseed (0.1 seconds)
rm packages/graph-rag/.graph-data.json
pnpm --filter @gll/graph-rag ingest

# Or just re-run ingest (overwrites)
pnpm --filter @gll/graph-rag ingest
```

No downtime, deterministic output, always fresh.
