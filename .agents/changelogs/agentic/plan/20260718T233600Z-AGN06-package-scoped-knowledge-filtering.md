# AGN06: Package-Scoped Knowledge Filtering — Implementation Plan

**Date**: 20260718T233600Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Revised**: 20260719T184647Z
**Type**: Skill | Tool | Template
**Status**: **Draft**
**Track**: agentic
**Source ADR**: [Package-Scoped Knowledge Filtering](../../../../product-documentation/architecture/20260718T213334Z-agentic-package-scoped-knowledge-filtering.md)

> **Scope guard.** Write-time slice only. Read-time filtering (graph edges, query-synonym resolution, ryoiki-scoped queries) is deferred to Graph RAG's own ADR — see §6.
>
> **Track scope.** The skill + runner built here target the **project track (`EP##`)** — epics with a `.agents/changelogs/EP##--slug/` folder to roll up and compact. AGN06 itself is agentic (its plan sits in `agentic/plan/`, and it has no such folder), but the tool it produces serves `EP##` rollups. The **agentic track (`AGN`)** is rolled up by the separate `archive-agn` skill, which has its own distinct flow. `archive-agn` **shares** `ryoiki-aliases.json` and the ryoiki-naming discipline (every story, either track, gets a `ryoiki` in the index — schema-required), and will reuse some of this tooling; it does **not** use the blacklist / `##`-heading / scaffold / consistency-check machinery, because agentic work has no `KNOWLEDGE.md` home (`.agents/` = `<non-workspace>`). No `archive-agn` change is planned here beyond the `facet`→`ryoiki` rename already done.

---

## 1. Overview

AGN05 already records domain knowledge to a time archive (`index.json`) and per-unit `KNOWLEDGE.md`. The one gap sits at **write time**: `archive-epic` compaction shouldn't clutter a unit's `KNOWLEDGE.md` with incidental noise (e.g. a demo app carrying build-tooling plumbing on every rollup).

A unit's knowledge is scoped by **ryoiki** — free-form, path-notated aspect tags (`spaced-repetition/fsrs/parameters`) that *are* the `KNOWLEDGE.md` `##` headings. Filtering is **include-by-default**: an unconfigured unit records everything; the only maintained control is a short per-unit **blacklist** (central file), cascading longest-prefix-wins. A curated global alias map heals naming drift.

Ryoiki assignment is **judgement**, so it is made visible and confirmed in the real archive file before it ever reaches `KNOWLEDGE.md`. Facts (the story record) are written to `index.json` as `state: "draft"` with a *suggested* ryoiki; the human corrects/confirms in the file by removing `state`. Only confirmed (no-`state`) entries build `KNOWLEDGE.md`. There is no hidden worksheet — the git diff of `index.json` is the review surface (fixes the chicken-and-egg, §4).

The sole live consumer is the `archive-epic` rollup. No registry, no read-side lookup, no `package.json` field, no inclusion-set materialization is built (ADR D10). What is authored (path tags, blacklist, alias map) is graph-ready, so a future read-time consumer adds a *reader* without reshaping anything here.

## 2. Core Requirements

| Requirement | Decision | ADR |
| --- | --- | --- |
| Axis name | `ryoiki` — a distinct aspect of one unit; distinct from `domain` (workspace unit) | D1 |
| Vocabulary | Free-form strings; no controlled vocab, no rejection gate | D2 |
| Drift healing | Curated global alias map, **seeded not empty**; grows only by human ratification at the gate; no tool writes it | D2 |
| Hierarchy | Path notation (`a/b/c`); prefix-matching does all hierarchy work | D3 |
| Tag storage | A ryoiki **is** a `##` heading; no separate tag store | D4 |
| Default polarity | Include-by-default; unconfigured unit = fully included | D5 |
| Control surface | Per-unit cascading **blacklist** is the only maintained control; the in-set is confirmed ryoiki minus blacklist, never hand-listed | D5 |
| Semantics | Cascading carve-outs, longest-prefix-wins | D6 |
| Blacklist home | Central `.agents/reference/ryoiki-blacklist.json`, keyed by unit, beside `ryoiki-aliases.json` | D7 |
| Judgement surface | Ryoiki is proposed as a `state: "draft"` entry in `index.json`; the human confirms by removing `state`; only no-`state` entries feed `KNOWLEDGE.md`; the git diff is the review surface, no hidden cache | D8 |
| Population | Forward, during `archive-epic`, behind the in-file draft/confirm gate; no upfront seed, no backfill | D8 |
| Exclusion loss | Lossy write-time projection; blacklist is single source of truth; git backstops; no tombstone | D9 |
| Tooling | No filtering/maintenance tooling beyond the runner + review gate | D10 |
| Unit shape | One mechanism spans apps and packages | D11 |

