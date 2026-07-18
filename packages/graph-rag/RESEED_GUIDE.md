# Graph Reseeding Guide: Practical Examples

Complete walkthroughs of how to modify and reseed your knowledge graph.

## Quick Reseed (Fastest)

**What it does**: Deletes cached graph, rebuilds from source (`.agents/` directory)

```bash
# Remove cache
rm packages/graph-rag/.graph-data.json

# Rebuild (takes ~100ms)
pnpm --filter @gll/graph-rag ingest

# Verify
ls -lh packages/graph-rag/.graph-data.json
# Output: 50KB JSON file
```

**When to use**: 
- After adding new episodes to `.agents/plans/epics/`
- After updating changelogs
- To get latest data without code changes

---

## Example 1: Add Decision Tracking to Graph

You want to extract "key design decisions" from each episode, so you can later ask: "What were the architectural decisions in EP07?"

### Step 1: Update Your Markdown

Add a section to `EP07-srs-engine-orchestrator.md`:

```markdown
## Problem Statement

The individual engine modules...

## Key Decisions

- Decision 1: Compose all modules into a single SrsEngine class for cohesion
- Decision 2: Use config object instead of scattered params for flexibility
- Decision 3: Isolate quiz state in the engine, not in routes

## Scope

In scope:
...
```

### Step 2: Update Extraction Code

Edit `packages/graph-rag/src/ingestion.ts`:

Find the `ingestEpics()` method and add this after the stories extraction:

```typescript
// Parse key decisions
const decisionsMatch = content.match(/## Key Decisions\n\n([\s\S]*?)(?=##|$)/);
if (decisionsMatch) {
  const decisionLines = decisionsMatch[1]
    .split('\n-')
    .map((d) => d.trim())
    .filter((d) => d && d.startsWith('Decision'));
  
  decisionLines.forEach((decisionText, idx) => {
    const decisionId = `${episodeNum}-DECISION-${idx}`;
    
    graph.addNode({
      id: decisionId,
      type: 'decision',
      label: decisionText.replace(/^Decision \d+: /, ''),
      metadata: { 
        episode: episodeNum,
        raw: decisionText
      },
    });
    
    graph.addEdge({
      from: episodeNum,
      to: decisionId,
      type: 'makes-decision',
      label: 'makes decision',
    });
  });
}
```

### Step 3: Update Types (Optional)

Update `src/types.ts` to include the new edge type:

```typescript
export type EdgeType = 
  | 'contains'
  | 'depends-on'
  | 'solves'
  | 'documents'
  | 'implements'
  | 'defines'
  | 'modified'
  | 'references'
  | 'evolved-to'
  | 'corrected-from'
  | 'makes-decision';  // ← NEW
```

### Step 4: Rebuild & Ingest

```bash
# Rebuild TypeScript
pnpm --filter @gll/graph-rag build

# Clear cache
rm packages/graph-rag/.graph-data.json

# Ingest with new extraction
pnpm --filter @gll/graph-rag ingest
```

Output:
```
✓ Parsed 37 epic plans
✓ Parsed 152 changelog files
Graph Summary:
Total nodes: 240  ← UP from 229 (added ~11 decisions across all episodes)
Total edges: 308  ← UP from 296 (new makes-decision edges)
```

### Step 5: Verify

Check the graph JSON:

```bash
jq '.nodes[] | select(.type == "decision") | .label' packages/graph-rag/.graph-data.json
```

Output:
```
"Compose all modules into a single SrsEngine class for cohesion"
"Use config object instead of scattered params for flexibility"
"Isolate quiz state in the engine, not in routes"
...
```

### Step 6: Query Your New Data

```typescript
import { ProjectGraph, QueryEngine } from '@gll/graph-rag';

// Load graph
const graphData = JSON.parse(fs.readFileSync('.graph-data.json', 'utf-8'));
const graph = new ProjectGraph();
graphData.nodes.forEach(n => graph.addNode(n));
graphData.edges.forEach(e => graph.addEdge(e));

// Query
const engine = new QueryEngine(graph);
const result = await engine.query(
  'What key design decisions were made in the SRS orchestrator?'
);

// Claude now sees the decision nodes and can discuss them
```

---

## Example 2: Track Problem Resolution

You want to see how problems are solved: Problem → Solution.

### Step 1: Link Problems to Episodes

Modify `ingestEpics()` to create problem nodes:

```typescript
const problemMatch = content.match(/## Problem Statement\n\n([\s\S]*?)\n\n/);
const problem = problemMatch ? problemMatch[1].trim() : '';

if (problem) {
  const problemId = `${episodeNum}-PROBLEM`;
  
  graph.addNode({
    id: problemId,
    type: 'problem',
    label: problem.substring(0, 100) + '...',  // First 100 chars
    metadata: { 
      episode: episodeNum,
      fullText: problem
    },
  });
  
  graph.addEdge({
    from: episodeNum,
    to: problemId,
    type: 'solves',
    label: 'solves problem',
  });
}
```

