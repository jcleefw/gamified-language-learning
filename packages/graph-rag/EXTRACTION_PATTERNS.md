# Extraction Patterns Reference

Exactly how each field of the source artifacts becomes a node, edge, or
provenance stamp. There is **no regex mining of prose or file paths** — both
sources are already structured (JSON + fixed frontmatter), which is the point of
the compaction ADRs.

The graph portrays **knowledge, not work**: nodes are domains and concerns.
Stories/epics are folded into provenance metadata, never nodes.

## Source 1 — Knowledge: `<root>/{apps,packages}/<unit>/KNOWLEDGE.md`

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
| `sources[]` | metadata (domain-level provenance reference) |

### Level-2 headings (`## ...`) + their prose → `concern` node

Each `## Heading` becomes a `concern` node id `<unit>#<heading>`, with:

| Piece | Becomes |
| --- | --- |
| heading text | `metadata.concern` + part of the label |
| prose beneath the heading (up to the next `##`) | `metadata.content` — the durable knowledge |
| provenance (from Source 2) | `metadata.sources` / `epics` / `prs` |

And one edge: **`domain --contains--> concern`**.

`parseKnowledge()` is a deliberately minimal parser (frontmatter scalars + `[a, b]`
lists, `##` section splitting) — not a full YAML/Markdown engine, because the
shape is fixed by the ADR.

## Source 2 — Provenance: `<root>/.agents/changelogs/archive/index.json`

Read by [`src/readers/archive.ts`](./src/readers/archive.ts). **It produces no
nodes.** `buildProvenanceIndex()` folds the stories into an index:

```json
{ "stories": [ { "id": "EP44-ST01", "domain": "apps/srs-demo", "concern": "routing", "epic": "EP44", "pr": 41 } ], "epics": { ... } }
```

| Field | Used for |
| --- | --- |
| `domain` + `concern` | the index key (see matching below) |
| `id` | added to that concern's `sources[]` |
| `epic` | added to `epics[]`, and recorded in `epicSpan` (drives `relates`) |
| `pr` | added to `prs[]` |
| `track` | honored by the `tracks` filter |

A story with no `domain`/`concern`, or whose concern has no matching
`KNOWLEDGE.md`, contributes nothing — it never appears in the graph.

### Concern matching

Story `concern` is a slug (`app-shell`); a heading is a title (`App Shell`).
`normalizeConcern()` folds both (lowercase, strip non-alphanumerics) and
`concernKey(domain, concern)` joins them with the domain, so
`apps/srs-demo · app-shell` and `apps/srs-demo · App Shell` collide correctly.

### `relates` edges (concern → concern)

From `epicSpan`: for each epic, the concerns it produced that live in **different
domains** are linked pairwise with a `relates` edge labeled `via <epicId>` —
"these co-evolved in one unit of work". Same-domain concerns are skipped (already
grouped by their shared domain node).

## Why order matters

`buildGraph` builds the provenance index **first**, then hands it to the knowledge
reader, so every concern is stamped with its provenance as it's created and the
`relates` pass can resolve co-evolved concerns to real nodes.

## Adding a field

Because the sources are structured, "adding a field" means: add it to the archive
schema (`.agents/changelogs/archive/schema.json`) or the `KNOWLEDGE.md`
frontmatter, then surface it in the relevant reader's `metadata` object (or as a
new edge). Keep changes reader-side and reflected in
[`__tests__/unit/concern-reader.test.ts`](./__tests__/unit/concern-reader.test.ts).
