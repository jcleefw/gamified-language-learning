---
name: compact-epic
description: write compacting epic workflow with archive-epic.sh step by step
---

# Goal
Archive a completed epic end-to-end — discover its commit range, confirm the merge
PR, draft its index entry, map ryoiki, scaffold + write KNOWLEDGE.md, then record
and compact the changelog — using `archive-epic.sh` as the single source of truth
for state.

# RULES
- do not guess path, or where to go next
- any time unsure, run `./.agents/tools/archive-epic.sh status` to understand where it last stopped
- Create a TodoWrite item for every numbered step below verbatim, including sub-steps.
  Do not start executing. Show the checklist first, then work through it one item at a
  time, marking each complete only after the user confirms the output.

# Checklist

1. If no Epic given, ask for the Epic number
2. Discover
    a. run `./.agents/tools/archive-epic.sh discover`. present its output as-is. do not guess or suggest a range — wait for user to confirm range
3. Find merge
    a. run `./.agents/tools/archive-epic.sh find-merge EP## --range "<confirmed range>"`. present its output as-is. wait for user to confirm the PR number.
    b. Once PR number confirmed, bulk-update all `pr: null` stories in the epic via:
    ```bash
    .agents/tools/archive-set-pr.sh --epic EP## --pr <number[,number,...]>
    ```
    The `pr` field is `integer[] | null` (a story can span multiple PRs). Strip the `#` from the tool's `#NN` output — pass bare integers. Do not hand-edit `index.json`.
4. Draft compact
    a. run `./.agents/tools/archive-epic.sh draft`
    b. drafting might be incomplete at this stage, so STOP and ASK user whether to investigate more. If yes, read `.agents/changelogs/EP##-DS##.md` for stories with `ST`. If any were not in the earlier draft state, add them as entries to `.agents/changelogs/archive/index.json`. Ask for approval to update.
5. Map ryoiki
    a. invoke skill `.agents/skills/agentic/ryoiki-mapping/SKILL.md` with the epic number, wait for return result
    b. when result returns, run `./.agents/tools/archive-epic.sh status` to confirm ryoiki is confirmed
6. Scaffold for knowledge writing
    a. run `./.agents/tools/archive-epic.sh scaffold`
    b. invoke `.agents/skills/agentic/write-knowledge/SKILL.md`
    c. stop to ask human to review before proceeding
7. Check & verify
    a. run `./.agents/tools/archive-epic.sh check`, then `./.agents/tools/archive-epic.sh verify`
    b. stop and ask user to check everything
8. **RECORD commit:** confirm change with commit title
    - `git add` the new flat artifact + `index.json`, `ryoiki-blacklist.json`, all `KNOWLEDGE.md` changes (+ any amended ADR)
    - `git commit -m "docs(archive): record EP## — <title>"`
9. **COMPACT commit (self-contained):**
    - `git rm .agents/changelogs/EP##-*.md`
    - `git commit -m "docs(archive): compact EP## plan"`
