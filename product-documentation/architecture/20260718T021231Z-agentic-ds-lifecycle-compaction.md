# ADR: DS Lifecycle Compaction — Docs Decay by Rewrite-and-Delete

**Status:** Accepted (amended)

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->
<!-- For amendments, use "Accepted (amended)" and add an Amended-by line below. -->

**Amended by:** [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md) (2026-07-18). Refines **D3**: the per-story essence kept at completion is not one "record" — it splits by nature into the time archive (work narrative) and the domain `KNOWLEDGE.md` (state). The rewrite-then-delete lifecycle here still holds unchanged.

**Date:** 2026-07-18

**Deciders:** JC Lee / PO

**Epic:** N/A — process decision, surfaced during the `spike/graph-rag` exploration

**RFC:** N/A

**Superseded by:** N/A

---

## Context

The `.agents/changelogs/` tree has grown to **157 files / ~1.4 MB** and only ever grows — nothing is pruned. In this project a Design Spec (DS) is not a throwaway pre-work artifact: it is **both the plan and the record of the plan's completion — a partial changelog**. That dual role is the source of the weight.

A DS carries two kinds of content:

- **As-plan (forward-looking):** the scaffolding needed to execute correctly — acceptance criteria, code references, line numbers (`file:line`), code examples, route tables, type/data-structure dumps, "the prior draft got this wrong" deliberation.
- **As-record (backward-looking):** the decisions and behavior that actually stuck, per story.

Today the as-plan scaffolding freezes into the as-record and is never demoted. It rots immediately — line numbers and code anchors are stale the moment the next edit lands, and the very DS that refactors a file invalidates its own line references. Worse, work gets rewritten: the v1 SRS engine (EP02, EP04–07) was rebuilt by EP20/21/23/25 and its code deleted in EP32, yet **~26 changelog files still narrate code that no longer exists**.

Underlying principle: **git already stores *what changed*, accurately and forever. Docs should store only *why* — the part git cannot reconstruct.** Every line number, snippet, and file list a doc freezes is duplicated, rotting git-work.

Two adjacent models were weighed and kept out of scope:

- **Graph RAG** (a prospective retrieval layer, explored separately and not yet solidified) sits *over* the corpus as a query surface, not a replacement for the capture process — deliberately kept separate, and this decision points at the *intention*, never a specific implementation.
- **Pi's tree** is a *state/capture* model; its one transferable idea is **compaction** (replace distant state with a summary as work moves forward), not its tree storage.

## Decision

Documentation decays through **three lifecycle tiers**, and every transition is performed by **rewriting a smaller artifact and deleting the larger one — never by trimming in place**.

### D1 — Three tiers

| Tier | Trigger | What it holds |
| ---- | ------- | ------------- |
| **Planning** | DS being written / executed | Everything, scaffolding included — heavy is correct here |
| **Recorded** | Plan marked complete | Story breakdown + per-story summary + epic decision + `Supersedes:` |
| **Superseded** | The code is rewritten | Epic-level tombstone: what / why / git-pointer |

### D2 — Compaction is rewrite-then-delete, not trim

At each transition, author the smaller artifact from the essence already in hand and `git rm` the larger one. Trimming in place forces re-reading the full document (paying the exact tokens the compaction is meant to save); rewriting is near-free because the essence is already held at the transition point, and **git is the backstop for everything deleted**. This mirrors how Pi compacts: replace a span with a fresh summary, never redact.

### D3 — Completion rewrite: preserve the story breakdown

> **Amended by [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md):** the essence below is not written to a single "record" file. At completion it splits by nature — work narrative (per-story, verbs, durations) → the time archive (`changelogs/archive/index.json`); state knowledge (nouns) → the domain `KNOWLEDGE.md`. The keep/drop distinction here is unchanged; only the destination is refined.

