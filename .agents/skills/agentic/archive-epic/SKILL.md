---
name: archive-epic
description: 'Rolls a merged, done-done epic (EP##) onto the two-axis knowledge archive and compacts its changelog folder. Use post-merge, against main. Records work to the time archive, maintains each touched unit''s KNOWLEDGE.md behind a ryoiki confirm/blacklist gate, then deletes the rolled-up changelog in a separate commit.'
tools: Read, Write, Exec
disable-model-invocation: true
---

# Archive an Epic (Record + Compact)

The post-merge rollup for the two-axis knowledge architecture (Two-Axis ADR,
Compaction ADR, Package-Scoped Knowledge Filtering ADR). It is the sibling of
`dev/change-log-updater`: that skill writes the per-story logs *during* an
epic; this skill rolls them up *after* the epic is done-done and compacts the
folder away. It covers the **project track** (`EP##`) only — agentic work
(`AGN##`) has no `KNOWLEDGE.md` home and is rolled up by the separate
`archive-agn` skill instead.

**Everything mechanical is `.agents/tools/archive-epic.sh`.** It sequences the
existing archive tools (`epic-commit-range.sh`, `domains-from-diff.sh`,
`archive-append.sh`, `backfill-compact-pr-info.sh`, `archive-check.sh`)
against `index.json` and the central reference files
(`.agents/reference/ryoiki-aliases.json`, `ryoiki-blacklist.json`). Never
hand-edit `index.json` or `ryoiki-blacklist.json` yourself — even the step 3
gate applies the human's decision through `archive-epic.sh confirm` /
`blacklist`, not a direct file edit.

**What cannot do**
- you cannot change history of the files you're asked to archive. 
- do not rename, edit from the archive. 

Two judgment calls remain, and both sit behind an explicit human gate — the
tool only ever applies what the human has already approved; it never picks a
ryoiki or an exclusion on its own (Golden Rule 3):

1. **Confirm each story's ryoiki, or blacklist it** (step 3) — present the
   full draft list in conversation in one pass; the human says, per story,
   "correct" / "rename to X" / "blacklist" (renaming and blacklisting are not
   mutually exclusive — a ryoiki can be both confirmed as correctly named
   *and* excluded from `KNOWLEDGE.md`, D9). Once given, apply the whole
   batch with `archive-epic.sh confirm` + `blacklist` in one step — nothing
   is left half-decided, and no one hand-edits either file
   (Package-Scoped Knowledge Filtering ADR, D8).
2. **Write each unit's `KNOWLEDGE.md`** (step 4) — delegated whole to the
   `write-knowledge` skill, which turns the now-confirmed ryoiki + their
   archive summaries into plain PO/BA-language prose.

## Procedure — project track (`EP##`)

**Prerequisite — read before step 4:** `RULES.md` §Golden Rules,
§KNOWLEDGE.md Maintenance, and §Docstrings vs. Overloading Comments. Golden
Rules overrides everything below; the other two apply because step 4 writes
current-state prose, not history narration.

1. **Resolve the range and find the units.** Run
   `.agents/tools/archive-epic.sh discover EP##`.
   - Prints `status: firm` with `range` and `units` → use both directly in
     step 2.
   - Dies with `status: indeterminate` → **investigate, then ask for
     approval.**
     1. Read the `flags` and full `candidate:` list it printed (entangled
        commits, reverts, already-archived-then-reverted epics all land
        here).
     2. Dig into what's actually causing each flag — e.g. diff the
        entangled/ambiguous commits — to find the best candidate range,
        with concrete proof. Never guess past a flag without evidence.
        - **For `no_merge_marker_found`:** descend from latest commits in
          the candidate list (step 1). The last original work commit is
          your end boundary; commits after it that touch the changelog
          folder are either compacts/reverts or entangled with other epics.
          Last work commit backwards to first commit gives your range.
     3. Present the recommended range and the evidence behind it to the
        user and **wait for approval**, then re-run:
        `.agents/tools/archive-epic.sh discover EP## --range "<sha>^ <sha>"`.
   - Dies with `status: not_found` → no commits reference this epic's
     changelog folder; stop and confirm the epic id with the user before
     proceeding.
   - `<non-workspace>` units (root config, docs) have no `KNOWLEDGE.md`
     home — note them, but their stories still reach the archive in step 2
     (every story gets an entry); they never enter the ryoiki gate or
     `KNOWLEDGE.md`.
