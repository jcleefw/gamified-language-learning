---
name: archive-epic
description: 'Rolls a merged epic (or completed agentic AGN) onto the two knowledge axes and compacts its folder. Use post-merge, against main, when an epic is done-done. Records work to the time archive + maintains domain KNOWLEDGE.md, then deletes the rolled-up changelog in a separate commit.'
tools: Read, Write, Exec
disable-model-invocation: true
---

# Archive an Epic (Record + Compact)

The post-merge rollup for the two-axis knowledge architecture (Two-Axis ADR,
Compaction ADR). It is the sibling of `dev/change-log-updater`: that skill writes
the per-story logs *during* an epic; this skill rolls them up *after* the epic is
done-done and compacts the folder away.

**Everything mechanical is a script.** Your only two judgment calls are:

1. **Summarise a story** — turn each story's changelog into one verbs sentence
   (what was *done*) for the time archive.
2. **Maintain domain state** — update each touched unit's `KNOWLEDGE.md` to what is
   *true now* (nouns), by area.

Routing (paths→units), append+validate, and integrity are `domains-from-diff.sh`,
`archive-append.sh`, and `archive-check.sh`. Do not hand-edit `index.json`.

## When to run

- **Trigger:** a human "this is done-done" call, normally right after the epic's PR
  **merges to main**. Never run it on the epic's feature branch — a branch is a
  proposal; compacting unmerged work is premature (D10).
- **Run against main:** check out / pull `main` first. The merged folder is intact
  in main until you run this, so there is no freshness cost and a skipped rollup
  loses nothing (the folder simply stays un-compacted — a safe no-op).
- **Gate (default = merge):** compact on merge. If the caller passes
  `--require-verified`, first confirm the epic's UAT/verification is clear and stop
  if not (D10, optional gate).

## Procedure — project track (`EP##`)

1. **Guard.** Confirm you are on `main` and the epic's PR is merged. If not, stop.
2. **Find the units.** Run against the epic's merge range:
   `.agents/tools/domains-from-diff.sh <epic-first-commit>^ <epic-merge-commit>`
   → the workspace units touched. `<non-workspace>` paths (root config, docs) have
   no `KNOWLEDGE.md` home — note them but they carry no domain state.
3. **RECORD (judgment × 2), staged into ONE commit:**
   - For **each story** in the epic's `changelogs/EP##--*/` folder:
     - **[JUDGMENT 1 — verbs]** Summarise it to one archive story object (see Schema
       below), then append it:
       `echo '<story-json>' | .agents/tools/archive-append.sh --story -`
       The `summary` is what was *done* (past tense); no `file:line`, no code — git
       holds the detail (Compaction D5/D6).
     - **[JUDGMENT 2 — nouns]** For its touched unit(s), maintain
       `{unit}/KNOWLEDGE.md` to **current state, by area** (D5 as amended):
       *append* a new area section, *add* a claim to an existing area, *edit* a
       changed claim, or *delete* a claim that is no longer true. **Never regenerate
       the whole file** and **never add a "superseded" section** — retired knowledge
       lives in git + the archive. Update the `sources` frontmatter (add the ids
       whose claims are now present; drop any whose claims you removed) and `updated`.
       Provenance stays in frontmatter, never inline in the prose (D5, D7).
       Start from `.agents/plans/templates/KNOWLEDGE-TEMPLATE.md` if the unit has none.
   - **Fix routing (D5):** *every* fix reaches the archive. A fix reaches
     `KNOWLEDGE.md` **only if it changes current state**. A conformance fix (code
     corrected to match what the doc already said) is archive-only. Test: does it
     change what is *true* about the domain, or just make code match what was
     documented as true?
   - Upsert the epic rollup: `... archive-append.sh --epic EP## --data -` with
     `{title, domains[], archived, notes?}`.
   - Commit the record: `git add index.json {unit}/KNOWLEDGE.md` then
     `git commit -m "docs(archive): record EP## — <title>"`.
