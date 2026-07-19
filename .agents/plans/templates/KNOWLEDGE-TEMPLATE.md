---
unit: {packages,apps}/<unit>        # the workspace unit this describes; one KNOWLEDGE.md per unit
sources: []                          # archive ids whose claims are present now — [EP20, EP24, EP25]
updated: YYYY-MM-DD
blacklist: []                        # optional ryoiki-paths to NOT record; absent/[] = fully included
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

  RYOIKI. Each `##` heading IS a ryoiki — a distinct aspect of this unit
  (Package-Scoped Knowledge Filtering ADR, D4). Ryoiki carry hierarchy as a
  path in the heading text, like a file path:
    ## review-scheduling
    ## review-scheduling/fsrs
    ## review-scheduling/fsrs/parameters
  Prefix-matching does all the hierarchy work — no separate tag store, no tree
  schema (D3). Names are free-form; a global alias map
  (.agents/reference/ryoiki-aliases.json) canonicalizes drift when noticed (D2).

  blacklist (frontmatter). Ryoiki-paths this unit should NOT record — compaction
  skips them when writing/refreshing this file (D5). Include-by-default: an
  absent or empty blacklist records everything. An entry cascades to all
  descendants and resolves longest-prefix-wins, so naming a coarse node drops
  its whole subtree; a deep path appears only to carve one branch into or out of
  a coarser declaration (D6). Example — a demo app dropping build noise:
    blacklist: [build-tooling, packaging]   # drops build-tooling, build-tooling/*, packaging, …
  Exclusion is lossy by design: an excluded ryoiki is never written here, so it
  is recoverable only from git, not from this doc (D9). The blacklist is the
  single maintained control — never hand-maintain a matching "what's in" list;
  read it off the `##` headings minus the blacklist (D5).
-->

## <Area>

- <Claim true now for this area — clean prose, no IDs.>

## <Another Area>

- <Claim.>
