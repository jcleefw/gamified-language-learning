---
name: compact-epic
description: write compacting epic workflow with archive-epic.sh step by step
---

# RULES
- do not guess path, or where to go next
- any time unsure, run bash script `./.agents/tools/archive-epic.sh status` to understand where it last stopped

# Create Bug Report

1. if user call workflow with no Epic now, ask "What is the Epic number"
2. run bash script `./.agents/tools/archive-epic.sh discover`. present its output as-is. do not guess or suggest a range — wait for user to confirm range
3. once commit range is confirmed, run bash script `./.agents/tools/archive-epic.sh draft`
    - drafting might be incomplete at this stage, so stop and ask user whether to dig deeper. if user say yes, read into `.agents/changelogs/EP##-DS##.md` to look for stories with `ST`. if you find some that was included in the earlier draft state, these needs to be added as an entry to `.agents/changelogs/archive/index.json`. Ask for approval to update
4. invoke skill `.agents/skills/agentic/ryoiki-mapping/SKILL.md` and provide epic number, wait for return result
5. run bash script `./.agents/tools/archive-epic.sh scaffold`
6. After scaffold, invoke the `.agents/skills/agentic/write-knowledge/SKILL.md` skill
7. stop to ask human to review before proceeding
7. run bash script `./.agents/tools/archive-epic.sh check`, `./.agents/tools/archive-epic.sh verify`
8. **RECORD commit:** confirm change with commit title 
    - Commit: `git add` the new flat artifact + `index.json`, `ryoiki-blacklist.json`, all `KNOWLEDGE.md` changes  (+ any amended ADR),
     `git commit -m "docs(archive): record EP## — <title>"`.
9. **COMPACT commit (self-contained):** `git rm .agents/changelogs/EP##-*.md`
   then `git commit -m "docs(archive): compact EP## plan"`.


