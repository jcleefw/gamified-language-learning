---
name: write-knowledge
description: 'Write KNOWLEDGE.md content from archive summaries — check for duplicates, conflicts, ask before writing unclear sections.'
tools: Read, Write, Exec
disable-model-invocation: true
---

# Write KNOWLEDGE.md (PO-Focused Current State)

Invoked after ryoiki confirmation in archive-epic RECORD flow. Write present-tense facts a PO would care about — no code identifiers, file paths, or history.

## Inputs

**Source of truth:** Archive story summaries in `index.json` (domain filtered). Never read source code.

## Procedure

1. **Read existing KNOWLEDGE.md** — check for duplicate/conflicting claims against what you're about to write.
2. **Map confirmed ryoiki** to their summaries from `index.json` (by domain + ryoiki, non-blacklisted).
3. **Check for conflicts explicitly:**
   - Does this claim already exist elsewhere in KNOWLEDGE.md?
   - Does it contradict an existing claim?
   - If yes to either → flag and ask user before writing.
4. **Judge each heading:** Does it contain PO-relevant product behavior?
   - Yes → draft section
   - No (pure engineering mechanics) → recommend blacklist
   - Unclear → ask user before writing
5. **Zero-weight check:** If no headings survived, report blacklist recommendations and stop.
6. **Translate summaries to plain language** (present tense, nouns, no code paths).
7. **Update frontmatter:** `sources` (add new ids), `updated` (today's date).
8. **Ask user to confirm** before writing if you found conflicts, blacklist candidates, or unclear sections.

## What to write

- Named tools/tech only when the name itself is the claim ("automated tests" label "Vitest").
- What exists, what it's for, what depends on it.
- Known rough edges framed as product risk, not engineering debt.

## What NOT to write

- Code identifiers, file paths, config names, function signatures, API routes.
- Inline epic/story IDs, `file:line` anchors, acceptance criteria, planning meta.
- Anything already forbidden by `RULES.md` §KNOWLEDGE.md Maintenance.
- Duplication of claims across sections.
- Sections you can't trace to a confirmed summary.

## Ask user template

Use this when you hit conflicts, unclear sections, or blacklist candidates:

```
**Conflicts found:**
- [existing claim] (line X) vs [new claim from summary]

**Unclear sections:**
- [ryoiki name]: [reason — too vague, pure mechanics, or unclear if PO-relevant]

**Blacklist candidates:**
- [ryoiki name]: [reason]

Proceed with edits? Confirm conflicts/blacklist/unclear sections above.
```

Do not guess or overwrite without approval.
