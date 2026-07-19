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

## `ryoiki-blacklist.json` — per-unit ryoiki exclusion

Filtering is **include-by-default**: an unconfigured workspace unit records
every confirmed ryoiki in full. This file is the only maintained control over
that default — a short, per-unit list of ryoiki paths to leave out of that
unit's `KNOWLEDGE.md`.

Shape — an object keyed by **workspace unit** (`apps/*` or `packages/*`), each
value an array of ryoiki-path strings to exclude. One reserved key, `"*"`,
applies to *every* unit in addition to that unit's own list:

```json
{
  "*": ["type-definitions"],
  "apps/srs-demo": ["workspace-tooling", "package-scaffold"]
}
```

- **`"*"` is global, and additive.** Its entries are excluded for every unit,
  on top of whatever that unit lists for itself — never either/or. Use it for
  a ryoiki that's noise everywhere (e.g. `type-definitions`) instead of
  copy-pasting the same entry into every unit, which is the same staleness
  risk D5 warns about for whitelists: a new unit added later would silently
  miss it. `archive-epic.sh blacklist "*" --add <ryoiki>` targets this key the
  same way a real unit key works.
- **Absent unit = fully included (beyond the global set).** A unit with no key
  of its own has no *unit-specific* exclusions — every confirmed ryoiki not
  already caught by `"*"` becomes a `##` heading (D5). Only units with real,
  known noise beyond the global set get an entry.
- **Cascading, longest-prefix-wins.** Listing an entry drops that ryoiki *and*
  every `entry/*` descendant (D6). There is no separate mechanism for
  excluding a whole subtree — the prefix does it.
- **Consulted at the gate.** The `archive-epic` tooling's `scaffold` and
  `check` steps read this file when building or validating a unit's
  `KNOWLEDGE.md`: `scaffold` skips blacklisted ryoiki when printing the
  heading skeleton, and `check` treats a confirmed-but-blacklisted ryoiki as
  legitimately headless rather than drift.
- **Exclusion is lossy by design.** A blacklisted ryoiki is simply never
  written to `KNOWLEDGE.md`. There is no tombstone and no exclusion log
  anywhere in the repo — `index.json` still carries the confirmed entry, and
  git history is the only backstop if a decision needs to be revisited (D9).
- **Edited by hand, routinely.** Unlike the alias map, this file is expected
  to change often — once per unit, at every compaction's review gate, right
  after the unit's ryoiki are confirmed in `index.json`. No tool writes it
  either, for the same reason as the alias map: *what* to exclude is a human
  judgment call about a unit's real content, not something mechanics can
  decide — but here the judgment is expected to recur every time, not just
  when drift is noticed.
