# The Graph Model, Explained

A plain-language primer on how graph-rag's graph is actually built out of **nodes** and
**edges** — what the objects look like, where each one comes from, and how they connect.

This is the *conceptual* doc. For the build pipeline see
[ARCHITECTURE.md](../ARCHITECTURE.md); for the exact field-by-field mapping from source
files see [EXTRACTION_PATTERNS.md](../EXTRACTION_PATTERNS.md). The three form a set — start
here, then go to those for the mechanics.

Every example below uses real data from the project (`apps/srs-demo`, the `Routing`
ryoiki, `EP44`).

---

## What a node is

The whole graph is just two lists in one JSON file (`.graph-data.json`): a list of
**nodes** and a list of **edges**. Every node has the same four fields:

```json
{
  "id":    "apps/srs-demo#Routing",     // unique name — how edges point at it
  "type":  "ryoiki",                    // which KIND of node (the important part)
  "label": "apps/srs-demo · Routing",    // the human-readable caption on screen
  "metadata": { ... }                    // everything else hangs in here
}
```

The `type` field is the whole game. There are **three** types: `domain` and `ryoiki`
(the knowledge) and `adr` (the decisions). Here they are, one at a time.

---

## Node type 1 of 3 — `domain`

**What it represents:** one workspace unit — a folder under `apps/` or `packages/`. Think
of it as a *bucket*, not knowledge itself. It's the thing that groups other nodes.

**A real one:**

```json
{
  "id": "apps/srs-demo",
  "type": "domain",
  "label": "apps/srs-demo",
  "metadata": { "unit": "apps/srs-demo", "updated": "2026-07-19", "sources": ["EP44"] }
}
```

**Where it comes from:** each `KNOWLEDGE.md` file opens with a frontmatter header:

```
---
unit: apps/srs-demo
sources: [EP44]
updated: 2026-07-19
---
```

The reader turns that `unit:` line into **one domain node**. One `KNOWLEDGE.md` → one
domain node. So you have as many domain nodes as you have documented workspace units.

In the UI, domain nodes are drawn a little bigger — they're the anchors everything else
clusters around.

---

## Node type 2 of 3 — `ryoiki`

**What it represents:** one *named area of knowledge* inside a domain — "how routing
works," "how batch composition works." This is the actual **knowledge** in the knowledge
graph. The domain is just the folder it lives in; the ryoiki is the substance.

**A real one:**

```json
{
  "id": "apps/srs-demo#Routing",
  "type": "ryoiki",
  "label": "apps/srs-demo · Routing",
  "metadata": {
    "ryoiki": "Routing",
    "unit": "apps/srs-demo",
    "content": "- Navigation is handled by Vue Router 4. ...",   // the actual prose
    "sources": ["EP44-ST01", "EP44-ST02", "EP44-ST03", "EP44-ST05"],
    "epics": ["EP44"],
    "prs": [41]
  }
}
```

**Where it comes from:** inside that same `KNOWLEDGE.md`, below the frontmatter, there are
`##` headings:

```
## Routing
- Navigation is handled by Vue Router 4...

## App Shell
- The boot sequence hydrates...
```

Each `## heading` becomes **one ryoiki node**. The heading text is the ryoiki's name;
**the prose underneath it, word for word, becomes `metadata.content`** — that's the durable
knowledge. The prose is stored *as-is*, never chopped into more nodes. (There is no layer
that reads those sentences and turns them into structure — the graph carries the prose
verbatim.)

**The `sources` / `epics` / `prs` tags:** notice the ryoiki also carries a list of story
IDs. That's **provenance** — "which work built this knowledge." It comes from a *different*
file, the archive index (`.agents/changelogs/archive/index.json`), and gets stamped onto
the ryoiki. Crucially, **stories and epics are NOT their own nodes** — they're just tags
on the ryoiki. That was deliberate: the graph shows *knowledge*, and work is only a
citation, never part of the skeleton.

---

## Node type 3 of 3 — `adr`

**What it represents:** an architecture **decision** — the *why*. A ryoiki says *how routing
works now*; an ADR says *why we chose Vue Router in the first place*. It's neither a folder
nor "how it works now," so it's a distinct third kind of node, drawn as a **diamond** (◇)
instead of a circle so you can tell a decision from realized knowledge at a glance.

**A real one:**

```json
{
  "id": "adr:engineering-routing-vue-router",
  "type": "adr",
  "label": "ADR: Routing via Vue Router 4",
  "metadata": {
    "slug": "engineering-routing-vue-router",
    "status": "Accepted",
    "date": "2026-07-14",
    "deciders": "PO (solo founder)",
    "scope": "How the srs-demo app navigates between screens.",
    "content": "## Context\nScreen-string routing had grown unwieldy...",
    "decides": ["apps/srs-demo#Routing"],
    "path": ".../20260714T100000Z-engineering-routing-vue-router.md"
  }
}
```

**Where it comes from:** each markdown file under `product-documentation/architecture/`.
Unlike `KNOWLEDGE.md`, ADRs use **bold fields**, not frontmatter — and every field is lifted
straight from the file, never interpreted from prose:

| Field | Source in the `.md` file |
| --- | --- |
| `id` | `adr:` + the filename minus its timestamp prefix and `.md` |
| `label` | the first `# ` heading line |
| `slug` | the id without the `adr:` prefix (used to find the file for write-backs) |
| `status` | first word of `**Status:**` (`Accepted`, `Superseded`, `Proposed`…) |
| `date` / `deciders` / `scope` | the matching `**…:**` bold fields |
| `content` | the prose body after the `---`, stored **verbatim** (for search/detail) |
| `decides` | the `**Decides:**` field, split on commas — **this is the link** |

