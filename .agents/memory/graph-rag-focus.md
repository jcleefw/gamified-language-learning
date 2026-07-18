---
name: graph-rag-focus
description: Current focus on Graph RAG learning and implementation
metadata:
  type: project
---

# Current Focus: Graph RAG - Configurable Knowledge Graph

**Status**: ✅ Complete POC with full user control  
**Started**: 2026-07-17  
**Updated**: 2026-07-18

## What We're Learning

Understanding how to build intelligent retrieval systems by combining:
- **Structured knowledge graphs** (explicit relationships between entities)
- **LLM reasoning** (semantic understanding of context)
- **User control** (dictate what data matters)

This teaches a critical pattern: *better retrieval → better reasoning → better AI applications*.

## Current Goal

Build a configurable knowledge graph of how the gamified language learning platform was built, so we can ask questions like:
- "How did the SRS engine evolve?"
- "What design decisions led to batch composition?"
- "Show me the dependency chain from quiz runner to foundation"

## Key Insight: User-Controlled Ingestion

Instead of automatic ingestion of all `.agents/` data, allow users to:
1. **Choose what to ingest** (all episodes, specific range, custom sources)
2. **Choose what fields to extract** (problems, decisions, tradeoffs, etc.)
3. **Validate quality** (check for circular deps, orphaned nodes)
4. **Document focus** (track why we're building this, what we care about)

## Configuration

Stored in: `packages/graph-rag/.graph-rag-config.yaml`

Controls:
- Which episodes to include (all, range, specific)
- Which data sources (epics, changelogs, git, custom APIs)
- Which fields to extract (problems, dependencies, files, lessons, decisions)
- Validation rules
- Output format

## Data Pipeline (Current)

```
.agents/plans/epics/*.md  ──┐
.agents/changelogs/*/*.md ──┼──> DataIngestion (respects .graph-rag-config.yaml)
                            │    ├─ Filter by config
[optional] git history ─────┼─→  ├─ Extract fields
[optional] APIs ────────────┘    ├─ Deduplicate
                                 ├─ Validate
                                 └─ Save .graph-data.json
```

## What's Implemented

✅ **Core Graph Engine**
  - ProjectGraph class with traversal & path-finding
  - In-memory representation with Maps + deduplication
  - Serialization to JSON

✅ **Configurable Ingestion (User-Controlled)**
  - `.graph-rag-config.json` file controls what to ingest
  - Filter by episode range: `[[30, 44]]` for recent work
  - Filter by specific episodes: `[1, 2, 3, 7]` for deep dive
  - Toggle sources: epics/changelogs/git/custom
  - Toggle extraction fields: problems, dependencies, stories, specs, files
  - Document focus: title, description, tracking of what you're learning

✅ **Two Ingestion Modes**
  - `pnpm ingest` - Fixed ingestion (all data)
  - `pnpm ingest:config` - Configuration-driven (what you dictate)

✅ **LLM-Powered Querying**
  - QueryEngine with Claude API integration
  - Context extraction from graph subgraphs
  - Semantic reasoning over relationships

✅ **Full TypeScript Implementation**
  - Type-safe APIs in `src/types.ts`
  - Complete documentation (ARCHITECTURE.md, EXTRACTION_PATTERNS.md, RESEED_GUIDE.md)
  - Tests (Vitest, 5 passing)
  - CLI tools for ingestion and querying

✅ **Documentation in Memory**
  - `.agents/memory/graph-rag-focus.md` (this file)
  - Tracks learning goals and focus  

## What's Next (Optional Extensions)

- [ ] Implement custom field extraction (decisions, tradeoffs, lessons)
  - Update markdown: add `## Key Decisions` section
  - Update config: add custom_fields
  - Re-ingest: `pnpm ingest:config`

- [ ] Add git history ingestion
  - Parse `git log` for commits mentioning "EP"
  - Create commit nodes linked to episodes
  - Track implementation timeline

- [ ] Add validation CLI
  - Check for circular dependencies
  - Detect orphaned nodes
  - Verify epic/changelog sync

- [ ] Build web UI for graph exploration
  - Interactive graph visualization (D3/Cytoscape)
  - Search across all nodes
  - Display relationship chains

- [ ] API endpoint for app integration
  - `GET /api/project-history?q=...` 
  - Returns LLM answer + graph context
  - Embed in another package (server, web, docs)

## How to Use Configuration

**Edit**: `packages/graph-rag/.graph-rag-config.json`

**Quick Start:**
```bash
# Ingest with your configuration
pnpm --filter @gll/graph-rag ingest:config

# Output shows your focus
📝 Focus: Graph RAG POC - Learn how project was built
   Understanding project development history...
```

**Example 1: Only Recent Episodes (EP30-EP44)**
```json
{
  "sources": {
    "epics": { "filter": { "episodes": [[30, 44]] } },
    "changelogs": { "filter": { "episodes": [[30, 44]] } }
  }
}
```
Result: 89 nodes instead of 229, 40ms instead of 100ms

**Example 2: Specific Episodes (Foundation Only)**
```json
{
  "sources": {
    "epics": { "filter": { "episodes": [1, 2, 3, 7] } }
  }
}
```
Result: Deep dive into monorepo → SRS → orchestrator chain

**Example 3: Document Your Focus**
```json
{
  "focus": {
    "title": "SRS Engine Evolution",
    "description": "How did batch composition develop from EP02→EP07→EP20?",
    "updated_at": "2026-07-18"
  }
}
```
Your learning goal is saved and shown during ingestion

**Example 4: Plans Only (No Implementation Details)**
```json
{
  "sources": {
    "epics": { "enabled": true },
    "changelogs": { "enabled": false }
  }
}
```
Result: 37 episode nodes (high-level overview)

**Example 3: Include git history**
```yaml
sources:
  git:
    enabled: true
```
Then: `pnpm ingest` (will parse commits)

## Why This Matters

Most RAG systems are "black boxes" - you feed data in, get results out, but don't understand:
- What was actually retrieved?
- Why was that relevant?
- What did we miss?

**Graph RAG with configuration makes it transparent:**
- You decide what's in the graph
- You can inspect the subgraph for a query
- You understand what the LLM is reasoning about

This is the difference between "AI that works" and "AI you trust".

## Files & Resources

- `packages/graph-rag/src/ingestion.ts` - Current ingestion (needs config support)
- `packages/graph-rag/.graph-rag-config.yaml` - Configuration (controls what to ingest)
- `packages/graph-rag/ARCHITECTURE.md` - Complete pipeline docs
- `packages/graph-rag/EXTRACTION_PATTERNS.md` - How data is parsed
- `packages/graph-rag/RESEED_GUIDE.md` - Examples of customizing ingestion

## Related Learnings

[[graph-rag-poc]] - Initial POC setup (completed)

## Next Session

When resuming: Check if user wants to:
1. Make ingestion config-driven (respect .graph-rag-config.yaml)
2. Add custom field extraction (decisions, problems, tradeoffs)
3. Build web UI or API endpoint
4. Integrate with another package (server, web app)

Ask: "What aspect of the graph matters most to you?"
