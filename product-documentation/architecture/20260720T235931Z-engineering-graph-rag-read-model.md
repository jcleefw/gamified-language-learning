# ADR: Graph RAG Read Model — Node Model, Kettei Layer, Ryoiki Filtering, and Alias Resolution

**Status:** Proposed

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->
<!-- For amendments, use "Accepted (amended)" and add an Amended-by line below. -->

**Date:** 2026-07-20 <!-- Run .agents/tools/generate-timestamp.sh for the file-name timestamp -->

**Deciders:** JC Lee / PO

**Epic:** N/A

**RFC:** N/A

**Superseded by:** N/A

---

## Context

Graph RAG (`packages/graph-rag`) builds a knowledge graph from the two compacted
artifacts the [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md)
defines — the archive (`.agents/changelogs/archive/index.json`) and each unit's
`KNOWLEDGE.md` — and reads the ryoiki artifacts
[AGN06 (Package-Scoped Knowledge Filtering)](20260718T213334Z-agentic-package-scoped-knowledge-filtering.md)
authored at write time. It is a **reader-only, isolated** package: it reads those
artifacts, never writes them (except the ADR `**Decides:**` write-back in D2), and
nothing else in the repo depends on it.

This decision was made **after** a spike build explored the package and pivoted twice
in the process: episode-grouped → two-axis → concern-centric. The spike itself carries
no standing architecture — nothing it produced is decided until written down here. This
ADR is what that review settled, in one place:

- The node/edge model (D1), the decision-node layer (D2), and the decision to name that
  node type `kettei` rather than `adr` (D3) are decided here for the first time; nothing
  prior held ADR status for them.
- The Two-Axis ADR's **D7** ("Graph RAG projection") — marked from the start as an
  _intention, not a commitment to any package_, and already amended once (2026-07-19)
  for the concern-centric pivot — is superseded in substance by D1 here; the D7 clause
  stays in the Two-Axis ADR as historical record.
- The reader-only scope and isolation guarantees below (**Scope**, **Consequences**) are
  likewise decided here for the first time.

AGN06 §"Deferred" and §"Related" explicitly hand read-time consumption of the ryoiki
blacklist, alias map, and slash-path hierarchy to **"Graph RAG's own ADR."** This is
that ADR, so those decisions (D5–D7) are Graph RAG's to make.

Two concrete problems forced the read-time filtering decisions:

1. **Naming drift breaks the join.** The archive tags each story with a ryoiki;
   `KNOWLEDGE.md` names the same aspect as a heading. The two are matched by a
   normalized key (`readers/archive.ts` `normalizeRyoiki`). Normalization heals case and
   punctuation (`app-shell` ↔ `App Shell`) but not _synonyms_: a story tagged `fsrs` or
   `nav` silently fails to attach to the `spaced-repetition` or `Routing` heading it
   belongs to. Provenance goes missing with no error.
2. **Blacklisted ryoiki must not appear as knowledge.** AGN06's blacklist keeps noise
   (build tooling, type definitions, scaffolding) out of `KNOWLEDGE.md` at write time — a
   lossy projection (AGN06 D9). A read consumer that ignores the blacklist could still
   surface a blacklisted aspect as a node if it ever leaked into a heading. The PO's
   instruction is direct: blacklisted ryoiki must never be added to the graph.

And one problem forced the ingestion decision (D4): ingesting every ADR at once renders
the graph as a scatter of unlinked "floating" diamonds — decisions with no drawn
`decides` edge because no human has authored the link yet. That is UI clutter, not a
knowledge map.

## Decision

### D1 — Three node types, four edge types; the graph portrays knowledge, not work

The graph is a list of **nodes** and a list of **edges** (`.graph-data.json`, a
gitignored cache — never hand-edited, always rebuilt). There are **three node types**:

