---
name: compact-epic
description: write compacting epic workflow with archive-epic.sh step by step
---

# RULES
- do not guess

# Create Bug Report

1. if user call workflow with no Epic now, ask "What is the Epic number"
2. run bash script `archive-epic.sh discover`. present its output as-is. do not guess or suggest a range — wait for user to confirm range
3. once commit range is confirmed, run bash script `archive-epic.sh draft`
4. Invoke the `ryoiki-mapping` skill and provide epic number, wait for return result


