---
name: compact-epic
description: write compacting epic workflow with archive-epic.sh step by step
---

# RULES
- do not guess path, or where to go next
- any time unsure, run bash script `./.agents/tools/archive-epic.sh status` to understand where it last stopped

# Compact Epic Steps

1. if user call workflow with no Epic now, ask "What is the Epic number"
2. Discover 
    a. run bash script `./.agents/tools/archive-epic.sh discover`. present its output as-is. do not guess or suggest a range — wait for user to confirm range
3. Find merge
    a. run bash script `./.agents/tools/archive-epic.sh find-merge EP## --range "<confirmed range>"`. present its output as-is. wait for user to confirm the PR number. 
    b. Once PR number confirmed, bulk-update all `pr: null` stories in the epic via:
    ```
    .agents/tools/archive-set-pr.sh --epic EP## --pr <number[,number,...]>
    ```
    The `pr` field is `integer[] | null` (a story can span multiple PRs). Strip
    the `#` from the tool's `#NN` output — pass bare integers. Do not hand-edit
    `index.json`.
4. Draft compact 
    a. run bash script `./.agents/tools/archive-epic.sh draft`
    b. drafting might be incomplete at this stage, so STOP and ASK user whether to investigate more. If user say yes, read into `.agents/changelogs/EP##-DS##.md` to look for stories with `ST`. if you find some that was included in the earlier draft state, these needs to be added as an entry to `.agents/changelogs/archive/index.json`. Ask for approval to update
5. map ryoiki
    a. invoke skill `.agents/skills/agentic/ryoiki-mapping/SKILL.md` and provide epic number, wait for return result
    b. when result return, run `./.agents/tools/archive-epic.sh status` to ensure ryoiki is confirmed
6. scaffolding for knowledge writing
    a. run bash script `./.agents/tools/archive-epic.sh scaffold`
    b. After scaffold, invoke the `.agents/skills/agentic/write-knowledge/SKILL.md` skill
    c. stop to ask human to review before proceeding
7.  check & verify 
    a. run bash script `./.agents/tools/archive-epic.sh check`, `./.agents/tools/archive-epic.sh verify`
    b. Stop and ask user to check everything
8. **RECORD commit:** confirm change with commit title 
    - Commit: `git add` the new flat artifact + `index.json`, `ryoiki-blacklist.json`, all `KNOWLEDGE.md` changes  (+ any amended ADR),
     `git commit -m "docs(archive): record EP## — <title>"`.
9. **COMPACT commit (self-contained):** `git rm .agents/changelogs/EP##-*.md`
   then `git commit -m "docs(archive): compact EP## plan"`.