| Node     | Source                                                  | Represents                                                                                                                                              |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain` | `KNOWLEDGE.md` `unit:` frontmatter                      | a workspace unit (`apps/*`, `packages/*`) — a bucket that groups ryoiki                                                                                 |
| `ryoiki` | each `##` heading in `KNOWLEDGE.md`                     | a named area of knowledge; the prose beneath the heading is `metadata.content` (durable knowledge, carried verbatim, never re-mined into more nodes)    |
| `kettei` | each `*.md` under `product-documentation/architecture/` | an architecture **decision** — the _why_ behind one or more ryoiki (named `kettei`, not `adr` — see D3)                                                 |

**Stories and epics are NOT nodes.** They are demoted to provenance **metadata** on each
ryoiki (`sources` = story ids, `epics`, `prs`), derived by folding the archive into an
index keyed by `(domain, ryoiki)`. "What produced this knowledge?" is answered from
metadata; the work is a citation, never the skeleton. This is the concern-centric model
that revised Two-Axis D7: an epic is a unit of _work in time_, not of _knowledge_, so
making it (even as an edge target) a node reintroduced the fragmentation the Two-Axis ADR
exists to kill. Demoting work out of the node set entirely makes that bug structurally
impossible.

**Four edge types**, all the same four-field shape (`from`, `to`, `type`, `label`):

| Edge         | From → To                | Meaning                                                                                                                                                |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contains`   | `domain → ryoiki`        | this unit holds this area of knowledge (every ryoiki has exactly one)                                                                                  |
| `relates`    | `ryoiki → ryoiki`        | two ryoiki in _different_ domains co-evolved in one epic (labelled `via <epicId>`; same-domain ryoiki are already grouped by their shared domain node) |
| `decides`    | `kettei → ryoiki\|domain` | this decision governs that knowledge (D2)                                                                                                              |
| `supersedes` | `kettei → kettei`        | this newer decision replaces/amends an older one (D2)                                                                                                   |

Dropped entirely from the earlier, pre-pivot model: `story`/`epic`/`component` nodes,
`modified`/`touches`/`sources` edges, and any `file:line` mining — the graph never
duplicates what git records (Two-Axis D6).

### D2 — The kettei node layer: `**Decides:**` is the human-authored link, source of truth

ADRs ingest **as-is** — deterministic bold-field parse (`**Status:**`, `**Date:**`, …),
no prose mining, no LLM. A kettei node is `kettei:<slug>` (filename minus the
`<timestamp>Z-` prefix and `.md`), carrying
`{ status, date, deciders, scope, decides[], content, path }`.

A kettei node connects into the rest of the graph through two edges:

- **`decides` — authored by a human, stored in the ADR file.** The `**Decides:**` field
  holds comma-separated `domain#Ryoiki` targets (a bare `domain` targets the domain
  node). The reader resolves each target against existing nodes and draws a `decides`
  edge. **The ADR file is the source of truth** — `.graph-data.json` is a rebuilt cache,
  so reset + rebuild reconstructs every link by re-reading the ADRs. The UI's _Link ADR_
  action (`POST /api/link`, `server/serve.ts`) is a convenience editor that writes the
  `**Decides:**` field back to disk; it is **not** how a kettei enters scope (see D4).
- **`supersedes` — auto-parsed, best-effort.** The reader spots `Superseded by` /
  `Amended by` markdown links in the header block and draws `newer → older` edges. Not
  human-authored.

Resolution reuses the alias canonicalization of D6, so a `**Decides:** apps/srs-demo#nav`
target resolves to the `Routing` node.

### D3 — The decision node type is named `kettei`, not `adr`

The graph's node-type identifier for a decision is **`kettei`** (決定, Japanese for
"decision"), not `adr`. This is the same naming problem AGN06 solved for `concern` →
`ryoiki`: `adr`/"ADR" already has a fixed, universal meaning in this repo — the markdown
documents under `product-documentation/architecture/`. Using that same word as the
graph's internal node-type value conflates two different things: the source document and
the graph node that represents a decision extracted from it. A unique term removes the
ambiguity, exactly as `ryoiki` did for the within-unit knowledge axis.

Only the graph's internal identifier changes — the node `type` field (`'adr'` →
`'kettei'`) and the node `id` prefix (`adr:<slug>` → `kettei:<slug>`). Everything else
keeps its existing name: the source documents are still called ADRs, the `**Decides:**`
field name, the `decides`/`supersedes` edge types, and the `product-documentation/architecture/`
file-naming convention are all unaffected. A `kettei` node is simply what an ADR file
*becomes* once it is read into the graph — the same relationship `ryoiki` has to a
`KNOWLEDGE.md` heading.

Code implementing D1/D2 (`src/types.ts`'s `NodeType`, `src/readers/adr.ts`'s node-id
construction) is written to this naming from the start; there is no prior `adr`-typed
code to migrate.

### D4 — kettei ingestion is link-before-ingest; nothing ever enters the graph floating

An ADR's kettei node enters the graph only when **both** are true:

1. its `**Decides:**` field is hand-authored against a ryoiki/domain node that **already
   exists** in the graph, and
2. its filename or slug is added to `.graph-rag-config.json`'s `adrs.files` allowlist.

The config default is `adrs.include: false`; the allowlist grows only by deliberate edit.
So every kettei that enters the graph enters **already linked** — there are no floating
diamonds, which is the UI clutter this decision exists to prevent. The ~45 existing ADRs
under `product-documentation/architecture/` stay **out of scope indefinitely**; growing
coverage is a one-at-a-time curatorial act (link it, then allowlist it), never a bulk
ingest. This mirrors how the rest of the graph accretes — deliberately, per real need,
never big-bang backfilled.

This supersedes the pre-pivot plan's stance (all ADRs in scope, most floating, linked
later in the UI): that produced exactly the scatter of unlinked diamonds we are avoiding.

### D5 — Blacklisted ryoiki never become nodes; a blacklisted heading is a loud anomaly

`buildGraph` loads `ryoiki-blacklist.json` for the graph's root
(`readers/ryoiki-config.ts`). When ingesting a `KNOWLEDGE.md` heading, a ryoiki matched by
the blacklist is **skipped** — no node, no `contains` edge, no provenance stamp, no
participation in `relates`.

The match merges the reserved global `"*"` list with the unit's own list and cascades
**longest-prefix-wins on the slash path** (AGN06 D6): an entry drops itself and every
`entry/…` descendant. Each path segment is normalized the way the provenance key is (so
`type-definitions` catches a `Type Definitions` heading), while the slashes that drive the
cascade are preserved.

Because a blacklisted ryoiki is a **write-time** exclusion, it should never have been
written as a heading. So its presence in a `KNOWLEDGE.md` is an authoring anomaly: Graph
RAG **warns loudly** (`console.warn`, naming the unit and heading) and then skips it —
neither silently dropped nor silently written.

### D6 — Ryoiki are canonicalized through the alias map at every join

`buildGraph` loads `ryoiki-aliases.json` and exposes `canonicalize(name)` that folds a
drift variant to its canonical spelling (returning the name unchanged when there is no
entry — the map never rejects, per AGN06 D2). Canonicalization is applied wherever a
ryoiki name becomes a match key:

- the **archive → heading provenance join** (`buildProvenanceIndex`),
- the **KNOWLEDGE.md heading** side of that same join (`ingestKnowledge`),
- the **ADR `**Decides:**` target** resolution (`readers/adr.ts`), so `apps/srs-demo#nav`
  resolves to the `Routing` node.

The node's **label stays the literal heading text**; canonicalization affects only the
match key, never what is displayed.

### D7 — Slash-path hierarchy is NOT expanded into parent-child edges (deferred)

AGN06's third deferred item — turning `a/b/c` ryoiki paths into `parent → child` graph
edges — is **not** built here. The slash path is used only by the D5 blacklist cascade.
All current ryoiki are single-segment, so there is nothing to expand yet; revisit when
multi-segment ryoiki appear.

## Scope

**In scope (reader-only):** the node/edge model above; the two readers (archive JSON +
`KNOWLEDGE.md` frontmatter) plus the ADR reader; ryoiki blacklist/alias filtering; the
keyword/traversal query engine; the local `graph:ui` explorer and its `**Decides:**`
write-back.

**Out of scope (explicitly):**

- **Backfill** of the legacy changelogs — separate track, not this package's job.
- The **`archive-check` validator** — stays the separate `.agents/tools/` script the
  Two-Axis ADR specifies; this package is reader-only.
- **Mining git / file paths** — the graph never duplicates what git records (Two-Axis D6).
- Embeddings / semantic retrieval as a committed direction — deferred until real query
  patterns are known.

**Isolation guarantees:** all code stays under `packages/graph-rag/`; it reads the
archive, `**/KNOWLEDGE.md`, `.agents/reference/*`, and the ADRs read-only (the only write
is the D2 `**Decides:**` write-back, guarded to
`<root>/product-documentation/architecture/`); no other package imports from it; the
output cache (`.graph-data.json`) is gitignored.

## Rationale

- **Knowledge, not work (D1).** Grouping by workspace `domain` and demoting stories/epics
  to metadata is the smallest model that makes the epic-fragmentation bug structurally
  impossible while still answering "what produced this?"
- **The ADR file as source of truth (D2).** Keeping the link in the ADR, not the cache,
  means a wipe-and-rebuild is lossless and the human's curation is durable.
- **A unique node-type name (D3).** `adr` colliding with the repo's existing meaning of
  "ADR" is the same overloading problem `concern` had; `kettei` removes it the same way
  `ryoiki` did, without renaming anything about the source documents themselves.
- **Link-before-ingest (D4).** Scope is declared where the human already works (the ADR's
  `**Decides:**` field + one config line), and the graph never accumulates decisions it
  can't place — the clutter never forms in the first place.
- **Filter at the heading-ingest boundary (D5).** It is the single choke point where every
  node is born, so one guard covers all node creation. Warning rather than silently
  skipping honors the PO's point that a blacklisted heading "should never be there."
- **Alias at the join (D6).** The alias map is exactly the drift-healing mechanism AGN06
  curated; using it at the join is the smallest change that stops provenance silently
  going missing.
- **Defer hierarchy (D7).** Keeps the graph honest to the data that exists (flat,
  single-segment ryoiki) instead of speculative structure with no consumer.

## Alternatives Considered

| Option                                                                             | Pros                                                 | Cons                                                                                                          | Why Not Chosen                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Story/epic as first-class nodes (original D7)                                      | A literal timeline in the graph                      | Work items dominate; the EP44 sample was mostly `EP44-ST0x` nodes — an episode breakdown, not a knowledge map | Demote work to metadata (D1); the graph portrays knowledge               |
| Keep the node type named `adr`                                                      | No new vocabulary to learn                           | Collides with "ADR" already meaning the source document repo-wide — same overloading `concern` had           | Rename to `kettei` (D3), a unique term with no prior repo meaning         |
| Ingest all ADRs, link later in the UI                                              | Zero config; every decision visible at once          | A scatter of unlinked floating diamonds — the exact UI clutter to avoid                                       | Link-before-ingest (D4): nothing floats                                  |
| Predictive pre-linking — author `**Decides:**` against a ryoiki _before_ it exists | An ADR un-floats automatically when its ryoiki lands | Depends on guessing the future heading name; drift silently never resolves, with no error signal              | Link-before-ingest (D4): no error mode, link only against existing nodes |
| `status`-based ingest filter (only `Accepted` ADRs enter)                          | Scope declared in the ADR, no allowlist              | Solves scoping but not linking — accepted ADRs still enter unlinked and float                                 | Doesn't address the clutter; D4 gates on the link, not the status        |
| Normalize-only join (no alias map)                                                 | Simplest; no config to load                          | Synonyms silently miss; provenance quietly incomplete                                                         | Reintroduces the exact drift AGN06's map exists to heal (D6)             |
| Silently skip blacklisted headings                                                 | Least noise                                          | Hides an authoring anomaly the PO wants surfaced                                                              | Warn-then-skip (D5)                                                      |
| Expand slash paths into parent/child edges now                                     | Future-proofs hierarchy                              | No multi-segment ryoiki exist; speculative                                                                    | Deferred until there is data and a consumer (D7)                         |

## Consequences

**Positive:**

- One document owns Graph RAG's architecture on its own authority, standing without
  dependence on any prior exploratory material.
- The graph groups by real code units and cannot re-introduce epic fragmentation.
- The decision node type has a name that cannot be confused with the ADR documents it is
  built from.
- The provenance join survives naming drift; blacklisted ryoiki are guaranteed out of the
  graph, with a visible signal when one was wrongly written.
- Kettei scope is deliberate and never cluttered — every diamond in the graph is a linked,
  in-scope decision.
- Graph RAG stays a pure read consumer of the Two-Axis and AGN06 artifacts — no reshaping
  of what they authored.

**Negative / Risks:**

- Growing kettei coverage is manual (hand-link + allowlist per ADR); the ~45 existing
  ADRs stay invisible to the graph until someone deliberately brings each in.
- Canonicalization is whole-string (single-segment); a multi-segment ryoiki whose leading
  segment is an alias is not folded until D7 is revisited.
- The blacklist and alias files are read from `<root>/.agents/reference`; a graph built
  against a root without them degrades to include-everything (by design, but worth knowing
  when a build looks unexpectedly unfiltered).

**Neutral:**

- The alias map affects only match keys, so display labels are unchanged.
- The `/api/link` write-back still works as a convenience editor for in-scope ADRs; it no
  longer gates what enters the graph — the config allowlist does (D4).

## Related

- ADR: [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md)
  — the two-axis model (domain × ryoiki) this graph reads; its **D7** is the forward-looking
  projection whose live substance is consolidated here.
- ADR: [Package-Scoped Knowledge Filtering (AGN06)](20260718T213334Z-agentic-package-scoped-knowledge-filtering.md)
  — defines ryoiki, the blacklist, and the alias map, and defers their read-time
  consumption to this ADR (D5–D7); its D1 (`concern` → `ryoiki`) is the precedent D3 follows.
- Package docs: `packages/graph-rag/ARCHITECTURE.md` (build pipeline),
  `EXTRACTION_PATTERNS.md` (field-by-field mapping), `docs/graph-model-explained.md`
  (conceptual primer), `RESEED_GUIDE.md` (rebuild runbook) — the mechanics this ADR
  governs.