## 3. Data Structures

```yaml
# KNOWLEDGE.md frontmatter — unchanged; the blacklist no longer lives here
---
unit: apps/srs-demo
sources: [EP38, EP44]
updated: 2026-07-18
---
```

```jsonc
// index.json story — a DRAFT entry (working tree only, never committed as-is)
// Facts are written by the tool; `ryoiki` is the tool's suggestion; `state`
// marks it unconfirmed. The human edits `ryoiki` in place and confirms by
// deleting `state`. A no-`state` entry is confirmed and passes strict schema.
{
  "id": "EP07-ST01", "epic": "EP07", "track": "project",
  "title": "SrsEngine class", "domain": "packages/srs-engine",
  "ryoiki": "session-lifecycle",   // tool's suggestion; human corrects here
  "completed": "2026-03-08", "duration": "1d", "summary": "…",
  "supersedes": [], "fixes": [], "pr": null, "compact_pr": null,
  "state": "draft"                 // delete this line to confirm
}
```

```jsonc
// .agents/reference/ryoiki-blacklist.json — per-unit exclusion (D5, D7)
// keyed by unit; absent unit = fully included. Cascades longest-prefix-wins.
{
  "apps/srs-demo": ["build-tooling"]   // drops build-tooling and build-tooling/*
}
```

```jsonc
// .agents/reference/ryoiki-aliases.json — curated, seeded (D2)
// { canonical: { description, alias: [drift-variants…] } }
{
  "spaced-repetition": {
    "description": "SRS scheduling core — FSRS intervals, due-date scheduling.",
    "alias": ["srs", "fsrs", "scheduler", "review-scheduling"]
  }
}
```

A ryoiki path IS a `##` heading (D4); hierarchy = slash depth. The effective in-set is `(confirmed ryoiki) − (blacklist, cascaded)`, read on demand — never stored (D5).

## 4. The RECORD flow (the heart of this epic)

Ryoiki assignment is judgement, so it is confirmed against a **visible list** before it reaches `KNOWLEDGE.md`. `index.json` is that list: the tool writes each story's facts there as a `state: "draft"` entry carrying a *suggested* ryoiki; the human corrects the ryoiki in the file and confirms by deleting `state`. Facts and judgement are separate states on a surface the human already watches — the git diff — so nothing is decided blind.

```
per touched unit (from the commit range → units routing):
  1. draft    (tool)   write each story to index.json: facts + suggested ryoiki + state:"draft"
  2. confirm  (human)  in index.json: correct each ryoiki, then delete `state` to confirm.
                       Anything still carrying a `state` is ignored downstream.        [D8 gate]
  3. blacklist (human) from the now-visible confirmed ryoiki per unit, edit
                       .agents/reference/ryoiki-blacklist.json. Chosen from a real list.
  4. write    (you)    build KNOWLEDGE.md from confirmed, non-blacklisted ryoiki:
                       each becomes a ## heading; write current-state prose under it.
  5. check    (tool)   every confirmed, non-blacklisted index ryoiki for the unit is a ## heading
                       in its doc; fail on drift.
```

