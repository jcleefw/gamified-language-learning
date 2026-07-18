# AGN05: Two-Axis Knowledge Architecture — Implementation Plan

**Date**: 20260718T121021Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Tool | Skill | Template | Workflow | Rule
**Status**: **Approved** (2026-07-18)
**Track**: agentic
**Source ADRs**:
- [DS Lifecycle Compaction](../../../../product-documentation/architecture/20260718T021231Z-agentic-ds-lifecycle-compaction.md)
- [Two-Axis Knowledge Architecture](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md)

---

## 1. Overview

Two accepted ADRs decided *how* documentation decays (rewrite-then-delete, three tiers) and *where* the compacted knowledge lands (two axes: a time archive + per-domain `KNOWLEDGE.md`). Neither is built. This plan turns the ADRs' **Tooling** section into an approvable, story-sequenced build.

The design goal is **maximum determinism**: the LLM seam shrinks to exactly two judgment calls — *summarise a story* (verbs → archive) and *write current-state prose* (nouns → `KNOWLEDGE.md`). Everything else — path→domain routing, JSON append, schema validation, integrity checks — is a script in `.agents/tools/`. Nothing lives in `.claude/` or GSD; triggering is git/CI/human, never a provider hook.

**Scope of this plan:** the project-track machinery (archive + domain `KNOWLEDGE.md` + tooling) and the agentic track's *home* (the `agentic-*` ADRs). The **agentic rollup lifecycle is now specified in [Two-Axis D11](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md)** — plan → artifact by compaction, dual-recorded (flat AGN file + `track:agentic` archive entry). AGN05 itself is the first plan to follow it: on completion this file compacts into a flat `AGN05` artifact beside AGN01–04.

## 2. Core Requirements

| Requirement | Decision | Rationale (ADR) |
| ----------- | -------- | --------------- |
| Domain taxonomy | Read from `pnpm-workspace.yaml`; never invent nodes | Two-Axis D1 |
| Archive format | Flat per-story `stories[]` + `epics{}` rollup, JSON | Two-Axis D3, D4 |
| Provenance | `pr` number, never commit SHA | Two-Axis D4 |
| Domain format | Markdown + frontmatter, overwritten to current state | Two-Axis D3, D5 |
| Completion split | Verbs → archive; nouns → `KNOWLEDGE.md`; no third "record" | Two-Axis D6 (amends Compaction D3) |
| Compaction | Rewrite-then-delete, post-merge, against main | Compaction D2; Two-Axis D10 |
| Late fixes | `_loose/` staging bucket, reference sealed epic, never reopen | Two-Axis D9 |
| Fix routing | Every fix → archive; only *state-changing* fixes → `KNOWLEDGE.md` | Two-Axis D5 |
| Line numbers / `file:line` | Planning tier only; forbidden Recorded-onward | Compaction D5, D6 |
| Trigger | Git / CI / human — never a provider hook | Two-Axis Tooling |

## 3. Target Artifacts

```
.agents/
  changelogs/
    archive/index.json          # NEW — the time axis (flat stories[] + epics{})
    _loose/                     # NEW — staging bucket for cross-cutting late work
  plans/templates/
    KNOWLEDGE-TEMPLATE.md       # NEW
    _LOOSE-TEMPLATE.md          # NEW
  tools/
    domains-from-diff.sh        # NEW — paths → workspace units (deterministic)
    archive-append.sh           # NEW — append story + schema-validate
    archive-check.sh            # NEW — integrity guard (invariants)
  skills/dev/
    archive-epic/SKILL.md       # NEW — record+compact, post-merge (2 judgment calls)
    change-log-updater/SKILL.md # UPDATE — emit Supersedes / track (archive-ready)
  workflows/
    backfill-archive/           # NEW — one-time legacy migration
  guardrails.yml                # UPDATE — archive integrity rules

{apps,packages}/<unit>/KNOWLEDGE.md   # NEW per touched unit — the domain axis
```

> **Out of scope:** no retrieval / knowledge-graph layer is built or modified here. AGN05 lays the groundwork — artifacts shaped so a *future* Graph RAG layer can ingest them (the projection contract is [Two-Axis D7](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md)) — without touching any implementation package.

## 4. Completion Workflow (target state)

```
Epic PR merges to main (done-done)
  → archive-epic skill runs against main (NOT the branch — D10)
     → domains-from-diff:  changed paths → workspace units
     → summarise each story (verbs)  → archive-append → index.json  [JUDGMENT]
     → write current state (nouns)   → {unit}/KNOWLEDGE.md          [JUDGMENT]
                                        append epic id to `sources`
     → git rm the EP##--*/ changelog folder (compact)
  → archive-check (on demand): no stray folders, every `sources` id resolves,
                               no orphaned _loose/ items
  → (future retrieval layer re-indexes the artifacts — not built here)
```

## 5. Stories

<!-- Each story = one independently shippable unit. Sequenced by dependency.
     ST01 (foundations) → ST02–04 (deterministic tools) → ST05 (skill that composes them)
     → ST06 (front-of-lifecycle) → ST07 (backfill). -->

### AGN05-ST01: Schema & Templates Foundation

