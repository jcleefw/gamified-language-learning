# PLAYBOOK.md

Quick command reference. For details, see the governance files linked below.

---

## Quick Commands

| I want to... | Say this |
|--------------|----------|
| **Plan a feature** | "Create epic for {feature}" |
| **Implement a story** | "Implement {EP##-ST##}" |
| **Design technically** | "Create design spec for {feature}" |
| **Think through an idea** | "Help me think through {concept}" |
| **Propose architecture** | "Create RFC for {proposal}" |
| **Record a decision** | "Create ADR for {decision}" |
| **Report a bug** | "Create bug for {issue}" |
| **Orient to codebase** | "Onboard me to {area}" |
| **Consolidate memory** | "Consolidate memory to main" |

---

## Key References

- [AGENT.md](./AGENT.md) — Role, persona, bootstrap reading order
- [RULES.md](./RULES.md) — Golden rules, code standards, testing protocol, memory protocol
- [WORKFLOW.md](./WORKFLOW.md) — Work item naming, hierarchy, lifecycle
- [CONTEXT.md](./CONTEXT.md) — Tech stack, architecture, domain model
- [SETUP.md](./SETUP.md) — Development environment setup
- [CODEMAP.md](./CODEMAP.md) — Project navigation index

---

## Memory Consolidation

When merging a feature branch to main:

```bash
.agents/tools/memory-consolidate.sh main
```

This consolidates branch memory into `main/` folder, documenting decisions and learnings.

---

## Work Item Types

See [WORKFLOW.md](./WORKFLOW.md) for full definitions.

Quick reference:
- **EP##** — Epic (initiative, 1–4 weeks)
- **EP##-ST##** — Story (one testable unit, 1–3 days)
- **EP##-DS##** — Design Spec (technical blueprint)
- **TA##** — Task (generic work)
- **BUG##** — Bug (defect)
- **RFC##** — Proposal (seeking feedback)
- **ADR##** — Decision (after decision made)

---

## Notes

For detailed guidance on code standards, testing, token-saving, and guardrails → **RULES.md**
