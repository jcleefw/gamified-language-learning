# `_loose/` — cross-cutting late-work staging bucket

Completed epics are **immutable**. Done-done = merged to main; a merged epic is
sealed and never reopened (Two-Axis ADR **D9**). Work discovered *after* an epic
is sealed — a bug in its domain, a small fix, a late story — does not reopen the
epic, and does not warrant a new epic of its own (epic-per-fix is excessive).

It lands here instead, as one flat markdown entry per item, drafted from
[`_LOOSE-TEMPLATE.md`](../../plans/templates/_LOOSE-TEMPLATE.md).

## Convention (not a tool)

Each entry carries, in its frontmatter:

- `track` — `project` or `agentic`
- `domain` — the workspace unit (`apps/*`, `packages/*`) or `agentic/<ryoiki>`
- `fixes` **or** `relates` — the sealed epic/story id it references (never mutates)

## Drain-at-merge

This bucket has **no lifecycle of its own**. Because every entry carries a
`domain` + a `fixes`/`relates` reference, it can always be filed and never
orphaned. At the item's own merge, `archive-epic` turns it into a **domain-keyed**
archive story that *references, never mutates* the prior sealed epic, and the
entry is `git rm`d.

The archive is ordered by `completed` timestamp, so playback stays correct
regardless of which epic a loose entry references — the timeline is the
organising key; the epic is only a label.

`archive-check` fails any `_loose/` entry that lacks a `domain` + a
`fixes`/`relates` reference — that is the guard that keeps the bucket drainable.
