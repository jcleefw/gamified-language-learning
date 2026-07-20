# Plan: ADRs as a third node layer (`adr`), linked back into the ADR files

## Context

The graph today holds two node types — `domain` (a workspace folder) and `ryoiki` (a
`## heading` of durable knowledge). Stories/epics are provenance tags on ryoikis, not
nodes ("knowledge, not work"). An **ADR** is neither: it is the *decision / the why*. This
adds a third node type for it.

**Decisions locked during design discussion:**
1. **ADRs ingest as-is** — standalone decision nodes, no ryoiki-derivation, no required
   authoring. Most start *floating* (unlinked).
2. **The human links ADR→ryoiki manually** in the graph UI.
3. **The ADR file is the source of truth for its links.** `.graph-data.json` is a
   gitignored cache rebuilt from scratch, so a link drawn in the UI is **written back into
   the ADR markdown** (a `**Decides:**` field). Reset + rebuild reconstructs every link by
   re-reading the ADRs.
4. **ADR→ADR lineage is auto-parsed** from existing `**Status:** Superseded by […]` /
   `**Amended by:** […]` markdown links (best-effort).
5. **All ADRs in scope** — `engineering-*`, `infra-*`, `agentic-*`.
6. **No LLM on the ingest side** — deterministic bold-field parse only (stays true to
   EXTRACTION_PATTERNS.md's "no prose mining").

## Data model ([types.ts](../../src/types.ts))

- `NodeType`: add `'adr'`.
- `EdgeType`: add `'decides'` (adr → ryoiki/domain) and `'supersedes'` (adr → adr).
- ADR node `id`: `adr:<slug>` — filename minus leading `<timestamp>Z-` and `.md`
  (e.g. `adr:engineering-audio-playback-model`).
- ADR node `metadata`: `{ title, status, date, deciders, scope, decides[], content, path }`.

## The link field (source of truth), written into the ADR

```
**Decides:** apps/srs-demo#Routing, packages/db#Audio Assets
```

Comma-separated `domain#Ryoiki` targets; a bare `domain` targets the domain node. Absent
field ⇒ floating ADR. Matching reuses `normalizeRyoiki` from
[archive.ts](../../src/readers/archive.ts) so `#Routing` matches the ryoiki node id
case/hyphen-insensitively; an unmatched target draws no edge (stays floating).

## New reader: `src/readers/adr.ts`

Mirrors archive.ts/knowledge.ts:
- `ADR_RELATIVE_DIR = join('product-documentation','architecture')`.
- `findAdrFiles(root)` — `*.md` there, requiring a parseable `**Status:**` line (drops
  stray notes; skips `reference/`).
- `parseAdr(content, path)` → `{ slug, title, status, date, deciders, scope, content,
  decides[], supersedes[] }`. Bold-field regex; `supersedes[]` = slugs resolved from
  `Superseded by` / `Amended by` markdown links to other architecture `*.md`.
- `ingestAdrs(graph, root)` — add the `adr` node; `decides` edge to each **existing**
  ryoiki/domain node; `supersedes` edge to each `adr:<slug>`.

## Orchestration ([build-graph.ts](../../src/build-graph.ts))

Call `ingestAdrs(graph, root)` **after** `ingestKnowledge` (ryoiki nodes must exist first).

## Graph internals ([graph.ts](../../src/graph.ts))

`_countByType` add `adr: 0`.

## UI — "different shape" + drag-to-link ([server/ui.html](../../src/server/ui.html))

- Add CSS var `--adr` (distinct accent, off the teal ryoiki ramp) + `TYPE_COLOR.adr`.
- Node-draw: branch on `n.type === 'adr'` → **diamond** path instead of `ctx.arc`.
- Stroke encodes state: `Accepted` solid; `Superseded` hollow/dashed; floating (no outgoing
  `decides`) dotted = "decided, not built".
- Toolbar toggle "Link ADR": click ADR then ryoiki → POST `/api/link` (add), reload
  `/api/graph`. Right-click a `decides` edge → remove.
- `shortLabel` + legend + `#detail` panel: add `adr` cases; detail shows
  `status / date / deciders / decides[]`.

## Write-back endpoint ([server/serve.ts](../../src/server/serve.ts))

- `POST /api/link` `{ adrSlug, target, op:'add'|'remove' }` → locate ADR by slug, edit its
  `**Decides:**` field on disk (create under the header block if absent), rebuild
  (`buildGraph`), refresh module-level `graph`/`graphJSON`/`engine`, respond with new graph.
- Guard writes to `<root>/product-documentation/architecture/` only.
- Refresh the stale `SYSTEM_PROMPT` (still describes the old story/epic model) to the
  ryoiki-centric model + ADRs.

## Query engine ([query-engine.ts](../../src/query-engine.ts))

Extend the system prompt to describe `adr` nodes, the `decides` edge, `status` semantics,
and "a `decides`-less ADR is decided-but-unrealized." Add ADR `title/status/scope` to the
`searchNodes` corpus.

## Fixture + tests

- Fixture ADRs under
  `__fixtures__/two-axis-sample/product-documentation/architecture/` — one linked
  (`**Decides:** apps/srs-demo#Routing`), one floating with `**Status:** Superseded by […]`
  pointing at the first (covers linked + floating + lineage).
- [ryoiki-reader.test.ts](../../__tests__/unit/ryoiki-reader.test.ts): update the invariant
  `['ryoiki','domain']` → `['adr','ryoiki','domain']`; keep "NO story/epic nodes".
- New `__tests__/unit/adr-reader.test.ts`: `parseAdr` extracts status/decides/supersedes;
  `decides` edge to an existing ryoiki; unmatched `Decides` target stays floating;
  `supersedes` edge wires adr→adr.

## Dogfood

Amend the governing ADR
[20260718T094101Z-agentic-two-axis-knowledge-architecture.md](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md)
and the header notes in [types.ts](../../src/types.ts) + [ARCHITECTURE.md](../../ARCHITECTURE.md):
a third *decision* layer exists; links are human-curated in the ADR's `**Decides:**` field;
floating ADRs are intentional.

## Verification

1. `npm test` — new + updated unit tests pass.
2. `npm run typecheck` — widened unions compile (catches `_countByType`, exhaustive switches).
3. `npm run graph:build` — `nodesByType` includes `adr`; edges include `decides`/`supersedes`.
4. `npm run graph:ui` — ADRs render as diamonds; floating ADR visibly un-anchored; Link ADR
   writes `**Decides:**` into the `.md` on disk.
5. **Reset-safety:** delete `.graph-data.json`, rebuild, reload — the manual link survives
   (reconstructed from the ADR file).

## Build order

types → graph._countByType → readers/adr → build-graph → fixture → tests (verify backbone)
→ ui.html → serve.ts → query-engine → docs/amendment.
