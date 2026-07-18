# Extraction Patterns Reference

Exactly how each field of the two source artifacts becomes a node or edge. There
is **no regex mining of prose or file paths** — both sources are already
structured (JSON + fixed frontmatter), which is the point of the compaction ADRs.

## Source 1 — Time axis: `<root>/.agents/changelogs/archive/index.json`

Read by [`src/readers/archive.ts`](./src/readers/archive.ts). Shape:

```json
{ "stories": [ { ...story } ], "epics": { "EP44": { ...epic } } }
```

### `stories[]` → `story` node (+ edges)

| Field | Becomes |
| --- | --- |
| `id` | node id, e.g. `EP44-ST01` |
| `title` | part of `label` (`<id>: <title>`) |
| `epic` | edge **`epic --contains--> story`** |
| `track` | metadata; drives the `tracks` filter |
| `domain` | metadata (the `touches` target when a domain node exists) |
| `concern`, `completed`, `duration`, `summary`, `pr`, `compact_pr` | metadata (searchable / rendered in query context) |
| `supersedes[]` | edge **`story --supersedes--> story`** (only within the included slice) |
| `fixes[]` | edge **`story --fixes--> epic\|story`** |

### `epics{}` → `epic` node

Only epics **referenced by an included story** (via `epic` or `fixes`) are
materialized — an epic is an edge target, never a standalone grouping.

| Field | Becomes |
| --- | --- |
| key (`EP44`) | node id |
| `title` | part of `label` |
| `domains[]`, `archived`, `notes` | metadata |

A `fixes`/`contains` target epic with no included story is still materialized as a
minimal placeholder node so the edge never dangles.

## Source 2 — Domain axis: `<root>/{apps,packages}/<unit>/KNOWLEDGE.md`

Read by [`src/readers/knowledge.ts`](./src/readers/knowledge.ts). The reader walks
`root` recursively, skipping `node_modules`, `.git`, `.agents`, `dist`,
`coverage`, `__fixtures__`, and dotfolders, collecting every `KNOWLEDGE.md`.

### Frontmatter (fixed shape, D5) → `domain` node

```yaml
---
unit: apps/srs-demo
sources: [EP44]
updated: 2026-07-19
---
```

| Field | Becomes |
| --- | --- |
| `unit` | domain **node id** — identity is the frontmatter, *not* the disk path |
| `updated` | metadata |
| `sources[]` | edge **`domain --sources--> story\|epic`** (provenance; skipped if the target isn't in the graph slice) |

`parseKnowledge()` is a deliberately minimal frontmatter parser (scalars + `[a, b]`
lists) — not a full YAML engine, because the shape is fixed by the ADR.

### Level-2 headings (`## ...`) → `concern` nodes

Each `## Heading` becomes a `concern` node id `<unit>#<heading>` with edge
**`concern --about--> domain`**. Body prose is *not* parsed into the graph — it's
the human-readable layer; the graph indexes structure, not sentences.

## Why order matters

`buildGraph` runs the archive reader **first**, then the knowledge reader, so the
story/epic nodes already exist when `sources` provenance edges are wired to them.
The knowledge reader only creates a `sources` edge to a node that exists.

## Adding a field

Because the sources are structured, "adding a field" means: add it to the archive
schema (`.agents/changelogs/archive/schema.json`) or the KNOWLEDGE.md frontmatter,
then surface it in the relevant reader's `metadata` object (or as a new edge).
Keep changes reader-side and reflected in
[`__tests__/unit/two-axis-reader.test.ts`](./__tests__/unit/two-axis-reader.test.ts).
