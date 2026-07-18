---
track: project                       # project | agentic (D8)
domain: {packages,apps}/<unit>       # workspace unit, or agentic/<concern> — where this work belongs (D1)
concern: <free-form>                 # cross-cutting concern within the domain
fixes: EP##                          # the sealed epic/story this CORRECTS — use `fixes` for a bug/behaviour fix...
# relates: EP##                      # ...or `relates` for a non-fixing follow-on. Exactly one of fixes|relates is required.
---

# <Short title of the loose work>

## What / Why

- {What was changed and why — the essence that will become the archive `summary`.}

## References the sealed epic

- {How this relates to the epic named in `fixes`/`relates` frontmatter — without
  editing that epic's record.}
