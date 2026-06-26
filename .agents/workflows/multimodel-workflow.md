# Multimodel Workflow

Select the appropriate Claude model for your task before starting work.

---

## Quick Model Selection

| Your Task | Model | Command | Why |
|-----------|-------|---------|-----|
| **Architecture, ADRs, RFC, design decisions** | Opus 4.6 | `/model opus` | Best reasoning for complex tradeoffs and design verification |
| **Code review, standards compliance** | Opus 4.6 | `/model opus` | Catches subtle violations, design-to-code alignment checks |
| **Implement stories, write tests** | Sonnet 4.6 | `/model sonnet` | Strong at coding, good balance of quality + speed |
| **Simple refactors, linting fixes, renames** | Haiku 4.5 | `/model haiku` | Fast enough for localized changes |
| **Test writing, validation** | Sonnet 4.6 | `/model sonnet` | Comprehensive test coverage |
| **Quick lookups, file searches, small reads** | Haiku 4.5 | `/model haiku` | Fast, sufficient for navigation |
| **Documentation, changelogs, memory updates** | Haiku 4.5 | `/model haiku` | Adequate for summaries and notes |

---

## Workflow Steps

### Before Starting Any Task

1. **Identify task type** — What are you doing? (implementing, designing, reviewing, etc.)
2. **Check the table above** — Find your task in the left column
3. **Switch model** — Run the suggested `/model` command
4. **Start work** — Proceed with your task

### Example: Implementing a Story

```
You: "I'm starting EP31-ST01"
1. Task = implementing code
2. Table says: Sonnet 4.6
3. Run: /model sonnet
4. Say: "Implement EP31-ST01"
```

### Example: Designing Shelving Mechanism

```
You: "Let's design the shelving mechanism"
1. Task = architecture/design
2. Table says: Opus 4.6
3. Run: /model opus
4. Say: "Create RFC for shelving mechanism in srs-engine"
```

---

## Model Capabilities Summary

| Aspect | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| **Speed** | ⚡⚡⚡ Fast | ⚡⚡ Medium | ⚡ Slower |
| **Code Quality** | Good | Excellent | Excellent |
| **Reasoning** | Adequate | Very Good | Best |
| **Complex Design** | Struggles | Good | Excellent |
| **Token Efficiency** | Best | Good | Standard |
| **Cost** | Cheapest | Mid | Most expensive |

---

## When to Switch Models Mid-Session

- **Starting new task type** → Switch model (e.g., `/model opus` when moving from code to design)
- **Hitting complexity** → Bump up (e.g., `/model sonnet` when Haiku struggles with logic)
- **Need speed** → Drop down (e.g., `/model haiku` when doing simple edits)
- **Same task continues** → Keep model (don't switch between files in one story)

---

## Notes for Your BA/PO Role

As a BA/PO verifying ADR-to-code alignment:
- **Use Opus** for reviewing design specs against implementation
- **Use Sonnet** when doing code inspection for standards compliance
- **Use Haiku** for quick lookups and navigation

---

## See Also

- AGENT.md — Persona and task mapping
- RULES.md — Code standards you're verifying
- PLAYBOOK.md — Common commands