### Step 2: Create Problem Dependency Chain

For episode dependencies, add a reverse edge showing which problems led to the next episode:

```typescript
// After adding dependency edges:
dependencies.forEach((dep) => {
  graph.addEdge({
    from: episodeNum,
    to: dep,
    type: 'depends-on',
    label: 'depends on',
  });
  
  // NEW: Add reverse edge showing problem inheritance
  graph.addEdge({
    from: dep,
    to: `${episodeNum}-PROBLEM`,
    type: 'leads-to-problem',
    label: 'leads to',
  });
});
```

### Step 3: Rebuild & Reseed

```bash
pnpm --filter @gll/graph-rag build
rm packages/graph-rag/.graph-data.json
pnpm --filter @gll/graph-rag ingest
```

### Step 4: Trace Problem Resolution

```typescript
// Find all problems
const allProblems = graph.nodesByType('problem');

// Trace each problem: Problem ← Episode1 ← depends-on ← Episode2
allProblems.forEach(problem => {
  const matchingEpisode = graph.edges
    .find(e => e.to === problem.id && e.type === 'solves');
  
  if (matchingEpisode) {
    const episode = graph.getNode(matchingEpisode.from);
    console.log(`EP: ${episode?.label}`);
    console.log(`Problem: ${problem.label}`);
    
    // Find what depends on this
    const dependents = graph.edges
      .filter(e => e.to === episode?.id && e.type === 'depends-on')
      .map(e => graph.getNode(e.from));
    
    console.log(`Solved by: ${dependents.map(d => d?.label).join(', ')}`);
  }
});
```

---

## Example 3: Custom Data Source (Git History)

You want to ingest data from git commits instead of (or in addition to) `.agents/` files.

### Step 1: Create Custom Ingestion Class

Create `src/ingestion-git.ts`:

```typescript
import { execSync } from 'child_process';
import { ProjectGraph } from './graph.js';

export class GitDataIngestion {
  projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async ingest(): Promise<ProjectGraph> {
    const graph = new ProjectGraph();

    console.log('📊 Ingesting from git history...\n');

    // Get all commits mentioning "EP"
    const gitLog = execSync(
      'git log --pretty=format:"%h %s" --all',
      { cwd: this.projectRoot }
    ).toString();

    const commits = gitLog.split('\n').filter(line => line.includes('EP'));

    console.log(`Step 1: Parsing ${commits.length} commits...`);

    commits.forEach((commit) => {
      const match = commit.match(/([a-f0-9]+)\s+(.+)/);
      if (!match) return;

      const [, hash, message] = match;

      // Extract episode from commit message
      const epMatch = message.match(/EP(\d+)/);
      if (!epMatch) return;

      const episodeNum = `EP${epMatch[1]}`;
      
      // Create commit node
      const commitId = `git:${hash}`;
      graph.addNode({
        id: commitId,
        type: 'component',  // Using component type
        label: message.substring(0, 80),
        metadata: {
          hash,
          message,
          episode: episodeNum,
        },
      });

      // Link to episode
      if (!graph.getNode(episodeNum)) {
        // Episode might not exist yet if only running git ingest
        graph.addNode({
          id: episodeNum,
          type: 'episode',
          label: episodeNum,
          metadata: {},
        });
      }

      graph.addEdge({
        from: episodeNum,
        to: commitId,
        type: 'implements',
        label: 'implemented in',
      });
    });

    console.log(`✓ Parsed ${commits.length} commits`);
    return graph;
  }
}
```

### Step 2: Create CLI Variant

Create `src/cli/ingest-git.ts`:

```typescript
#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GitDataIngestion } from '../ingestion-git.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const projectRoot = join(__dirname, '../../../..');

  console.log('🚀 Building graph from git history...\n');

  const ingestion = new GitDataIngestion(projectRoot);
  const graph = await ingestion.ingest();

  console.log(`\n📈 Graph Summary:`);
  console.log(`Total nodes: ${graph.nodes.size}`);
  console.log(`Total edges: ${graph.edges.length}`);

  const nodeData = graph.toJSON();
  console.log(
    `Node types: ${Object.entries(nodeData.summary.nodesByType)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ')}`,
  );

  const outputPath = join(projectRoot, 'packages/graph-rag/.graph-data-git.json');
  writeFileSync(outputPath, JSON.stringify(nodeData, null, 2));
  console.log(`\n✓ Graph saved to .graph-data-git.json`);
}

main().catch(console.error);
```

### Step 3: Run Custom Ingest

```bash
# Update package.json scripts to include:
# "ingest:git": "tsx src/cli/ingest-git.ts"