**Scope**: The static contracts everything else depends on — no logic yet.
**Read List**: Two-Axis ADR D4/D5; `ST-CHANGELOG-TEMPLATE.md`; `pnpm-workspace.yaml`
**Tasks**:

- [ ] Create `.agents/changelogs/archive/index.json` seeded empty: `{"stories": [], "epics": {}}`
- [ ] Author a JSON Schema for the archive (story + epic shapes per D4) at `.agents/changelogs/archive/schema.json` — `id, epic|null, track, title, domain, concern, completed, duration, summary, supersedes[], fixes[], pr`
- [ ] Create `.agents/changelogs/_loose/` with a `.gitkeep` and a short `README.md` describing the drain-at-merge convention (D9)
- [ ] Create `.agents/plans/templates/KNOWLEDGE-TEMPLATE.md` — frontmatter (`unit, concern, sources[], updated`) + current-state prose skeleton (D5)
- [ ] Create `.agents/plans/templates/_LOOSE-TEMPLATE.md` — `track, domain, fixes|relates` reference to a sealed epic (D9)

**Acceptance Criteria**:
- [ ] `index.json` validates against `schema.json`
- [ ] Templates carry only metadata + current-state prose — no `file:line`, no acceptance criteria, no planning meta (Compaction D5)
- [ ] `KNOWLEDGE-TEMPLATE.md` clearly states it is **not** `CODEMAP.md` (orthogonal jobs, never merged — D5)

### AGN05-ST02: `domains-from-diff` Tool

**Scope**: Deterministic routing of changed paths → workspace units. No knowledge, no judgment.
**Read List**: `pnpm-workspace.yaml`; Two-Axis D1
**Tasks**:

- [ ] Script at `.agents/tools/domains-from-diff.sh` — input: a git ref range or file list; output: distinct workspace units (`apps/*`, `packages/*`) touched
- [ ] Resolve the domain taxonomy **from** `pnpm-workspace.yaml` globs (never a hardcoded list — D1)
- [ ] Files outside any workspace unit route to `agentic/<concern>` or a documented catch-all (D8)

**Acceptance Criteria**:
- [ ] Given EP44's diff, returns exactly `apps/srs-demo` (D1 worked example)
- [ ] Adding a new package to `pnpm-workspace.yaml` is picked up with zero script edits
- [ ] Concern is left free-form / caller-supplied (no controlled vocabulary yet — D1)

### AGN05-ST03: `archive-append` Tool

**Scope**: Append one story (and upsert its epic rollup) to `index.json`, schema-validated.
**Read List**: ST01 schema; Two-Axis D4
**Tasks**:

- [ ] Script at `.agents/tools/archive-append.sh` — accepts a story object, validates against `schema.json`, appends to `stories[]`, upserts `epics{}`
- [ ] Reject on schema violation with a clear message; never write partial/invalid JSON
- [ ] Preserve `completed`-timestamp ordering as the organising key (D9)

**Acceptance Criteria**:
- [ ] Appending a valid story leaves `index.json` schema-valid
- [ ] A story missing a required field is rejected, file unchanged
- [ ] `pr` accepted as provenance; a commit-SHA-shaped provenance is rejected/flagged (D4)

### AGN05-ST04: `archive-check` Integrity Guard + Guardrail Rules

**Scope**: The invariants that keep the two axes consistent. Runs on demand (no schedule — D10).
**Read List**: `guardrails.yml`; Two-Axis D5/D9/D10 (Risks); ST01 schema
**Tasks**:

- [ ] Script at `.agents/tools/archive-check.sh` enforcing:
  - every `sources` id in any `KNOWLEDGE.md` resolves to an archive epic/story (D5 risk)
  - no archived epic still has a live `changelogs/EP##--*/` folder (D10)
  - no `_loose/` entry lacks a `domain` + `fixes`/`relates` reference (D9)
  - `index.json` validates against `schema.json`
- [ ] Add an archive-integrity block to `.agents/guardrails.yml` (rules, LLM-agnostic)

**Acceptance Criteria**:
- [ ] A deliberately orphaned `sources: [EP99]` fails the check
- [ ] A stray archived-epic folder fails the check
- [ ] Passes clean on the ST01 seed state
- [ ] `guardrails.yml` edit confirmed with user (it is a sensitive file per existing guardrails)

### AGN05-ST05: `archive-epic` Skill (Record + Compact)

**Scope**: The post-merge rollup that composes ST02–04 and carries the two judgment calls. Sibling of `dev/change-log-updater`.
**Read List**: `change-log-updater/SKILL.md`; ST02–04 tools; Two-Axis D6/D10; Compaction D2/D3
**Tasks**:

