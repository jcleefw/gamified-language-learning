---
name: write-knowledge
description: 'Write KNOWLEDGE.md content from archive summaries — check for duplicates, conflicts, ask before writing unclear sections.'
tools: Read, Edit, Write, Exec
disable-model-invocation: true
---

# Write KNOWLEDGE.md (PO-Focused Current State)

Invoked after ryoiki confirmation in archive-epic RECORD flow.

You are writing for a PO who never reads code. Every sentence must survive
without a code identifier, file path, or history reference. If a claim only
makes sense to an engineer, it doesn't belong here.

## Hard rules (mechanical, not judgment calls)

- **Edit, never regenerate.** Per RULES.md §KNOWLEDGE.md Maintenance: append new
  `##` areas, edit existing bullets in place, delete removed claims. Use `Edit`
  on existing files. Only use `Write` when the file doesn't exist yet (step 0).
- **`sources` frontmatter = bare epic id only.** Match `^EP\d+$`. Before saving,
  scan every entry in `sources` and reject/strip anything with a `-ST`/`-DS`
  suffix. This has been gotten wrong repeatedly — treat it as a checklist item,
  not a style preference.
- Full "what not to include" list lives in RULES.md §KNOWLEDGE.md Maintenance —
  don't restate it here, follow it.

## Inputs

**Source of truth:** Archive story summaries in `index.json` (domain filtered). Never read source code.

## Procedure

0. Find the domain's `KNOWLEDGE.md`. Missing → create from `.agents/plans/templates/KNOWLEDGE-TEMPLATE.md`.
1. Read it in full; note existing claims per area.
2. Map confirmed, non-blacklisted ryoiki to their `index.json` summaries (`.agents/reference/ryoiki-blacklist.json`).
3. For each summary, decide:
   - Duplicates or contradicts an existing claim → flag, don't write yet.
   - Pure engineering mechanics, no product behavior → recommend blacklisting the ryoiki, skip it.
   - Otherwise → translate to a present-tense, plain-language bullet under its area (new area if none fits).
4. If nothing survived step 3 → report blacklist recommendations and stop.
5. Update frontmatter: `sources` (epic-id-only, see Hard rules), `updated` (today).
6. If step 3 produced any flags (conflicts/blacklist candidates/unclear calls), present them and get confirmation before editing. Otherwise, edit directly.

## Ask user template

```
**Conflicts found:**
- [existing claim] (line X) vs [new claim from summary]

**Unclear sections:**
- [ryoiki name]: [reason — too vague, pure mechanics, or unclear if PO-relevant]

**Blacklist candidates:**
- [ryoiki name]: [reason]

Proceed with edits? Confirm conflicts/blacklist/unclear sections above.
```
