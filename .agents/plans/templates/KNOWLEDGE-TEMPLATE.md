---
unit: {packages,apps}/<unit>        # the workspace unit this describes; one KNOWLEDGE.md per unit
sources: []                          # archive ids whose claims are present now — [EP20, EP24, EP25]
updated: YYYY-MM-DD
---

# <unit> — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

<!--
  Current state of the domain, by AREA. Nouns, present tense. Maintain it
  incrementally — never regenerate the whole file:
    - new area        → append a `##` section (leave existing areas untouched)
    - new claim        → add a bullet under its area
    - changed claim    → edit it in place
    - removed claim    → delete it (no "superseded" — retired knowledge lives in
                         git and in the time archive)
  Provenance is the `sources` frontmatter, NOT inline in the prose — IDs are
  metadata, never narration like "reached via EP44". Keep `sources` = the ids
  whose claims are present now (add on arrival, drop when none remain).

  Do NOT include: inline epic/story IDs, file:line anchors, code snippets,
  route/data dumps, acceptance criteria, or planning meta. This is NOT CODEMAP.md
  — CODEMAP lists symbols that exist now; KNOWLEDGE says how the domain behaves
  and why.

  RYOIKI. Each `##` heading IS a ryoiki — a distinct aspect of this unit.
  Ryoiki carry hierarchy as a path in the heading text, like a file path:
    ## review-scheduling
    ## review-scheduling/fsrs
    ## review-scheduling/fsrs/parameters
  Prefix-matching does all the hierarchy work — no separate tag store, no tree
  schema. Names are free-form; a global alias map
  (.agents/reference/ryoiki-aliases.json) canonicalizes drift when noticed.

  EXCLUSION is central, not here. A per-unit blacklist in
  .agents/reference/ryoiki-blacklist.json lists ryoiki-paths this unit should
  NOT record; this doc simply omits them. No entry means everything is recorded.
  An entry cascades to its descendants, longest-prefix-wins. An excluded ryoiki
  is never written here — it lives only in git. Read "what's in" off the `##`
  headings; never hand-maintain a separate list.
-->

## <Area>

- <Claim true now for this area — clean prose, no IDs.>

## <Another Area>

- <Claim.>
