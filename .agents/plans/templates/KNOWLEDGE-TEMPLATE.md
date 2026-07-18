---
unit: {packages,apps}/<unit>        # the workspace unit this doc describes (D1)
concern: <free-form>                 # cross-cutting concern within the unit (routing, scheduling, audio)
sources: []                          # archive ids that shaped this state — [EP20, EP21, EP23]; append, never inline
updated: YYYY-MM-DD                  # date this state was last overwritten
---

# <unit> — <Concern>

<!--
  This is the DOMAIN axis of the two-axis knowledge architecture (Two-Axis ADR).
  Write PURE CURRENT STATE (nouns) — what is true now, and why. Present tense.
  This file is OVERWRITTEN to current state on each relevant merge; it is NOT a
  history log. The history lives once, in the time archive (changelogs/archive/index.json).

  RULES (D5, Compaction D5/D6):
  - NO epic/story IDs inline in the prose ("reached via EP44"). IDs are metadata:
    they live only in the `sources` frontmatter, as citations. When state shifts,
    OVERWRITE the prose and APPEND the new id to `sources` — the growing list IS
    the shift history, as resolvable references.
  - NO `file:line` anchors, code snippets, route tables, or data-structure dumps.
    Reference symbols and behaviour, not locations. git is the detail store.
  - NO acceptance criteria, planning meta, or "the prior draft got X wrong".
  - Only STATE-CHANGING knowledge belongs here. A conformance fix (code corrected
    to match what the doc already described) goes to the archive only — not here.
    Test: does it change what is TRUE about the domain, or just make code match
    what was already documented as true?

  THIS IS NOT `CODEMAP.md`. They are orthogonal artifacts with different jobs and
  must NEVER be merged:
    - CODEMAP answers "what functions/symbols exist here?" — a token-saving lookup
      that mirrors the reality of the code as-of-now, refreshed by the code-mapper
      skill, never epic- or history-aware.
    - KNOWLEDGE (this file) answers "how does this domain behave, and why?" — domain
      state and the decisions behind it.
-->

<Current-state prose. How this domain behaves now and the decisions behind it.
Present tense, nouns. No IDs, no file:line, no scaffolding.>