- **Facts are the tool's; ryoiki is judgement.** The tool writes facts and a *suggestion*; it never invents a confirmed ryoiki and never deletes `state` itself (Golden Rule 3).
- **Confirm = delete `state`.** No-`state` means confirmed: it is the only form that reaches `KNOWLEDGE.md` and the only form the strict schema accepts on commit. Drafts are transient — they live in the working tree and never commit.
- **`state: "draft"`** is the sole defined non-confirmed value. Any other `state` value is treated as unconfirmed: ignored downstream, never written to `KNOWLEDGE.md`. Such values are reserved for the deferred Graph-RAG consumer; nothing here builds or reads them.
- The tool never commits and never writes `KNOWLEDGE.md` prose. It writes/reads draft entries, validates, runs the deterministic scripts, and prints the git commands.

## 5. Stories

Renumbered for the single-epic shape. ST02 and ST03 already landed on this branch; the old speculative stories are cut (§ Cut, below).

### AGN06-ST01: `KNOWLEDGE.md` ryoiki-as-heading contract — *status: done*

**Scope**: The `KNOWLEDGE-TEMPLATE.md` contract. Frontmatter is `unit / sources / updated` only; a ryoiki IS a `##` heading; the blacklist is not here (it is central — ST02).
**Read List**: `.agents/plans/templates/KNOWLEDGE-TEMPLATE.md`; ADR D4, D5, D7
**Tasks**:
- [x] Frontmatter carries `unit / sources / updated` — no `blacklist` field.
- [x] Document that ryoiki paths mirror the `##` headings (a path IS a heading — D4) and hierarchy is slash depth.
- [x] Note that exclusion is central and per-unit (`ryoiki-blacklist.json`, ST02), not per-doc.
- [x] A **visible** approval guard in the template body (not a comment): no agent/automation writes without explicit human approval; always ask, first write and every append. It persists into every generated `KNOWLEDGE.md`.

**Acceptance**:
- [x] Template frontmatter is `unit / sources / updated` only; no `blacklist`.
- [x] Ryoiki-as-heading + slash-depth hierarchy documented.
- [x] Every generated `KNOWLEDGE.md` carries the approval guard as visible text (survives appends, not a strippable comment).
- [x] Existing `KNOWLEDGE.md` files stay valid.

### AGN06-ST02: ryoiki reference config — alias map + blacklist — *status: partial (alias done a501068)*

**Scope**: Two reference files + README: naming (`ryoiki-aliases.json`) and filtering (`ryoiki-blacklist.json`). Consumed by the skill's naming step and the tool's `check`/build.
**Read List**: ADR D2, D5, D7; `.agents/reference/`
**Tasks**:
- [x] `.agents/reference/ryoiki-aliases.json` **curated-seeded** in `{canonical: {description, alias: […]}}` shape.
- [ ] `.agents/reference/ryoiki-blacklist.json` keyed by unit → `[ryoiki-path, …]`; absent unit = fully included; cascading longest-prefix-wins. Seeded per the repo's known noise.
- [ ] `.agents/reference/README.md` documents both shapes, "consulted at the gate", and "no tool writes the alias map".

**Acceptance**:
- [ ] Both files valid JSON at the documented paths.
- [ ] The alias map only canonicalizes, never rejects (D2).
- [ ] The blacklist is keyed by unit; a missing unit means fully included; a coarse entry drops itself and its `/*` descendants.

### AGN06-ST03: `epic-commit-range.sh` + archive-epic step 1 — *status: done (c719e9f)*

*(Was ST10 in the pre-cut plan — foundational to the flow, so it leads.)*

**Scope**: One tool + a rewrite of `archive-epic`'s commit-range step. No single git heuristic losslessly determines an epic's true commit boundary (message conventions drift, bot reformats/reverts create false signals, some epics share a boundary commit). The tool reports what it finds — including anomalies — rather than picking a side.
**Read List**: `.agents/tools/epic-commit-range.sh`; `archive-epic/SKILL.md` step 1; `domains-from-diff.sh` (sibling)
**Tasks**:
- [x] `epic-commit-range.sh <EP##>`: two ordered passes — history-scan on `main` (flags entanglement, reverts, missing merge marker), then branch-divergence when `main` has zero trace.
- [x] Emit `status`: `firm` | `indeterminate` (full candidate list) | `not_found`.
- [x] `archive-epic` step 1 runs it first: firm → use range; indeterminate → investigate + human-approve; not_found → confirm the epic id.