4. **COMPACT (self-contained commit — D10 as amended):** in a **separate** commit
   that contains *nothing but the deletion*, remove the rolled-up folder:
   `git rm -r .agents/changelogs/EP##--*/` then
   `git commit -m "docs(archive): compact EP## changelog folder"`.
   Keeping the delete isolated makes it reviewable and revertible on its own.
   (Do **not** open a PR or emit a deletion manifest — those are recorded as future
   automation in the idea doc, not the day-one path.)
5. **Verify:** `.agents/tools/archive-check.sh` must pass (sources resolve, no stray
   archived-epic folder, `_loose/` drained).

## Procedure — agentic track (`AGN##`, D11)

Agentic work has no package to co-locate in; its domain home is the `agentic-*`
ADRs. Same two-commit shape, with the recorded tier expressed as flat markdown:

1. **RECORD commit:**
   - **Compact the plan → artifact.** Rewrite `.agents/changelogs/agentic/plans/AGN##-*.md`
     into a lean flat artifact `.agents/changelogs/agentic/AGN##-*.md` using the
     `AGN-TEMPLATE.md` shape (*What Changed / Why / Before-After*). Drop the
     scaffolding forbidden Recorded-onward (`file:line`, acceptance criteria,
     planning meta — Compaction D5).
   - **Archive entry.** `archive-append.sh --story -` one story with
     `track: "agentic"`, `domain: "agentic/<concern>"`, `epic: "AGN##"` (or the
     `AGN##` id), `pr` = the PR number or `null` if none.
   - **State knowledge → ADRs.** If the work changed a *standing* agentic decision,
     amend the relevant `agentic-*` ADR (status → "Accepted (amended)" + an
     Amended-by line). Pure mechanics (a script/template, no standing-decision
     change) produce only the artifact + archive entry.
   - Commit: `git add` the new flat artifact + `index.json` (+ any amended ADR),
     `git commit -m "docs(archive): record AGN## — <title>"`.
2. **COMPACT commit (self-contained):** `git rm .agents/changelogs/agentic/plans/AGN##-*.md`
   then `git commit -m "docs(archive): compact AGN## plan"`.
3. **Verify:** `.agents/tools/archive-check.sh`.

> Self-referentially, completing **AGN05** follows this agentic path: its plan
> compacts into a flat `AGN05` artifact, an archive `track: "agentic"` story is
> appended, and the Two-Axis ADR is amended for the D5/D10 decisions it implemented.

## Archive story object (Two-Axis D4)

```json
{
  "id": "EP44-ST01", "epic": "EP44", "track": "project",
  "title": "App router setup",
  "domain": "apps/srs-demo", "concern": "routing",
  "completed": "2026-07-15", "duration": "1d",
  "summary": "Installed Vue Router 4; 10 routes on the Screen union; App.vue reduced to a layout shell.",
  "supersedes": [], "fixes": [], "pr": 41
}
```

- `pr` is the **PR number**, never a commit SHA (squash rewrites SHAs — D4). `null`
  only for agentic work with no PR.
- `epic` may be `null` for a loose maintenance story (from `_loose/`) that belongs
  to no epic; set `fixes`/`supersedes` to reference the sealed epic it corrects (D9).
- `concern` is free-form (no controlled vocabulary yet — D1).

## Rules

- Two commits, always: record first, then the self-contained delete. Never fold the
  `git rm` into the record commit.
- Run against `main`, never a feature branch. A skipped rollup is a safe no-op.
- `KNOWLEDGE.md` is current-state prose, by area — never a history log, never
  wholesale-overwritten, never carrying `file:line` or inline IDs. It is **not**
  `CODEMAP.md` (which the `code-mapper` skill owns).
- Do not edit `index.json` by hand — only via `archive-append.sh`.
- Finish only when `archive-check.sh` passes.
