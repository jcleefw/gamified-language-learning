---
name: compact-pr-finder
description: 'Backfills the compact_pr field for archive stories in .agents/changelogs/archive/index.json by locating each epic''s compaction commit in git history. Use when index.json has stories with compact_pr: null that need resolving.'
tools: Read, Exec
disable-model-invocation: true
---

# Compact PR Finder

Single responsibility: resolve `compact_pr: null` entries in the time archive.

## Procedure

1. Read `.agents/changelogs/archive/index.json`. Collect the distinct `epic`
   values among stories where `compact_pr` is `null`.
2. For each such epic, run:
   `.agents/tools/backfill-compact-pr-info.sh <EP_NUMBER>`
3. If the script returns an integer, re-append every story of that epic via
   `archive-append.sh --story - --replace` with `compact_pr` set to that
   number. Do not hand-edit `index.json`.
4. If the script returns `undetermined`, leave `compact_pr: null` for that
   epic's stories — do not guess a value from any other source.
5. Report a summary: which epics were resolved (with PR number) and which
   remain undetermined.

## Rules

- `compact_pr` is only ever set from `backfill-compact-pr-info.sh` output —
  never inferred, never hand-typed.
- Only `archive-append.sh` writes to `index.json`.