**Acceptance**:
- [x] Clean epic → `firm` with a usable `suggested_diff_range`.
- [x] Cross-epic bot-reformat commit → `indeterminate` + `entangled_commits_present` + candidate list.
- [x] No changelog-folder commits → `not_found`, mutates nothing.

### AGN06-ST04: `archive-epic.sh` runner — the mechanical spine — *status: open*

**Scope**: One bash tool that drives §4's mechanics against `index.json` and the reference files. It writes draft entries, reads confirmed ones, and checks consistency. It never commits, never writes `KNOWLEDGE.md` prose, never deletes `state`, and never writes a confirmed ryoiki (Golden Rule 3). Draft entries live only in the working tree; the tool writes them directly (not through the strict `archive-append` path, which stays for confirmed entries). No hidden state file.
**Read List**: `.agents/tools/{epic-commit-range,domains-from-diff,archive-append,backfill-compact-pr-info,archive-check}.sh`; `archive/schema.json`; §4
**Tasks**:
- [ ] `discover EP## [--range]` — run `epic-commit-range` + `domains-from-diff`; print range + units.
- [ ] `draft EP##` — write each story to `index.json` as facts + a *suggested* ryoiki + `state:"draft"`. Idempotent by id; re-run leaves confirmed (no-`state`) entries untouched.
- [ ] `status EP##` — list the epic's entries split into draft vs confirmed, reading `index.json` directly. The visibility helper for the gate.
- [ ] `scaffold <unit>` — print a `##` heading skeleton from that unit's **confirmed, non-blacklisted** ryoiki (reads `ryoiki-blacklist.json`). No prose, no file write.
- [ ] `check` — every confirmed, non-blacklisted index ryoiki for a unit is a `##` heading in its doc; a blacklisted ryoiki is legitimately headless (recorded, suppressed by design — D9); fail on drift.
- [ ] `verify` — `archive-check.sh` + `check`.
- [ ] `backfill` — scan `index.json` for `compact_pr: null`; report only.
- [ ] `compact EP##` — print the `git rm -r` + commit commands (human runs them).

**Acceptance**:
- [ ] `draft` writes draft entries the human can see and edit in the `index.json` git diff; strict `archive-check` is unaffected because drafts are uncommitted.
- [ ] Only no-`state` entries are treated as confirmed by `scaffold`/`check`; `state:"draft"` (or any other `state`) is ignored downstream (**AC1** — seed confirmed entries to test build/check without re-drafting).
- [ ] A confirmed but **blacklisted** ryoiki passes `check` as legitimately headless; a confirmed **non-blacklisted** ryoiki with no `##` heading fails.
- [ ] The tool never commits, never edits a `KNOWLEDGE.md`, never deletes `state`, never writes a confirmed ryoiki.

### AGN06-ST05: `archive-epic` skill — the draft/confirm flow — *status: open*

**Scope**: Build `agentic/archive-epic/SKILL.md` from the known-good `ba/` base (steps 1–2) into a thin skill carrying §4: the two judgment calls + the in-file gate, each mechanical action delegated to ST04's tool. `ryoiki` throughout; no cut-tool references.
**Read List**: `.agents/skills/ba/archive-epic/SKILL.md`; ST01–ST04; ADR D8, D9
**Tasks**:
- [ ] Keep the `ba/` intro + steps 1–2 (range, units). Then the §4 order: `draft` entries → **stop for the human to confirm ryoiki in `index.json` and edit `ryoiki-blacklist.json`** → write `KNOWLEDGE.md` from confirmed, non-blacklisted ryoiki → `check`.
- [ ] State the gate explicitly: the human corrects each ryoiki and deletes `state` to confirm; the skill never deletes `state`, never auto-writes a confirmed ryoiki, never auto-commits (D8).
- [ ] Note exclusion is lossy-by-design — blacklisted ryoiki are never written; git backstops; no tombstone (D9).
- [ ] BACKFILL / COMPACT / VERIFY as thin steps over the tool. The skill lives at `agentic/archive-epic/`; remove the `ba/archive-epic/` scratch copy.

