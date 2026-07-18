# ADR: Two-Axis Knowledge Architecture — Time Archive + Domain Knowledge

**Status:** Accepted

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->
<!-- For amendments, use "Accepted (amended)" and add an Amended-by line below. -->

**Date:** 2026-07-18

**Deciders:** JC Lee / PO

**Epic:** N/A — process decision, surfaced during the `spike/graph-rag` exploration

**RFC:** N/A

**Superseded by:** N/A

**Relates / Amends:** [DS Lifecycle Compaction](20260718T021231Z-agentic-ds-lifecycle-compaction.md) — builds on its compaction lifecycle and **amends its D3** (see Decision D6).

---

## Context

The [DS Lifecycle Compaction ADR](20260718T021231Z-agentic-ds-lifecycle-compaction.md) established *how* documentation decays (rewrite-then-delete, three tiers) but left open *where the compacted knowledge lands*. This ADR decides that target information architecture.

Two problems forced the decision:

1. **The knowledge-graph grouping bug.** A prior graph attempt ingested changelogs and grouped nodes **by epic**. But an epic is a unit of *work in time*, not a unit of *knowledge*. Domain knowledge like "how the SRS engine works" is scattered across EP02/04/07/20/21/23/25; grouping by epic fragments every domain. The graph "gets it wrong" precisely when it invents its own grouping (e.g. a floating `app-routing`) instead of anchoring to the code's real structure.

2. **Epic boundaries are messy and can't be trusted as an ontology.** Epic creation during development is not cleanly boundary-separated, and rewrites (v1→v2 SRS) shuffle what an epic "means." Retrofitting a clean domain grouping by rewriting all 157 changelog files was considered and rejected as too costly and lossy.

The resolution is to recognise **two legitimate, distinct axes over the same events** and stop collapsing them into one:

- **Time axis** — epics/DS as they happened. Answers *"what was done, when, how long."* Messy boundaries are tolerable because it is a work log, not an ontology.
- **Domain axis** — the code's own units. Answers *"what is true now, and how did it get this way."* Must be clean and stable.

## Decision

### D1 — Domains are the workspace, not invented concepts

The domain taxonomy **is** `pnpm-workspace.yaml`: every `apps/*` and `packages/*` is a domain node (`apps/srs-demo`, `packages/srs-engine-v2`, `apps/server`, …). Cross-cutting **concerns** (routing, audio, scheduling) are sub-nodes *within* a unit, never standalone domains. Concern names are **free-form for now** — whether they need a controlled vocabulary waits until the retrieval-layer query patterns are known. The knowledge graph mirrors the module graph; it does not author its own. EP44's knowledge belongs to `apps/srs-demo` / concern `routing` — not a floating `app-routing`.

### D2 — Two artifacts, two axes

| | **Archive** | **Domain knowledge** |
| --- | --- | --- |
| Axis | Time | Domain (package/app) |
| Location | `.agents/changelogs/archive/index.json` | `{packages,apps}/<unit>/KNOWLEDGE.md` |
| Format | JSON | Markdown + frontmatter |
| Grain | Per-story (flat), tiny per-epic rollup | Per unit + concern |
| Tense | Past — *what was done* (verbs) | Present — *what is true now* (nouns) |
| Consumer | Lookup / traversal | Reader (human + LLM) |

### D3 — Format follows consumer

**JSON when the primary consumer is a lookup/traversal; Markdown+frontmatter when the primary consumer is a reader.** The archive is queried → JSON. The domain doc is read and reasoned over as prose → Markdown; JSON would destroy the narrative that is its whole value.

### D4 — Archive schema: flat per-story, PR-referenced

Flat `stories` array (primary, filterable by domain without flattening) plus a small `epics` rollup for lookup:

```json
{
  "stories": [
    {
      "id": "EP44-ST01", "epic": "EP44", "track": "project",
      "title": "App router setup",
      "domain": "apps/srs-demo", "concern": "routing",
      "completed": "2026-07-15", "duration": "1d",
      "summary": "Installed Vue Router 4; 10 routes on the Screen union; App.vue reduced to a layout shell.",
      "supersedes": [], "fixes": [], "pr": 41
    }
  ],
  "epics": {
    "EP44": {
      "title": "App.vue → Vue Router refactor",
      "domains": ["apps/srs-demo"],
      "archived": "2026-07-18",
      "notes": "Component refactors deferred to EP45+."
    }
  }
}
```

Provenance uses **`pr` (stable), not commit SHA** — squash-merge rewrites SHAs. `summary` is verbs (what was done); it never duplicates git's *content*, only points to it. `supersedes` is the tombstone hook from the compaction ADR. `track` distinguishes project from agentic work (D8); `fixes` cross-references a sealed epic when this story corrects prior work (D9). `epic` may be `null` for loose maintenance stories that belong to no epic. After an epic is archived its `changelogs/EP##--*/` folder ceases to exist (rolled up here, post-merge — see D10).

