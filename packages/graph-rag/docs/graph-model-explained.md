# The Graph Model, Explained

A plain-language primer on how graph-rag's graph is actually built out of **nodes** and
**edges** — what the objects look like, where each one comes from, and how they connect.

This is the *conceptual* doc. For the build pipeline see
[ARCHITECTURE.md](../ARCHITECTURE.md); for the exact field-by-field mapping from source
files see [EXTRACTION_PATTERNS.md](../EXTRACTION_PATTERNS.md). The three form a set — start
here, then go to those for the mechanics.

Every example below uses real data from the project (`apps/srs-demo`, the `Routing`
concern, `EP44`).

---

## What a node is

The whole graph is just two lists in one JSON file (`.graph-data.json`): a list of
**nodes** and a list of **edges**. Every node has the same four fields:

```json
{
  "id":    "apps/srs-demo#Routing",     // unique name — how edges point at it
  "type":  "concern",                    // which KIND of node (the important part)
  "label": "apps/srs-demo · Routing",    // the human-readable caption on screen
  "metadata": { ... }                    // everything else hangs in here
}
```

The `type` field is the whole game. Right now there are exactly **two** types: `domain`
and `concern`. Here they are, one at a time.

---

## Node type 1 of 2 — `domain`

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

## Node type 2 of 2 — `concern`

**What it represents:** one *named area of knowledge* inside a domain — "how routing
works," "how batch composition works." This is the actual **knowledge** in the knowledge
graph. The domain is just the folder it lives in; the concern is the substance.

**A real one:**

```json
{
  "id": "apps/srs-demo#Routing",
  "type": "concern",
  "label": "apps/srs-demo · Routing",
  "metadata": {
    "concern": "Routing",
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

Each `## heading` becomes **one concern node**. The heading text is the concern's name;
**the prose underneath it, word for word, becomes `metadata.content`** — that's the durable
knowledge. The prose is stored *as-is*, never chopped into more nodes. (There is no layer
that reads those sentences and turns them into structure — the graph carries the prose
verbatim.)

**The `sources` / `epics` / `prs` tags:** notice the concern also carries a list of story
IDs. That's **provenance** — "which work built this knowledge." It comes from a *different*
file, the archive index (`.agents/changelogs/archive/index.json`), and gets stamped onto
the concern. Crucially, **stories and epics are NOT their own nodes** — they're just tags
on the concern. That was deliberate: the graph shows *knowledge*, and work is only a
citation, never part of the skeleton.

---

## The connector — the `edge` object

Nodes don't contain their connections. The connections live in a **separate list** — the
edges — and reference nodes by `id`. Here's the object that joins the two nodes above:

```json
{
  "from":  "apps/srs-demo",           // the domain node's id
  "to":    "apps/srs-demo#Routing",   // the concern node's id
  "type":  "contains",
  "label": "contains"
}
```

That's the whole object — just four fields.

**How it hooks the two together:** the glue is the **`id` string**. The edge's `from` is a
copy of the domain node's id; `to` is a copy of the concern node's id. There's no pointer
or nesting — it's literally string-matching. When the UI draws the graph, it walks the edge
list and, for each edge, looks up `from` and `to` in the node list to know which two dots
to connect with a line.

**Field by field:**

| Field | Meaning |
| --- | --- |
| `from` | id of the node the arrow starts at (here, the domain) |
| `to` | id of the node the arrow points to (here, the concern) |
| `type` | which *kind* of relationship (`contains` or `relates`) |
| `label` | the caption drawn on the line |

**Direction matters.** `apps/srs-demo → apps/srs-demo#Routing` reads "domain *contains*
concern," not the reverse. Every concern gets exactly one `contains` edge pointing down
into it from its parent domain. So `apps/srs-demo` has one of these fanning out to each of
its concerns — and that downward line is what makes them visually cluster under the same
bubble.

---

## The two edge types

Both edge types are the **same four-field shape** — only `type` and `label` differ.

- **`contains`** — `domain → concern`. "This folder holds this area of knowledge." Every
  concern has exactly one.

- **`relates`** — `concern → concern`, but only between concerns in *different* domains
  that were built by the **same epic**. Meaning: "these two areas co-evolved in one push
  of work." The `label` carries *why*:

  ```json
  {
    "from":  "apps/srs-demo#Routing",
    "to":    "packages/srs-engine-v2#Batch Composition",
    "type":  "relates",
    "label": "via EP44"
  }
  ```

Concerns *within* one domain are already grouped by their shared domain node, so no
`relates` edge is drawn between them — only across domains.

---

## The whole model, in one breath

> `KNOWLEDGE.md` files become **domain** nodes (folders), each **containing** several
> **concern** nodes (knowledge); concerns that grew together across different folders are
> **related**. Stories and epics aren't nodes — they're just credit tags on the concerns.

Two node types, two edge types. That's the entire graph today.

---

## Where an ADR would fit (a note, not a spec)

An ADR is **none of the above** — it's not a folder, and it's not "how it works now." It's
the *decision / the why*. That makes it a natural **third node type** (`adr`), drawn as a
different shape, connected by a new `decides` edge pointing at the concern(s) it governs.

A concern says *how routing works*; an ADR would say *why we chose Vue Router in the first
place*. This is a future extension, sketched here only so the shape of the idea is on
record — it is not yet built.
