---
name: compact-epic
description: write compacting epic workflow with archive-epic.sh step by step
---

# RULES
- do not guess
- any time unsure, run bash script `archive-epic.sh status` to understand where it last stopped

# Create Bug Report

1. if user call workflow with no Epic now, ask "What is the Epic number"
2. run bash script `archive-epic.sh discover`. present its output as-is. do not guess or suggest a range — wait for user to confirm range
3. once commit range is confirmed, run bash script `archive-epic.sh draft`
4. Invoke the `ryoiki-mapping` skill and provide epic number, wait for return result
5. run bash script `archive-epic.sh scaffold`
6. After scaffold, invoke the `write-knowledge` skill
7. run bash script `archive-epic.sh check`, `archive-epic.sh verify`


