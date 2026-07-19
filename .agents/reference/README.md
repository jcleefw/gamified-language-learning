# `.agents/reference/`

Shared reference data consumed by tools and skills.

## `ryoiki-aliases.json` — global ryoiki alias map

A **ryoiki** is a distinct aspect of a workspace unit — the text of a `##`
heading path in that unit's `KNOWLEDGE.md` (e.g. `spaced-repetition`,
`audio-timing`). This file heals *naming drift*: it decides, once and globally,
which spelling is canonical when the same aspect gets named differently across
units or across time.

Shape — an object keyed by **canonical ryoiki name**, each entry carrying a
one-line `description` and the drift-variant spellings that normalize to it:

```json
{
  "spaced-repetition": {
    "description": "SRS scheduling core — FSRS intervals, due-date scheduling, review-card state.",
    "alias": ["srs", "fsrs", "scheduler", "review-scheduling", "review-store"]
  }
}
```

- **Keys are canonical names**; each `alias` entry lists variant spellings that
  show up in `KNOWLEDGE.md` headings or a unit's blacklist and normalize to that
  key. The `description` says what the aspect covers — it is the curation
  rationale, for a human deciding whether a candidate name is really this.
- **Seeded, not empty.** The map ships with a curated starting set covering the
  aspects that already recur across the repo's packages and apps. This is the
  reference the `archive-epic` RECORD step **consults first** when naming a
  ryoiki — a hit means the canonical name is already decided, not re-litigated.
- **Grows by human ratification.** New entries are added at the review gate
  during compaction, when a genuinely new aspect is named or fresh drift is
  noticed (Package-Scoped Knowledge Filtering ADR, D2, D8). There is no tool
  that writes this file — allocation is judgment, not mechanics.
- **Never a gate.** The map only canonicalizes; it never rejects an unknown
  ryoiki. Ryoiki stay free-form strings — there is no controlled vocabulary. A
  name with no entry is used as-is (and is itself a candidate for a future
  curated entry).

Ryoiki themselves are not enumerated here — a ryoiki is just a `##` heading path
in a unit's `KNOWLEDGE.md` (D4). This file records only the *drift healing*
between variant spellings.