pnpm --filter @gll/graph-rag ingest:git
```

Output:
```
✓ Parsed 42 commits
Total nodes: 45
Total edges: 42
Node types: episode(37), component(8)
```

### Step 4: Merge Both Graphs

Combine `.agents/` data + git data:

```typescript
async function mergedIngest() {
  const standard = new DataIngestion(projectRoot);
  const gitData = new GitDataIngestion(projectRoot);

  const graph = await standard.ingest();    // 229 nodes
  const gitGraph = await gitData.ingest();  // 45 nodes

  // Merge: add all git nodes/edges to main graph
  gitGraph.nodes.forEach(node => graph.addNode(node));
  gitGraph.edges.forEach(edge => graph.addEdge(edge));

  // Result: 229 + 45 = ~270 nodes (dedup handles duplicates)
  return graph;
}
```

---

## Example 4: Filter by Episode Range

You want to only ingest recent episodes (EP30+) to reduce graph size.

### Edit `src/ingestion.ts`:

```typescript
private ingestEpics(graph: ProjectGraph): void {
  const epicsDir = join(this.projectRoot, '.agents', 'plans', 'epics');
  let epicFiles = readdirSync(epicsDir).filter((f) => f.endsWith('.md'));
  
  // FILTER: Only recent episodes
  epicFiles = epicFiles.filter((f) => {
    const match = f.match(/EP(\d+)/);
    const num = match ? parseInt(match[1]) : 0;
    return num >= 30;  // Only EP30, EP31, ..., EP44+
  });
  
  // Rest of method unchanged
  for (const epicFile of epicFiles) {
    // ... same code
  }
}
```

### Reseed:

```bash
rm packages/graph-rag/.graph-data.json
pnpm --filter @gll/graph-rag ingest
```

Result:
```
✓ Parsed 14 epic plans  ← DOWN from 37 (EP30-EP44)
✓ Parsed 42 changelog files  ← DOWN from 152
Total nodes: 89  ← DOWN from 229
Total edges: 102  ← DOWN from 296
```

Use case: Faster ingestion, focus on recent work, exclude legacy episodes.

---

## Example 5: Change Extraction Rules (Strict Mode)

You want to be more selective: only extract epics that have completed changelogs.

### Edit `src/ingestion.ts`:

```typescript
private ingestEpics(graph: ProjectGraph): void {
  const epicsDir = join(this.projectRoot, '.agents', 'plans', 'epics');
  const changelogsDir = join(this.projectRoot, '.agents', 'changelogs');
  const completedDirs = readdirSync(changelogsDir);
  
  let epicFiles = readdirSync(epicsDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => {
      // Only ingest if matching changelog directory exists
      const match = f.match(/(EP\d+--.+)/);
      return match && completedDirs.some(d => d.startsWith(match[1]));
    });
  
  // Rest of method unchanged
}
```

### Reseed:

```bash
rm packages/graph-rag/.graph-data.json
pnpm --filter @gll/graph-rag ingest
```

Result: Only epics with completed changelogs are included (safer data).

---

## Validation Before Reseed

Create a pre-ingest check:

```typescript
// src/validate-source.ts
export function validateSourceData(projectRoot: string): ValidationResult {
  const issues: string[] = [];
  
  // Check: Every epic has a matching changelog directory
  const epicsDir = join(projectRoot, '.agents', 'plans', 'epics');
  const changelogsDir = join(projectRoot, '.agents', 'changelogs');
  
  const epicFiles = readdirSync(epicsDir).filter(f => f.endsWith('.md'));
  const changelogDirs = readdirSync(changelogsDir).filter(f => f.startsWith('EP'));
  
  epicFiles.forEach(epicFile => {
    const match = epicFile.match(/(EP\d+--.+)/);
    if (match && !changelogDirs.some(d => d.startsWith(match[1]))) {
      issues.push(`Epic ${epicFile} has no matching changelog directory`);
    }
  });
  
  // Check: Every changelog directory has matching epic
  changelogDirs.forEach(dir => {
    const match = dir.match(/(EP\d+--.+)/);
    if (match && !epicFiles.some(f => f.startsWith(match[1]))) {
      issues.push(`Changelog ${dir} has no matching epic file`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues,
    summary: `${epicFiles.length} epics, ${changelogDirs.length} changelogs`,
  };
}
```

Use before ingest:

```bash
# In CI/CD
pnpm --filter @gll/graph-rag validate:source || exit 1
pnpm --filter @gll/graph-rag ingest
```

---

## Summary: Reseed Strategies

| Strategy | Time | When to Use | Loss |
|----------|------|------------|------|
| **Quick reseed** | 100ms | After adding data | None, rebuilds from source |
| **Filter by range** | 50ms | Focus on recent work | Old episodes excluded |
| **Custom data source** | Variable | Add git/API data | Requires code change |
| **Extract more fields** | 100ms | Richer graph | Breaking change if not backward compatible |
| **Strict validation** | 150ms | Ensure consistency | Invalid entries excluded |

**Recommendation**: Start with quick reseed, move to custom sources as needs grow.
