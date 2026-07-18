# Reseeding Guide

The graph is a **cache** of the two source artifacts. Rebuilding is deterministic:
same artifacts in → same `.graph-data.json` out. There is no incremental merge and
no hand-editing.

## Rebuild

```bash
pnpm --filter @gll/graph-rag graph:build
```

Reads `.graph-rag-config.json`, builds the graph, writes `.graph-data.json`
(gitignored). Delete the JSON first if you like — the build overwrites it anyway.

## The graph accretes for free

You do **not** author graph data. It grows automatically as the repo's knowledge
compacts: each time the `archive-epic` skill records an epic, it appends stories to
`.agents/changelogs/archive/index.json` and maintains the touched
`{apps,packages}/<unit>/KNOWLEDGE.md`. The next `graph:build` picks that up. If you
want the graph to reflect new information, it must exist in those two artifacts
first — never edit `.graph-data.json` by hand.

## Point at a different root

`root` (in config, or `--root=` on the CLI) selects what the readers mount:

```bash
# the frozen EP44 sample fixture (the config default)
pnpm --filter @gll/graph-rag graph:build

# the live repo, once epics start compacting
pnpm --filter @gll/graph-rag graph:build -- --root=.
```

A `KNOWLEDGE.md`'s true unit is its `unit:` frontmatter, so a fixture under a
different disk path still yields correct domain ids.

## Scope the graph

Filter by the axes the archive actually carries — **track** and **domain**, never
episode range (the old epic-grouped model is gone). In `.graph-rag-config.json`:

```json
{ "filter": { "tracks": ["project"], "domains": ["apps/srs-demo"] } }
```

- `tracks`: keep only these tracks (`['project']` drops `agentic`, etc.).
- `domains`: keep only these workspace units on both axes.
- `null` = no filter.

Or programmatically:

```typescript
import { buildGraph } from '@gll/graph-rag';
const graph = buildGraph('.', { tracks: ['project'] });
```

## Verify

```bash
pnpm --filter @gll/graph-rag test        # asserts the ADR invariants
pnpm --filter @gll/graph-rag graph:query # prints extracted context for a sample query
```

Or inspect directly:

```bash
jq '.summary' packages/graph-rag/.graph-data.json
jq '.nodes[] | select(.type=="domain") | .id' packages/graph-rag/.graph-data.json
```

## What you cannot do here (by design)

- **Backfill legacy changelogs** — separate track, not this package's job.
- **Validate the archive** — that's the `.agents/tools/archive-check.sh` script the
  ADR specifies; this package is reader-only.
- **Mine git / file paths** — the graph never duplicates what git records (D6).
