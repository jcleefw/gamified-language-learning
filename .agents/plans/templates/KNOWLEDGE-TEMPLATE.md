---
unit: {packages,apps}/<unit>        # the workspace unit this describes; one KNOWLEDGE.md per unit
sources: []                          # archive ids whose claims are present now — [EP20, EP24, EP25]
updated: YYYY-MM-DD
---

# <unit> — Domain Knowledge

<!--
  Current state of the domain, by AREA. Nouns, present tense. Maintain it
  incrementally — never regenerate the whole file:
    - new area        → append a `##` section (leave existing areas untouched)
    - new claim        → add a bullet under its area
    - changed claim    → edit it in place
    - removed claim    → delete it (no "superseded" — retired knowledge lives in
                         git and in the time archive)
  Provenance is the `sources` frontmatter, NOT inline in the prose — IDs are
  metadata, never narration like "reached via EP44" (D5; the graph reads
  frontmatter sources as its edges, D7). Keep `sources` = the ids whose claims
  are present now (add on arrival, drop when none remain).

  Do NOT include: inline epic/story IDs, file:line anchors, code snippets,
  route/data dumps, acceptance criteria, or planning meta. This is NOT CODEMAP.md
  — CODEMAP lists symbols that exist now; KNOWLEDGE says how the domain behaves
  and why.
-->

## <Area>

- <Claim true now for this area — clean prose, no IDs.>

## <Another Area>

- <Claim.>