### D5 — Domain knowledge: current-state prose + provenance metadata

`KNOWLEDGE.md` content is **pure current state (nouns)** and is **overwritten to now**, never appended-to as a history. Provenance lives in frontmatter, not prose:

```markdown
---
unit: packages/srs-engine-v2
concern: scheduling
sources: [EP20, EP21, EP23, EP25]
updated: 2026-07-14
---

# srs-engine-v2 — Scheduling

FSRS-based; mastery is global (not per-deck). Batch composition draws from the
active window with the shelving/stagnation policy gating advance...
```

- **Epic/story IDs are metadata, not knowledge.** They are a `sources` reference field, never inline narration ("reached via EP44"). The prose stays clean state; the IDs are citations.
- When knowledge shifts, **overwrite the state and append the new id to `sources`.** The growing `sources` list *is* the shift history — as resolvable references, not narrative. The narrative of the work lives once, in the archive.
- **Fixes reach domain knowledge only when they change current state.** A *state-changing* fix (behaviour now differs) overwrites `KNOWLEDGE.md` and appends its id to `sources`. A *conformance* fix (code corrected to match what the doc already described) is recorded in the archive only — touching the domain doc would be noise. Test: *does the fix change what is true about the domain, or merely make the code match what was already documented as true?* Every fix reaches the archive; only state-changing ones reach domain knowledge.
- **`KNOWLEDGE.md` is not `CODEMAP.md`.** The existing per-folder `CODEMAP.md` is a token-saving lookup of the functions/symbols currently available — it mirrors the *reality of the code*. `KNOWLEDGE.md` carries *domain state and decisions* (how it behaves now, and why). They are orthogonal artifacts with different jobs and must never be merged: CODEMAP answers "what functions exist here?"; KNOWLEDGE answers "how does this domain behave and why?" CODEMAP is **never epic- or history-aware** — it reflects code as-of-now and is refreshed by the `code-mapper` skill, never by `archive-epic`.

### D6 — Completion splits essence by nature (amends compaction ADR D3)

The compaction ADR's D3 said the per-story breakdown is kept in "the record." This ADR refines that: at completion the essence **splits by its nature**, into two destinations —

- **Work narrative** (per-story, verbs, durations) → **archive** (`index.json`).
- **State knowledge** (nouns, current) → **domain** (`KNOWLEDGE.md`), with `sources` metadata.

There is no third "record" file. The compaction ADR is amended accordingly.

### D7 — Graph RAG projection (intention only)

This is a *forward-looking projection*, not a commitment to any package. No retrieval layer is solidified; this decision only shapes the artifacts so a future graph **could** ingest them. When such a layer exists, it ingests these two artifacts, not raw changelogs:

- Archive JSON → story/epic nodes on a timeline.
- Domain `KNOWLEDGE.md` frontmatter → domain nodes (correctly grouped by workspace unit), with **`sources` IDs as provenance edges** to the archive's epic/story nodes.

The epic is thus always an *edge target*, never the grouping — which structurally prevents the epic-fragmentation bug that motivated this ADR.

### D8 — Two work tracks: project and agentic

The repo runs two parallel tracks, and the two-axis model applies to both — only the *domain home* differs:

| Track | Work | Numbering | Time axis | Domain home |
| ----- | ---- | --------- | --------- | ----------- |
| **project** | building the product | `EP##` | epic folders → archive | `{apps,packages}/<unit>/KNOWLEDGE.md` |
| **agentic** | refining the dev workflow itself | `AGN##` | flat files in `changelogs/agentic/` | the `agentic-*` ADRs in `product-documentation/architecture/` |