The Recorded artifact is **per-story, not a flat blob** — the story breakdown *is* essence (it is the faithful structure of what was delivered). For a 5-story DS: one epic-level decision paragraph + one short summary paragraph per story.

- **Keep:** the story list; a per-story summary (decision + behavior that stuck); epic-level decision/rationale; `Supersedes:` pointer.
- **Drop:** acceptance criteria; code references and line numbers; code examples; route tables and data-structure dumps; planning deliberation/meta.
- Operationally, **"mark complete" *means* "compact"** — the status flip and the scaffolding strip are one act.

### D4 — Supersession tombstone: dissolve the story structure

When the code is rewritten, per-story granularity becomes archaeology. Rewrite the epic (or a cluster of epics) into a single tombstone — *what it did / why it was replaced / git pointer to the detail* — and `git rm` the Recorded files.

### D5 — Line numbers and code anchors are Planning-only

They are legitimate execution scaffolding in the Planning tier and **forbidden from the Recorded tier onward**. They therefore never survive to the tombstone — there is nothing to trim there because they were already dropped at completion.

### D6 — Git is the detail store; docs never duplicate it

Docs reference symbols and behavior, not `file:line`. Deleted detail is recovered via `git log`, not preserved in prose.

## Rationale

- Scaffolding that rots (line numbers, snippets) is removed exactly when it stops being useful — at completion — instead of frozen forever.
- Rewrite-then-delete spends fewer tokens than trim-in-place and produces cleaner output, because the essence is already in context at each transition.
- Preserving the per-story breakdown keeps the record a faithful account of delivered work; only the intra-story scaffolding is shed.
- Tombstoning superseded epics stops the corpus from narrating deleted code (the ~26 v1-SRS files).
- Leaning on git as the detail store removes the largest, fastest-rotting, most duplicative content from the docs.

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
| ------ | ---- | ---- | -------------- |
| Status quo (keep everything, never prune) | Zero process; full fidelity | Monotonic growth; narrates dead code; stale line numbers | The problem being solved |
| Trim completed DS in place | Preserves file identity/path | Must re-read the full doc to edit it — wastes the tokens compaction should save; leaves half-trimmed cruft | D2 — rewrite-then-delete is cheaper and cleaner |
| Flat one-paragraph summary at completion | Smallest possible record | Loses the story breakdown — no longer a faithful account of delivered work | D3 — story structure is essence |
| Graph RAG as source of truth | Multi-hop querying | It is a retrieval layer, not a capture format; conflates two lifecycle stages | Kept separate by prior decision |
| Pi-style tree storage for the process | Automatic compaction | A state/session model; opaque; wrong tool for a human-authored corpus | Borrowed only its compaction *mechanic* (D2) |

## Consequences

**Positive:**

- Doc weight decays with relevance instead of accumulating; the corpus stops describing deleted code.
- One new habit — *completing a plan compacts it* — reclaims most of the existing 1.4 MB.
- Records stay trustworthy: no stale line numbers or dead-code narration.

**Negative / Risks:**

- Adds a compaction step to plan completion and to rewrites; if skipped, the corpus reverts to monotonic growth.
- Detail lives only in git after deletion — recovering it requires `git log` fluency.
- Judging "the code is rewritten" (supersession trigger) is a manual call; the `Supersedes:` field is the mechanical hook that makes it reliable.

**Neutral:**

- The changelog/DS template must gain a `Supersedes:` field and a completion-compaction step.
- Graph RAG, if used, ingests the compacted corpus — fewer, higher-signal nodes.

## Related

- Template: `.agents/plans/templates/ST-CHANGELOG-TEMPLATE.md` — gains `Supersedes:` and the completion-compaction step
- Memory: `.agents/memory/graph-rag-focus.md` — the retrieval-layer *intention* kept separate from this capture process (no implementation assumed)
- Epic: EP32 (v1-cleanup) — confirms the v1-SRS code deletion that makes EP02/04–07 the first tombstone candidates
