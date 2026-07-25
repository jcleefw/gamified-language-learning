#!/usr/bin/env bash
# .agents/tools/archive-epic.sh
# Mechanical spine of the archive-epic skill (Package-Scoped Knowledge
# Filtering ADR; plan .agents/changelogs/agentic/plan/…AGN06…, §4, ST04).
#
# It sequences the existing archive tools (epic-commit-range, domains-from-diff,
# archive-append, backfill-compact-pr-info, archive-check) against
# `index.json` and the central reference files. It NEVER commits, NEVER
# writes KNOWLEDGE.md prose, and NEVER invents a ryoiki or a blacklist entry
# on its own (Golden Rule 3) — `confirm`/`blacklist` only ever apply what a
# human has already approved; they never run unattended and never pick a
# ryoiki or exclusion themselves.
#
# Draft entries are written directly to `index.json` (not through the strict
# `archive-append` path, which stays for confirmed entries) so they can carry
# an unconfirmed `state` field. They live only in the working tree — the git
# diff of index.json IS the review surface (§4, no hidden worksheet). Nothing
# forces them to be resolved before the next command; `verify` refuses to run
# archive-check.sh while any draft entries are left lying around, since a
# stray draft's `state` field is not schema-legal.
#
# Steps (§4 of the plan):
#   discover   resolve commit range + route to touched units, read-only
#   draft      write each story to index.json as facts + suggested ryoiki + state:"draft"
#   status     list an epic's index entries split into draft vs confirmed
#   confirm    apply human-approved renames + delete state for an epic's drafts (bulk-accept)
#   blacklist  append human-approved ryoiki exclusions to a unit's blacklist entry
#   scaffold   print a unit's confirmed, non-blacklisted ryoiki as a `##` heading skeleton
#   check      confirmed, non-blacklisted index ryoiki ⊆ `##` headings in the unit's doc
#   verify     archive-check.sh + check (refuses if any draft entries remain)
#   backfill   scan index.json for compact_pr: null and try to resolve it (report only)
#   compact    print the git rm -r + commit + archive-append commands (human runs them)
#
# Usage:
#   archive-epic.sh discover EP## [--range "<sha>^ <sha>"]
#   archive-epic.sh draft EP## [--range "<sha>^ <sha>"]
#   archive-epic.sh status EP##
#   archive-epic.sh confirm EP## [--data -]   # JSON array of {id, ryoiki?} renames on stdin
#   archive-epic.sh confirm EP## --map "st01: ryoiki-name, st02: ryoiki-name, ~~st03~~"
#     bare "st01" -> EP##-ST01 (case-insensitive); ~~id~~ deletes that draft entry;
#     ids not mentioned are left as untouched drafts (human shorthand, no AI round-trip)
#   archive-epic.sh blacklist <apps/foo|packages/bar> --add ryoiki1,ryoiki2
#   archive-epic.sh scaffold <apps/foo|packages/bar>
#   archive-epic.sh check
#   archive-epic.sh verify
#   archive-epic.sh backfill
#   archive-epic.sh compact EP##
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/archive-epic.mjs" "$@"
