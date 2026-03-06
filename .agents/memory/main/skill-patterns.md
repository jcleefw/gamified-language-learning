# Skill Patterns

Conventions confirmed for skills built in this project.

## Output Directory Conventions

| Artifact type | Directory |
|---|---|
| Architecture decisions (ADRs) | `product-documentation/architecture/` |
| PRDs | `product-documentation/prds/` |
| Session state | `sessions/` |

All use timestamped filenames: `YYYYMMDDTHHMMSSZ-<short-description>.md`

## Architect Skills — 5-Phase Structure

All architect design skills (`fe-design`, `be-design`, `infra-design`, `qa-design`) follow:

1. **Scope** — one question: "What are we designing?"
2. **Interview** — 2–3 questions per round; skip covered ones
3. **Gate** — "I have enough to write this up. Anything to add before I do?"
4. **Output** — structured ADR saved to `product-documentation/architecture/`
5. **Next Steps** — suggest related skills based on ADR content

## Design / Review Split

All architect categories: design skill (Opus) + review skill (Sonnet).
Design = reasoning phase. Review = evaluation phase.

## Skill Input Conventions

- Simple skills (prd, user-story): use `$ARGUMENTS`; ask if empty
- Complex skills (fe-design, tdd-plan): multi-phase interview; never take bulk input upfront

## Create-Skill Discipline

`create-skill` enforces: What → Why → When → Category (one at a time), then propose design, then user approves. Never shortcut.
