---
track: project                       # project | agentic (D8)
domain: {packages,apps}/<unit>       # workspace unit, or agentic/<ryoiki> — where this work belongs (D1)
ryoiki: <free-form>                  # the distinct aspect of the domain this work is about — same word as the unit's KNOWLEDGE.md heading
fixes: EP##                          # the sealed epic/story this CORRECTS — use `fixes` for a bug/behaviour fix...
# relates: EP##                      # ...or `relates` for a non-fixing follow-on. Exactly one of fixes|relates is required.
---

# <Short title of the loose work>

## What / Why

- {What was changed and why — the essence that will become the archive `summary`.}

## References the sealed epic

- {How this relates to the epic named in `fixes`/`relates` frontmatter — without
  editing that epic's record.}