Compare it to a ryoiki: a ryoiki's `content` is the *substance*; an ADR's fields are *about
a decision* — who decided, when, its status, and what it governs. Different shape of object
because it's a different kind of thing.

---

## The connector — the `edge` object

Nodes don't contain their connections. The connections live in a **separate list** — the
edges — and reference nodes by `id`. Here's the object that joins the two nodes above:

```json
{
  "from":  "apps/srs-demo",           // the domain node's id
  "to":    "apps/srs-demo#Routing",   // the ryoiki node's id
  "type":  "contains",
  "label": "contains"
}
```

That's the whole object — just four fields.

**How it hooks the two together:** the glue is the **`id` string**. The edge's `from` is a
copy of the domain node's id; `to` is a copy of the ryoiki node's id. There's no pointer
or nesting — it's literally string-matching. When the UI draws the graph, it walks the edge
list and, for each edge, looks up `from` and `to` in the node list to know which two dots
to connect with a line.

**Field by field:**

| Field | Meaning |
| --- | --- |
| `from` | id of the node the arrow starts at (here, the domain) |
| `to` | id of the node the arrow points to (here, the ryoiki) |
| `type` | which *kind* of relationship (`contains`, `relates`, `decides`, `supersedes`) |
| `label` | the caption drawn on the line |

**Direction matters.** `apps/srs-demo → apps/srs-demo#Routing` reads "domain *contains*
ryoiki," not the reverse. Every ryoiki gets exactly one `contains` edge pointing down
into it from its parent domain. So `apps/srs-demo` has one of these fanning out to each of
its ryoikis — and that downward line is what makes them visually cluster under the same
bubble.

---

## The four edge types

All four are the **same four-field shape** — only `type` and `label` differ.

- **`contains`** — `domain → ryoiki`. "This folder holds this area of knowledge." Every
  ryoiki has exactly one.

- **`relates`** — `ryoiki → ryoiki`, but only between ryoikis in *different* domains
  that were built by the **same epic**. "These two areas co-evolved in one push of work."
  The `label` carries *why*:

  ```json
  { "from": "apps/srs-demo#Routing", "to": "packages/srs-engine-v2#Batch Composition",
    "type": "relates", "label": "via EP44" }
  ```

  Ryoikis *within* one domain are already grouped by their shared domain node, so a
  `relates` edge is drawn only across domains.

- **`decides`** — `adr → ryoiki` (or `adr → domain`). "This decision governs that
  knowledge." This is how an ADR attaches to the graph — see below.

- **`supersedes`** — `adr → adr`. "This newer decision replaces/amends that older one."

---

## How an ADR links (the part that's different)

An ADR reaches into the graph through **two** of those edges.

### `decides` — the ADR → ryoiki link, authored by *you*

This is driven entirely by the `**Decides:**` field in the ADR file:

```
**Decides:** apps/srs-demo#Routing
```

The reader turns that into an edge:

```json
{ "from": "adr:engineering-routing-vue-router", "to": "apps/srs-demo#Routing",
  "type": "decides", "label": "decides" }
```

The glue is the **same id string-match** as `contains`: the `**Decides:**` target
`apps/srs-demo#Routing` *is* the ryoiki node's id. A bare `apps/srs-demo` (no `#`) targets a
domain node instead. Two things fall out of that:

- **No matching node?** (e.g. `apps/srs-demo#Audio Playback`, a ryoiki not built yet) — no
  edge is drawn. The ADR is **floating**.
- **No `**Decides:**` field at all?** — also floating. This is how every ADR *starts*.

A floating ADR is drawn as a **dotted** diamond — meaning *"decided, but not yet built."*
That's a feature: you can see at a glance which decisions have landed and which haven't (and,
inversely, which ryoikis like EP44's have *no* ADR behind them).

**The link is yours to draw.** In the UI you turn on *Link ADR*, click a diamond, then click
a ryoiki — and the server writes `apps/srs-demo#Routing` back into that ADR's `**Decides:**`
field on disk. **The ADR file is the source of truth**, not the graph. `.graph-data.json` is
just a rebuilt cache, so deleting it and rebuilding reconstructs every link from the ADR files.

### `supersedes` — the ADR → ADR link, read automatically

This one you don't author. When an ADR's header says:

```
**Status:** Superseded by [Routing via Vue Router 4](20260714T100000Z-engineering-routing-vue-router.md)
```

the reader spots the `Superseded by` / `Amended by` phrasing, resolves the linked filename to
a slug, and draws an edge from the **newer** decision to the **older** one:

```json
{ "from": "adr:engineering-routing-vue-router", "to": "adr:engineering-screen-string-routing",
  "type": "supersedes", "label": "supersedes" }
```

---

## The whole model, in one breath

> `KNOWLEDGE.md` files become **domain** nodes (folders), each **containing** several
> **ryoiki** nodes (knowledge); ryoikis that grew together across folders are **related**.
> **ADR** diamonds sit on top: each **decides** the ryoiki(s) it governs (a link you draw,
> stored back in the ADR file) and may **supersede** an older ADR. Stories and epics aren't
> nodes — they're just credit tags on the ryoikis.

Three node types, four edge types. That's the entire graph.