2. **Draft.** Run `.agents/tools/archive-epic.sh draft EP##` (add the same
   `--range` override if step 1 needed one). Writes each story in the
   epic's `changelogs/EP##--*/` folder to `index.json` as facts + a
   *suggested* ryoiki + `state:"draft"`. Idempotent by id — an
   already-confirmed (no-`state`) entry is left untouched by a re-run.
3. **STOP — the confirm/blacklist gate (D8, human-only).** Do not proceed
   past this point without the human.
   
   **Present a single table once, for the whole epic:**
   
   | Story | Domain | Current Ryoiki | Suggested Ryoiki | Map Ryoiki |
   |---|---|---|---|---|
   | (one row per draft entry) | | | | |
   
   - Current Ryoiki = what's in the draft (auto-generated from the changelog file)
   - Map Ryoiki = the canonical ryoiki from `.agents/reference/ryoiki-aliases.json`
     (or the suggested ryoiki if no map exists). This is the default.
   - The human responds **once, in plain text**, calling each story by id:
     ```
     ok for ST01, ST03
     rename ST02 ryoiki - design-spec
     blacklist DS01
     ```
   - Choices per story:
     - **No mention** = accept Map Ryoiki as-is
     - **rename [ID] ryoiki - [NEW]** = override Map Ryoiki with the custom name
     - **blacklist [ID]** = confirm the ryoiki (Map or renamed) but exclude from KNOWLEDGE.md
     - Blacklist and rename can both apply to the same story (confirm the name, exclude it)
   
   **Apply the whole batch, once approval is given — that's it.** No
   entry is left pending and no file is hand-edited:
   - `.agents/tools/archive-epic.sh confirm EP##` applies the human's
     approval to all confirmed stories for the epic. Pass `--data -` with 
     a JSON array of `{"id": "...", "ryoiki": "..."}` containing **all 
     stories NOT blacklisted** — each with its final ryoiki (use the Map Ryoiki 
     if untouched, or the renamed value if you said `rename [ID] ryoiki - [NEW]`).
     The `confirm` command deletes each story's `state: "draft"` field. 
     Stories in the --data array are confirmed; any entry not in the array 
     is treated as still pending (state-carrying drafts, unconfirmed).
   - `.agents/tools/archive-epic.sh blacklist <unit> --add r1,r2,...` for
     each unit with new exclusions the human called out (cascading,
     longest-prefix-wins; a unit or ryoiki with no entry is fully
     included — D5/D6).
   
   Never call `confirm`/`blacklist` before the human has actually reviewed
   and answered for the full list — these commands apply a decision, they
   don't make one.
