---
name: write-knowledge
description: 'Writes a workspace unit''s KNOWLEDGE.md content in plain, non-engineer language — the step-4 writer invoked by archive-epic once a unit''s ryoiki are confirmed and blacklisted. Use to draft or refresh a unit''s domain knowledge prose; never to log history or engineering mechanics.'
tools: Read, Write, Exec
disable-model-invocation: true
---

# Write Knowledge (Human-Tone `KNOWLEDGE.md` Prose)

The step-4 writer in `archive-epic`'s RECORD flow (Package-Scoped Knowledge
Filtering ADR, plan §4). By the time this skill runs, ryoiki are already
confirmed (no `state` in `index.json`) and the unit's blacklist is already
edited — the judgment calls this skill makes are narrower: **is there real
knowledge to say, and can it be said in plain language?**

## Read this as: a Product Owner / BA, not an engineer

You are writing for someone who will never open the code. They know the
product, not the implementation. Write nouns and current-state facts they
could repeat in a stakeholder conversation — not what an engineer would put
in a design doc.

**Test for every sentence you write:** would a PO who has never seen this
repo's file tree understand it, and would a "yes/no" question about it be
answerable without opening an editor? If either answer is no, rewrite or cut
it.

**Concise, straight to the point.** State the current fact in one clean
sentence. No storytelling, no history — never narrate how something came to
be, how it used to work, or what changed to get here (that's the archive's
job, not `KNOWLEDGE.md`'s). Say what's true now, plainly, and stop.

### Do NOT include, as content

- Code identifiers (`camelCase`/`PascalCase` symbol names), file paths, or
  config filenames (`vitest.config.ts`, `package.json`, `tsconfig.json`) —
  they carry no meaning for this reader.
- API names, function signatures, or route/schema dumps.
- Anything already forbidden by `RULES.md` §KNOWLEDGE.md Maintenance
  (inline epic/story IDs, `file:line` anchors, acceptance criteria, planning
  meta, "superseded" sections).

### DO include

- Named tools/technologies **only when the name itself is the PO-relevant
  fact** — e.g. "automated tests" is the claim; naming the tool (Vitest) is
  fine as a label, not as a path into how it's wired up.
- What capability exists, what it's for, what depends on it holding up.
- What to **watch**: coverage gaps, fragile dependencies, known rough edges —
  framed as risk a PO should know about, not as a bug tracker entry.

## Inputs

For a unit (`apps/<name>` or `packages/<name>`), exactly two sources — **nothing
else**. `<non-workspace>` domain entries (root config, docs) have no
`KNOWLEDGE.md` home — they reach the archive only; this skill never runs
against them.

1. **Confirmed, non-blacklisted ryoiki** — the heading skeleton:
   `.agents/tools/archive-epic.sh scaffold <unit>`
2. **The confirmed archive story summaries behind each of those ryoiki** —
   `.agents/tools/archive-epic.sh status <EP##>` (or read `index.json`
   directly: entries where `domain == <unit>` and no `state`, grouped by
   `ryoiki`). Each story's `summary` is the entire evidence base for its
   heading.

**The archive is the only source of truth.** Never read the unit's source,
tests, config, or README to fill in "what's actually true now" — if the
confirmed summaries under a ryoiki don't carry a PO-relevant claim, that is
the signal to recommend blacklisting it (step 2 below), not a cue to go dig
up better material by reading code. A claim this skill writes must trace to
a summary sentence in `index.json`, or it doesn't get written.

## Procedure

1. **Gather, per heading.** For every confirmed ryoiki heading for this
   unit, pull every confirmed story summary filed under it (inputs above) —
   nothing more.
2. **Judge every heading before writing anything.** Across *all* headings
   for this unit, not one at a time:
   - Summaries state genuine domain/product behavior a PO would care about
     → mark the heading to draft (step 4).
   - Every summary under a heading is entirely engineering mechanics (e.g.
     "scaffolded the package, tsconfig, build/test config") with nothing a
     PO would ever ask about → mark the heading as a blacklist
     recommendation, not filler. Do not stop or write yet — keep judging
     the rest of the headings first.
3. **Zero-weight check.** If no heading survived judging — every pointer
   from `index.json` for this unit carried only mechanics, none of them
   PO-relevant — **do not write anything.** Do not touch `KNOWLEDGE.md`,
   do not create it, do not stub a section "for completeness." Report all
   the blacklist recommendations from step 2 in one message and stop; there
   is nothing left for this skill to do this run. Don't write for the sake
   of writing.
4. **Draft in plain language,** for each heading that survived judging,
   translating the summaries' *facts* (not their wording — summaries are
   past-tense changelog verbs; `KNOWLEDGE.md` is present-tense current
   state). Nouns, present tense — per `RULES.md` §KNOWLEDGE.md Maintenance
   Content Style. Merge incrementally into the existing doc (append a new
   `##` section, add/edit/delete a bullet) — never regenerate the file
   wholesale.
5. **Maintain frontmatter.** Update `sources` (add ids whose claims are now
   present, drop any whose claims you removed) and `updated`. Provenance
   lives only in frontmatter, never narrated inline.
6. **Report once.** After writing (if anything survived step 2), report the
   blacklist recommendations for the headings that didn't in a single
   consolidated message — don't interrupt per heading. Wait for the human's
   decision; do not edit the blacklist file yourself (D8 — allocation is
   judgment, not mechanics; the same rule that keeps this skill from
   auto-writing keeps it from auto-blacklisting).


## Rules

- The archive summaries are the **only** source — never read source, tests,
  config, or README to find content.
- Never write a section you can't trace to a confirmed summary — recommend
  blacklisting instead (see step 2 above).
- If every heading for a unit garners no PO-relevant weight, don't write
  anything — not even an empty file or a placeholder section. Don't write
  for the sake of writing.
- Never edit `.agents/reference/ryoiki-blacklist.json` — recommend only; the
  human edits it (D8).
- Never invent a heading — the ryoiki list comes from `scaffold`, not from
  what you think should exist.
- Never commit. Writing the file is this skill's job; `git add`/`git commit`
  belongs to the calling `archive-epic` step.
- Never regenerate a `KNOWLEDGE.md` wholesale — incremental maintenance only.
