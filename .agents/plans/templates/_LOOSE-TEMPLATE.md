---
track: project                       # project | agentic (D8)
domain: {packages,apps}/<unit>       # workspace unit, or agentic/<concern> — where this work belongs (D1)
concern: <free-form>                 # cross-cutting concern within the domain
fixes: EP##                          # the sealed epic/story this CORRECTS — use `fixes` for a bug/behaviour fix...
# relates: EP##                      # ...or `relates` for a non-fixing follow-on. Exactly one of fixes|relates is required.
---

# <Short title of the loose work>

<!--
  A cross-cutting late-work item for a SEALED (merged) epic — see _loose/README.md.
  Completed epics are immutable (D9): this entry REFERENCES the sealed epic, never
  reopens or mutates it. At this item's own merge, `archive-epic` turns it into a
  domain-keyed archive story (epic: null if it belongs to no epic) that references
  the sealed epic via `supersedes`/`fixes`, then `git rm`s this file.

  Keep it lean — verbs, current state. No file:line, no acceptance criteria.
-->

## What / Why

- {What was changed and why — the essence that will become the archive `summary`.}

## References the sealed epic

- {How this relates to the epic named in `fixes`/`relates` frontmatter — without
  editing that epic's record.}
