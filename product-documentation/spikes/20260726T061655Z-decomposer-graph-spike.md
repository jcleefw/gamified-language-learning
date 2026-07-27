# Spike Plan — Decomposer → Graph → (Graph-RAG seam), end to end

**Created**: 2026-07-26
**Status**: In progress (first artifact built)
**Author**: JC Lee / PO
**Relates to**: RFC `20260726T061655Z-decomposer-engine.md`, Idea `20260726T061655Z-graph-decomposable-breakdowns.md`

---

## Goal

See the whole pipeline work end to end on **real, in-the-wild Thai text** — user input → decompose →
graph → the point where Graph-RAG would begin — and use it to feel, concretely, **where a graph earns its
place and where an LLM would (and wouldn't) add value.**

## The question the spike answers

Does decomposing real words into a shared fixed foundation, then traversing the resulting graph, produce
**pedagogically meaningful neighbourhoods** at a scale bigger than three words — and where exactly does the
graph / graph-RAG boundary sit?

## Stop line (explicit)

Everything **through the graph** and up to the **inert retrieval blob** the LLM would consume. **No LLM is
called.** RAG needs a model to generate; we assemble the context the model would receive, render it, label it
*"graph stops here / RAG would begin,"* and stop. A deterministic **template renderer** stands in for the
narration, so the value is visible without a model — and the gap between the template and "what an LLM would
add" is exactly the graph-vs-graph-RAG line, made literal.

## Non-goals

- Not the real `@gll/decomposer-engine` package. Throwaway, isolated from `packages/@gll/*`.
- Not a real Thai **syllabifier** (OQ-I). Segmentation is hand-authored — the deliberate shortcut.
- No persistence, no build tooling, no network. One self-contained HTML file.

## Pipeline (5 stages)

| Stage | Does | Honest shortcut |
|---|---|---|
| 1 · Input | Pick a word (chip / graph node) | Free arbitrary input deferred (needs OQ-I) |
| 2 · Decompose | word → syllables → grapheme roles → class / vowel-length / tone-mark / live-dead → **tone computed from the fixed rule table**; emit the fired rule + `status: clean/exception` | Syllable segmentation is **hand-authored data**, not computed |
| 3 · Build graph | Fold all decompositions into one graph: nodes = `word, consonant, class, vowel, tone-mark, tone, rule, field`; typed edges | In-memory typed objects (RFC OQ-D lean). No graph DB. |
| 4 · Graph queries | `neighbourhood(word, hops)`, `sameFiredRule`, `path(a,b)` → **structured** node/edge sets. Pure graph, no LLM. | — |
| 5 · RAG seam (STOP) | Assemble + render the retrieval blob (subgraph + templated instruction) the LLM *would* get. Labelled, never sent. | No model invoked. |

## Seed data

~54 words hand-segmented from the supplied poem **หยาดเพชร**. Tone is derived mechanically and is correct
*given* the authored structure — treat tones as needing a dictionary check. The poem yields dense,
overlapping clusters, which is the point:

- **Shared fired-rule cluster** (LOW + mai-tho → HIGH): น้ำ ฟ้า ช้ำ แล้ว ทั้ง ร้อง นั้น แม้ คว้า — all high
  tone *for the same reason*.
- **Leading-consonant exceptions** (ห/อ นำ): หวาน หยาด หนึ่ง หรือ อย่า อยู่ — flagged `exception`, still
  decompose. การันต์ (silent final): ศัลย์.
- **Semantic fields** (crystal / sorrow / motion / sky) deliberately **cross** the phonetic clusters —
  ฟ้า links to แก้ว by *crystal* and to น้ำ by *the tone rule*.

## Deliverable

One self-contained interactive HTML file, published as an Artifact:

- Concentric-ring layout: focus word centre → hop-1 its decomposition → hop-2 related words → hop-3 their parts.
- Controls: **hops (1/2/3)**, **highlight by (rule / class / tone / field)**, **path mode (pick 2 words)**.
- The **hop-2 ring arc-clusters** by the active highlight dimension: same-attribute words share a wedge
  (labelled), words unrelated under that dimension fall to an *"other"* wedge — so the neighbourhood's
  cluster structure is visible spatially, not just in the inspector's grouped lists.
  - **Grouping axis matters — tone is the coarse outcome, fired-rule is the specific cause.** Multiple rules
    land on the same tone, so grouping by *tone* visually merges words that are (e.g.) HIGH *for different
    reasons* — precisely the distinction the `signalBits` weighting exists to surface (a rule edge ≈ 4 bits vs
    a tone edge ≈ 2). Default highlight is **fired-rule** for this reason; tone grouping is offered but
    coarser. Concretely: focus ฟ้า under *rule* isolates the LOW+mai-tho→HIGH cluster; under *tone* it lumps
    that cluster in with unrelated FALLING/HIGH words.
- Inspector: full decomposition with the **fired rule** boxed, related-word groups, and the **RAG seam** blob
  under a stop-bar.

## Build slices (something visible early)

1. Foundation tables + `decompose()` for the seed words. *(proves Stage 2)*
2. Graph builder + `neighbourhood` / `sameFiredRule`. *(proves Stages 3–4)*
3. HTML viz: rings + click-to-recentre. *(the "see it" moment)*
4. Path mode + semantic-field edges. *(the cross-cutting payoff)*
5. Inspector: template narration + inert RAG blob. *(the labelled stop line)*

## What it teaches (maps to the RFC)

- Stage 2 exercises **OQ-J** (exception flagging) and makes **OQ-I** (segmentation) concretely visible as the
  thing we faked and would have to build for real.
- Stages 3–4 give **OQ-D** a real picture — does in-memory typed data suffice, or do the traversals want a
  graph store? (Bet: in-memory is plenty at this scale.)
- Stage 5 draws the **graph vs graph-RAG line** as an on-screen divider.

## Location

`spikes/decomposer-graph/index.html` — isolated from `packages/@gll/*`. Deterministic-core logic kept clean
enough to lift into `@gll/decomposer-engine` later if the spike proves out.

## Outcome / next

- [x] Slices 1–5 built as a single artifact.
- [ ] Review whether in-memory graph felt sufficient (OQ-D signal).
- [ ] Decide if live arbitrary input (OQ-I spike) is worth chasing next.