- [ ] `SKILL.md` at `.agents/skills/dev/archive-epic/` (`tools: Read, Write, Exec`)
- [ ] Procedure: guard *merged-to-main* → `domains-from-diff` → per story: **summarise verbs** → `archive-append`; **write current-state nouns** → `{unit}/KNOWLEDGE.md`, append epic id to `sources`
- [ ] State-changing vs conformance fix routing: every fix → archive; only state-changing → `KNOWLEDGE.md` (D5)
- [ ] Compact: `git rm` the epic's `changelogs/EP##--*/` folder after the append+refresh succeed (D2, D10)
- [ ] Runs **against main, never the branch**; skipped rollup is a safe no-op (folder simply stays — D10)
- [ ] Optional gate: require epic *verified* (UAT clear), not merely merged (D10)
- [ ] **Agentic branch (D11):** for `track:agentic` work, compact the `plans/AGN##-*.md` into a flat `changelogs/agentic/AGN##-*.md` artifact (`AGN-TEMPLATE.md` shape) + `git rm` the plan; `archive-append` a `track:agentic`, `domain:agentic/<concern>` entry; amend the relevant `agentic-*` ADR when a standing decision changed. Same skill or a thin sibling — decide during ST05.

**Acceptance Criteria**:
- [ ] Dry-run on a completed epic (e.g. EP44) produces a schema-valid archive story + a `apps/srs-demo/KNOWLEDGE.md`, and *would* delete the folder
- [ ] `KNOWLEDGE.md` prose contains no epic/story IDs inline — IDs live only in `sources` frontmatter (D5)
- [ ] No `file:line` anchors survive into archive or `KNOWLEDGE.md` (Compaction D5)

### AGN05-ST06: `change-log-updater` — Archive-Ready Output

**Scope**: Small update to the front of the lifecycle so its ST logs feed `archive-epic` cleanly.
**Read List**: `change-log-updater/SKILL.md`; `ST-CHANGELOG-TEMPLATE.md`; Compaction "Related"
**Tasks**:

- [ ] Update `change-log-updater/SKILL.md` and `ST-CHANGELOG-TEMPLATE.md` to emit `Supersedes:` and `track:` fields (Compaction Consequences; Two-Axis D4)
- [ ] Note the completion-compaction handoff: "mark complete" hands off to `archive-epic` at merge (Compaction D3)

**Acceptance Criteria**:
- [ ] A newly generated ST log carries `Supersedes` + `track` and is directly consumable by `archive-append`
- [ ] Existing ST logs remain readable (fields additive, not breaking)

### AGN05-ST07: One-Time Backfill Workflow

**Scope**: Migrate existing completed `EP##`/`AGN##` onto both axes. Fan-out, run once. Forward-accretion, not a 157-file rewrite (Two-Axis Rationale).
**Read List**: `.agents/changelogs/` tree; ST05 skill; EP32 (v1-cleanup, first tombstone candidates)
**Tasks**:

- [ ] Workflow at `.agents/workflows/backfill-archive/` describing the one-time fan-out
- [ ] Prioritise tombstoning the ~26 v1-SRS files (EP02/04–07, deleted by EP32) into epic-level tombstones (Compaction D4)
- [ ] Populate `index.json` + seed `KNOWLEDGE.md` per touched unit from existing changelogs
- [ ] **Agentic (D11):** AGN01–04 are already in compacted flat form — backfill only appends their `track:agentic` archive entries; no rewrite needed

**Acceptance Criteria**:
- [ ] After backfill, `archive-check` passes
- [ ] The v1-SRS epics appear as tombstones, not per-story narration of deleted code
- [ ] Legacy `EP##--*/` folders that were rolled up are removed (git is the backstop)

## 6. Sequencing & Dependencies

```
ST01 ─┬─> ST02 ─┐
      ├─> ST03 ─┼─> ST05 ─> ST06 ─> ST07 (backfill)
      └─> ST04 ─┘
```

ST01 unblocks everything. ST02–04 are independent, parallelizable deterministic tools. ST05 composes them. ST06 makes new logs archive-ready; ST07 backfills the legacy corpus last.

## 7. Success Criteria

1. Completing an epic (at merge) records to two axes and compacts its folder in one skill invocation.
2. The LLM seam is exactly two judgment calls; all routing/append/validation is scripted and provider-neutral.
3. `archive-check` enforces the cross-axis invariants and passes on a clean corpus.
4. Backfill leaves no changelog narrating deleted code; the v1-SRS cluster is tombstoned.
5. Nothing added under `.claude/` or GSD; no provider hook is a trigger.

## 8. Resolved Decisions (at approval, 2026-07-18)

- **Verified vs merged gate (D10):** **Resolved → compact on *merge* (the done-done event).** The `archive-epic` skill documents an optional `--require-verified` gate for teams that want UAT to clear first, but the default is merge. Rationale: the merged folder stays intact in main until rollup runs, so a premature compact is the only real risk and merge is already the hard boundary (D10).
- ~~**Agentic rollup:**~~ **Resolved → [Two-Axis D11](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md)** (2026-07-18): plan → artifact by compaction, dual-recorded (flat AGN file + `track:agentic` archive entry); state changes amend the `agentic-*` ADR.
- **Backfill depth:** **Resolved → tombstone-first, accrete-forward.** The one-time backfill tombstones the ~26 v1-SRS files (EP02/04–07, deleted by EP32) and appends AGN01–04 archive entries now; every other legacy epic accretes onto both axes forward, at its next relevant merge, rather than a 157-file big-bang rewrite (Two-Axis Rationale).