**Acceptance**:
- [ ] Ryoiki is confirmed in the visible `index.json` diff before any `KNOWLEDGE.md` prose is written.
- [ ] The blacklist is chosen from the confirmed ryoiki list, in the central file — never from a prose draft.
- [ ] With no blacklist for a unit, its `KNOWLEDGE.md` is written fully (include-by-default).
- [ ] The skill halts for human confirmation before writing; the tool does the mechanical parts (**AC3** codify).

### AGN06-ST06: `write-knowledge` skill — human-tone knowledge — *status: open*

**Scope**: The step-4 writer, a focused agentic skill invoked by ST05. It writes a unit's `KNOWLEDGE.md` content in the voice of a **non-engineer — Product Owner / BA**. Not a changelog, not an engineer's notes.
**Read List**: `packages/srs-engine/KNOWLEDGE.md` (existing tone reference); ADR D4; ST05
**Tasks**:
- [ ] Set the writer role to a non-engineer (PO / BA). Content is nouns/current-state a PO can read.
- [ ] Plain language only. No code identifiers, file paths, or API names as content — a code reference carries no meaning for the reader.
- [ ] Write only where there is human-meaningful knowledge. A ryoiki with none (e.g. `package-scaffold`) is routed to the blacklist, not filler-written.
- [ ] Capture what is *used* and what to *watch*: e.g. `test-infrastructure` → the tools/approach in use (vitest, unit tests, BDD/gherkin), coverage, gotchas, fragile dependencies — not config mechanics.

**Acceptance**:
- [ ] The output reads in plain language a PO/BA understands; no code refs or jargon as content.
- [ ] A low-value ryoiki is blacklisted, not written for its own sake.
- [ ] `test-infrastructure` covers tools/approach + gotchas + risky dependencies, not configuration.

## Not built (speculative ahead of a read consumer — ADR D10)

- A `facet-scope.sh` derive-view helper — the in-set is confirmed ryoiki minus a short blacklist, read by eye.
- A `facet-check.sh` cross-unit drift/orphan check — no consumer.
- Alias-map automation (shape migration, an archive scanner, a dedicated mapping skill, wiring) — machinery to manage a handful of names. The curated seed (ST02) + the gate (ST05) cover it.

## 6. Out of scope — read-time (deferred to Graph RAG's ADR)

Recorded so this work doesn't foreclose it; not built:
- Expanding ryoiki paths into graph parent-child edges (slashes are already a serialized chain — D3).
- The alias map as read-time query-synonym resolver.
- Read-time filtering by ryoiki.

Also not built (ADR D10): any registry of allowed ryoiki, any read-side lookup/filter, any inclusion-set materialization, any `package.json` field, any tombstone.

## 7. Acceptance (the branch's ACs)

- **AC0** — obey `RULES.md` (phased, human-in-loop, token-cautious, platform-agnostic).
- **AC1** — a way to test build/`check` without re-drafting: seed confirmed (no-`state`) entries in `index.json` and run `scaffold`/`check` directly (ST04).
- **AC2** — a curated `ryoiki-aliases.json` starting point, not empty (ST02, done).
- **AC3** — codify the mechanical spine in the runner so the skill only carries judgment (ST04 + ST05).

## 8. Success Criteria

1. Originating need met by write-time alone: a demo app's `KNOWLEDGE.md` stays free of build-tooling noise via a confirmed blacklist — no registry, no read machinery.
2. Include-by-default holds; only a short blacklist is maintained; the in-set is derived.
3. Judgment stays human: the skill proposes a ryoiki, then halts; the human confirms in `index.json` (deletes `state`) before anything is written or committed.
4. The blacklist decision is made against the confirmed ryoiki visible in the `index.json` diff (chicken-and-egg fixed); index and headings can't drift.
5. `domain` keeps one meaning; `ryoiki` is a clean within-unit axis.
6. `archive-check.sh` + the consistency check pass; existing `KNOWLEDGE.md` files stay valid unchanged.
