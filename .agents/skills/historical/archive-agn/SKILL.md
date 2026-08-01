---
name: archive-agn
description: 'Rolls a completed agentic work item (AGN##) onto the two-axis knowledge archive and compacts its plan. Use post-merge against main when an AGN is done-done. Records work to the time archive as a flat artifact, updates ADRs if needed, then deletes the rolled-up plan in a separate commit.'
tools: Read, Write, Exec
disable-model-invocation: true
---

# Archive Agentic Work (Record + Compact)

The post-merge rollup for agentic work items (AGN##) following the two-axis
knowledge architecture (Two-Axis ADR, Compaction ADR). Agentic work has no
package to co-locate in; its domain home is the agentic ADRs.

The archival process is a two-commit shape: the plan compacts into a lean flat
artifact, an archive entry is recorded, and any standing decisions are amended.

## When to run

- **Trigger:** "this is done-done" call, normally right after the AGN's PR merges
  to `main`.
- **Run against main:** check out / pull `main` first.

## Procedure

1. **RECORD commit:**
   - **Compact the plan → artifact.** Rewrite `.agents/changelogs/agentic/plans/AGN##-*.md`
     into a lean flat artifact `.agents/changelogs/agentic/AGN##-*.md` using the
     `AGN-TEMPLATE.md` shape (*What Changed / Why / Before-After*). Drop the
     scaffolding forbidden Recorded-onward (`file:line`, acceptance criteria,
     planning meta — Compaction D5).
   - **Archive entry.** `archive-append.sh --story -` one story with
     `track: "agentic"`, `domain: "agentic/<ryoiki>"`, `epic: "AGN##"` (or the
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

## Archive story object (Two-Axis D4)

For agentic work, the archive entry follows this shape:

```json
{
  "id": "AGN05-ST01", "epic": "AGN05", "track": "agentic",
  "title": "Two-Axis Knowledge Architecture",
  "domain": "agentic/knowledge", "ryoiki": "archive-structure",
  "completed": "2026-07-18",
  "summary": "Implemented compaction rules (D4-D11); separated archive from active tracking; amended ADRs for amended decisions.",
  "supersedes": [], "fixes": [], "pr": 123, "compact_pr": null
}
```

- `pr` is the **PR number** that delivered the work, or `null` if not merged via PR.
- `compact_pr` is the **PR number when this story was compacted/archived away** — initially `null`, filled at a later epoch's archival boundary.
- `domain` is `agentic/<ryoiki>` (agentic work lives in the ADR namespace, not a package).
- `ryoiki` is free-form.

## Rules

- Two commits, always: record first (artifact + archive entry + ADR amendments), then
  the self-contained plan deletion. Never fold the `git rm` into the record commit.
- Run against `main`, never a feature branch.
- Do not edit `index.json` by hand — only via `archive-append.sh`.
- If no standing decisions changed, no ADR amendment is needed — just the artifact
  + archive entry + plan deletion.
- Finish only when `archive-check.sh` passes.
