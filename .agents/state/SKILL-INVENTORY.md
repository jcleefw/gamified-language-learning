# Skill Invocation State

This directory holds transient state for skill-aware guardrails. Read/write operations here should be handled by the orchestration layer, not by agents directly.

## Files

### `last-skill.txt`

Single-line text file containing the name of the most recently invoked skill (e.g., `tdd-plan`, `tdd-implement`).

**Write pattern**: On skill invocation start, write skill name:
```
echo "tdd-plan" > .agents/state/last-skill.txt
```

**Read pattern**: For guardrail checks:
```
cat .agents/state/last-skill.txt
```

**Clear on**: `tdd-implement` invocation (or any non-tdd skill that resets planning context)

### Skill-Context Pairing Rules

| Last Skill | Next Allowed Action | Block Until |
|------------|-------------------|-------------|
| `tdd-plan` | Read only | `tdd-implement` invoked |
| `tdd-implement` | Edit/Write src files | N/A (context reset) |
| Any other skill | No restrictions | N/A |