Agentic work has no package to co-locate in, so its domain knowledge is documentation-native — the ADRs *are* its `KNOWLEDGE.md`. The archive carries a `track` field; `domain` generalises to `agentic/<concern>` for agentic stories. The agentic track is already flat (AGN files, no folders), i.e. loose by default. **Its record/compact lifecycle is specified in [D11](#d11--agentic-track-lifecycle-plan--artifact-by-compaction)** (added 2026-07-18); this decision fixes that the track exists and where its knowledge lives, D11 fixes how agentic work is rolled up.

### D9 — Completed epics are immutable; `.agents/changelogs/_loose/` holds cross-cutting work

**Done-done = merged to main. A merged epic is sealed and never reopened.** Work discovered afterward — a bug in a prior epic's domain, a small fix, a late story — neither reopens the epic nor requires its own (an epic-per-fix is excessive). It lands in a flat staging bucket, `.agents/changelogs/_loose/`, each entry carrying `track`, `domain`, and a `fixes`/`relates` reference to the sealed epic. At compaction it becomes a **domain-keyed** archive story that *references, never mutates* the prior epic. The bucket needs no lifecycle of its own: it **drains at each item's own merge** — every entry carries a `domain` + `fixes`/`relates` reference, so it can always be filed and never orphaned. The archive is ordered by `completed` timestamp, so playback is correct regardless of the `epic` tag — the timeline is the organising key, the epic is only a label.

### D10 — Record and compact run post-merge, off main

The rollup triggers when the epic's final PR **merges to main** — the done-done event — and runs **against main, never on the branch** (a branch is a proposal, not solidified work; compacting it destructively is premature). Record (archive append + `KNOWLEDGE.md` refresh) and compact (folder deletion) happen **together**, since merge is now the hard boundary. Because the merged epic folder stays intact in main until the rollup runs, there is no reconstruction cost, and a skipped rollup loses nothing — the epic simply stays un-compacted (a safe failure mode). Graph re-index and the integrity checks (stray folders, orphaned `_loose/` items) run **on demand**, not on any schedule — this project has no milestone concept. Optionally gate deletion on the epic being *verified* (not merely merged) if UAT should clear first.

### D11 — Agentic track lifecycle: plan → artifact by compaction

D8 fixed *where* agentic knowledge lives but deferred *how* agentic work is rolled up. It is specified here, mirroring the project track (D6, D10) with the recorded tier expressed as **flat markdown** rather than an epic folder:

| Tier | Location | Holds |
| ---- | -------- | ----- |
| **Planning** | `.agents/changelogs/agentic/plans/AGN##-*.md` | Design-spec-style plan — story breakdown, acceptance criteria, read lists, `file:line` scaffolding |
| **Recorded (artifact)** | `.agents/changelogs/agentic/AGN##-*.md` (flat, beside AGN01–04) | Compacted retrospective — *What Changed / Why / Before-After* (the existing `AGN-TEMPLATE.md` shape) |

- **Completion compacts; it does not relocate.** The heavy plan is rewritten into the lean AGN artifact and the plan file is `git rm`d — rewrite-then-delete per [Compaction D2](20260718T021231Z-agentic-ds-lifecycle-compaction.md), never a move of the full document. As on the project track, **"mark the AGN complete" *means* "compact it."** The scaffolding forbidden Recorded-onward (Compaction D5 — `file:line`, acceptance criteria, planning meta) is dropped here too.
- **Dual record — flat artifact *and* archive (both, for now).** The completed AGN artifact is the human-readable agentic time-axis record; in addition, one archive story per completed AGN is appended to `index.json` with `track: "agentic"`, `domain: "agentic/<concern>"`, and the `AGN##` id as its work-unit reference. The flat file is the reading surface; the archive entry is the query/graph surface. If the duplication proves noise once the retrieval-layer query patterns are known, the flat AGN artifact is the one to keep — it is agentic's native form.
- **State knowledge routes to the ADRs.** When completed work changes a *standing* agentic decision, the relevant `agentic-*` ADR is amended — the ADRs are agentic's `KNOWLEDGE.md` (D8). Pure-mechanics work (a script, a template) that changes no standing decision produces only the artifact + archive entry. Same state-changing-vs-conformance test as D5.
- **Trigger.** The done-done boundary of D10: where the agentic work has a PR, the rollup runs post-merge against main; where it has none, at the human "done" call. A skipped rollup is a safe no-op — the plan simply stays in `plans/`.

Self-referentially, completing **AGN05** produces the `AGN05` flat artifact, appends its `track: "agentic"` archive story, and amends *these* ADRs with the decisions it implemented.

## Rationale

- Anchoring domains to the workspace removes the graph's freedom to invent wrong groupings — the failure mode observed in the prior attempt.
- Two axes joined by IDs let "how did the engine evolve" be answered by domain grouping *with* temporal lineage, without duplicating content.
- Format-follows-consumer keeps each artifact optimal for its job: fast structured lookup vs. readable reasoning surface.
- IDs-as-metadata keeps domain prose clean and makes provenance machine-readable — the same field serves human citation and graph edges.
- The architecture accretes forward (per completed epic) instead of demanding a 157-file rewrite.
- The agentic track reuses the same plan→compact mechanic (D11), so both tracks share one lifecycle and one archive — only the domain home differs.

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
| ------ | ---- | ---- | -------------- |
| Rewrite all changelogs, regroup by domain | Clean slate | High cost, lossy, big-bang | Forward accretion via compaction achieves it incrementally |
| Single axis — group everything by domain | One structure | Loses the temporal/work record (durations, when) | Both axes answer real, different questions |
| Single axis — keep grouping by epic | No change | The fragmentation bug this ADR exists to fix | Rejected outright |
| Domain knowledge as JSON | Uniform with archive | Destroys the prose that is its value; hard to read/edit | D3 — format follows consumer |
| IDs inline in domain prose | Reads naturally | Rebuilds the time axis inside the domain doc; couples state to history | D5 — IDs are metadata |
| Provenance by commit SHA | Precise | Squash-merge rewrites SHAs | D4 — reference the PR |
| Author rollup on the branch / pre-merge | Essence fresh in context | Branch not solidified; destructive compaction of unmerged work is premature | D10 — the source folder stays intact in main, so post-merge has no freshness cost |
| Reopen a completed epic for a late fix | Keeps the fix "near" its epic | Breaks the immutability invariant; archive entry becomes a moving target | D9 — file to `_loose/`, reference the sealed epic |
| New epic per small fix | Uniform (all work is an epic) | Epic-inflation; ceremony ≫ change | D9 — `_loose/` + domain-keyed story, `epic: null` |
| Agentic completion *moves* the whole plan to the flat log | Zero rewrite | Freezes plan scaffolding (`file:line`, acceptance criteria) into the permanent record — the rot this whole ADR fights | D11 — compact (rewrite-then-delete), not move |
| Agentic artifact only, no `index.json` entry | No duplication | Agentic work invisible to the query/graph surface until patterns force a rebuild | D11 — do both for now; drop the archive entry later if it proves noise |

## Consequences

**Positive:**

- The knowledge graph groups by real code units and cannot re-introduce epic fragmentation.
- Clean separation: query the archive, read the domain docs, resolve code from git.
- Domain knowledge co-located with the code it describes; discoverable as a per-unit `KNOWLEDGE.md`.

**Negative / Risks:**

- Two artifacts to keep consistent; a `sources` id must always resolve to an archive entry (needs a guard).
- Completion now writes to two places (archive + one or more `KNOWLEDGE.md`), fanning out when a DS touches several units.
- Overwriting `KNOWLEDGE.md` to current state relies on git for prior states — recovering old knowledge means reading history.
- Immutability depends on discipline: the `_loose/` bucket only works if it is genuinely drained and never used to smuggle edits back into sealed epics.

**Neutral:**

- A one-time backfill migrates existing completed epics onto both axes (a fan-out workflow, done once).
- A future Graph RAG layer, if built, would ingest `index.json` + `KNOWLEDGE.md` rather than raw changelogs — this ADR only makes the artifacts ready, it selects no implementation.
- Two tracks (project `EP##`, agentic `AGN##`) share one archive via the `track` field; agentic knowledge routes to ADRs rather than a package `KNOWLEDGE.md`.

## Tooling (LLM-agnostic, under `.agents/`, not built yet)

Everything lives under `.agents/` and is provider-neutral — no `.claude/`, no GSD. The portable interface is a `SKILL.md` (declaring generic `tools: Read, Write, Exec`) for judgment, plus scripts for mechanics. Principle: **judgment → a `SKILL.md`; mechanics → a script in `.agents/tools/`; triggering → git / CI / human, never a provider hook.** The more that lives in scripts, the more agnostic and reliable it is — the LLM seam shrinks to two judgment calls (summarise a story; write current-state prose).

| Piece | Home |
| ----- | ---- |
| `archive-epic` skill (record+compact, post-merge per D10) — sibling of the existing `dev/change-log-updater` | `.agents/skills/dev/archive-epic/SKILL.md` |
| `domains-from-diff` (paths → workspace units; deterministic routing per D1) | `.agents/tools/` |
| `archive-append` (append to `index.json` + schema-validate) | `.agents/tools/` |
| `archive-check` (integrity guard — enforces the invariants) | `.agents/tools/` + rules in `.agents/guardrails.yml` |
| `KNOWLEDGE-TEMPLATE.md`, `_LOOSE-TEMPLATE.md` | `.agents/plans/templates/` |
| one-time backfill of legacy `EP##`/`AGN##` | `.agents/workflows/backfill-archive/` |

Loose capture stays a **convention + template**, not a tool. The existing `dev/change-log-updater` skill needs a small update to emit `Supersedes`/`track` so its output is archive-ready. A future retrieval layer would ingest `archive/index.json` + `**/KNOWLEDGE.md` + `agentic-*` ADRs (never raw changelogs) — building or choosing that layer is explicitly **out of scope** for this ADR and its groundwork.

## Related

- ADR: `20260718T021231Z-agentic-ds-lifecycle-compaction.md` — the compaction lifecycle this builds on and amends (D6)
- Memory: `.agents/memory/graph-rag-focus.md` — the retrieval-layer *intention* that would consume these two artifacts (no implementation assumed)
- Config: `pnpm-workspace.yaml` — the source of the domain taxonomy (D1)
- Skill: `.agents/skills/dev/change-log-updater/SKILL.md` — the front of this lifecycle (creates the ST logs `archive-epic` rolls up)