4. **Write.** For each workspace unit touched (skip `<non-workspace>`),
   **STOP and ask user to run the write-knowledge skill manually:**
   
   ```
   .agents/skills/agentic/write-knowledge <unit>
   ```
   
   It reads `archive-epic.sh scaffold <unit>` (the confirmed, non-blacklisted 
   ryoiki as a `##` heading skeleton) and the confirmed story summaries from 
   `archive-epic.sh status EP##`, then drafts or incrementally merges that 
   unit's `KNOWLEDGE.md` in plain PO/BA language. It may come back with 
   further blacklist recommendations (e.g. a ryoiki with no PO-relevant 
   content) — route those to the human and apply via `archive-epic.sh blacklist` 
   (step 3's mechanism) before moving on; it never blacklists on its own.
   - Once a unit's `KNOWLEDGE.md` is settled, commit its record:
   - **Fix routing:** *every* fix reaches the archive (step 2 already did
     this). A fix reaches `KNOWLEDGE.md` **only if it changes current
     state** — a conformance fix (code corrected to match what the doc
     already said) is archive-only. Test: does it change what is *true*
     about the domain, or just make code match what was already
     documented as true?
   - Once every touched unit above is committed, upsert the epic rollup
     (once per epic, no ryoiki dependency):
     `echo '{title, domains[], archived, notes?}' | archive-append.sh --epic EP## --data -`
     Then commit: `git add .agents/changelogs/archive/index.json` and
     `git add index.json {unit}/KNOWLEDGE.md` then
     `git commit -m "docs(archive): record EP## — <title>"`.
5. **Check.** `.agents/tools/archive-epic.sh check` — every confirmed,
   non-blacklisted ryoiki for a unit must be a `##` heading in its doc. A
   confirmed **and** blacklisted ryoiki is legitimately headless (D9), not
   drift; fail only on the rest.
6. **BACKFILL (self-contained commit, only if candidates found):** before
   compacting, sweep the archive for *previous* epics still missing their
   `compact_pr` — unrelated to the epic being archived now, whose own
   `compact_pr` will be filled by a future archival:
   - Run `.agents/tools/archive-epic.sh backfill` — reports each epic with
     `compact_pr: null` and its best-effort resolved PR (`undetermined` if
     none found).
   - **Stop and report** the results to the user before applying anything.
   - **Apply** the resolved values via
     `archive-append.sh --story - --replace`.
   - If any were applied, commit them on their own:
     `git add .agents/changelogs/archive/index.json` then
     `git commit -m "docs(archive): backfill compact_pr for <EP##, EP##, ...>"`.
     If nothing was found, skip this commit — it's a safe no-op.
7. **COMPACT (self-contained commit):** in a **separate** commit containing
   *nothing but the deletion*, remove the rolled-up folder:
   `.agents/tools/archive-epic.sh compact EP##` prints the exact
   `git rm -r` + commit commands — run them. Keeping the delete isolated
   makes it reviewable and revertible on its own.
8. **Verify.** `.agents/tools/archive-epic.sh verify` —
   `archive-check.sh` + step 5's `check`, and refuses to run at all while
   any draft (`state`-carrying) entries remain in `index.json`.

## Archive story object (Two-Axis D4, Package-Scoped Knowledge Filtering D8)

```json
{
  "id": "EP44-ST01", "epic": "EP44", "track": "project",
  "title": "App router setup",
  "domain": "apps/srs-demo", "ryoiki": "client-routing",
  "completed": "2026-07-15", "duration": "1d",
  "summary": "Installed Vue Router 4; 10 routes on the Screen union; App.vue reduced to a layout shell.",
  "supersedes": [], "fixes": [], "pr": 41, "compact_pr": null
}
```

- `pr` is the **PR number** that delivered the work, never a commit SHA
  (squash rewrites SHAs — D4). Extracted by `draft` from the merge commit
  message; `null` if not found.
- `compact_pr` is the **PR number when this story was compacted/archived
  away** — initially `null`, filled at a later epoch's archival boundary
  (step 6 of a future run). This traces when the work left active tracking.
- `epic` may be `null` for a loose maintenance story (from `_loose/`) that
  belongs to no epic; set `fixes`/`supersedes` to reference the sealed epic
  it corrects.
- `ryoiki` is free-form (no controlled vocabulary — D2), written by `draft`
  as a *suggestion* and only real once the human confirms it at the step 3
  gate.
- `state: "draft"` marks an unconfirmed entry. It is the only defined
  non-confirmed value; any other value is still treated as unconfirmed and
  ignored downstream. Drafts live only in the working tree — they never
  commit, so a committed archive is confirmed-only.

## Rules

- Three commit points, never folded together: record (step 4, once per
  unit + the epic upsert), backfill (step 6, only if candidates were
  found), and the self-contained delete (step 7).
- `KNOWLEDGE.md` is current-state prose, by area — never a history log,
  never wholesale-overwritten, never carrying `file:line` or inline IDs.
  It is **not** `CODEMAP.md` (owned by the `code-mapper` skill).
- Never hand-edit `index.json` or `ryoiki-blacklist.json`, including at the
  step 3 gate — apply the human's reviewed decision with
  `archive-epic.sh confirm` / `blacklist`; everything else routes through
  `archive-epic.sh` / `archive-append.sh`.
- **Ryoiki are the `##` headings; the blacklist is the only maintained
  control.** Never hand-maintain a matching "what's in" list — derive it on
  demand with `archive-epic.sh scaffold <unit>`.
- **Exclusion is lossy by design (D9).** A blacklisted ryoiki is simply
  never written to `KNOWLEDGE.md` — there is no tombstone and no exclusion
  log anywhere. `index.json` still carries the confirmed entry, and git
  history is the only backstop if the decision needs revisiting.
- Finish only when `archive-epic.sh verify` passes.
