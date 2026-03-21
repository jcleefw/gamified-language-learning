# AGN01: Standardised Timestamps

**Date**: 20260321T103029Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Tool | Template | Workflow
**Files Changed**:
- `.agents/tools/generate-timestamp.sh` (New)
- `.agents/tools/generate-filename.sh`
- `.agents/plans/templates/*.md` (Updated hints)
- `.agents/workflows/create-design-spec.md`
- `.agents/workflows/create-changelog.md`

---

## What Changed

- Created a new utility script `.agents/tools/generate-timestamp.sh` that outputs UTC+10 timestamps in `YYYYMMDDTHHmmssZ` format.
- Updated `generate-filename.sh` to use this tool for internal consistency.
- Added hint comments to all `.md` templates in `.agents/plans/templates/` that use `{TIMESTAMP}`.
- Updated core workflows to include explicit steps for calling the timestamp tool.

## Why

- **Motivation**: Dates were inconsistent across changelogs (some using only `YYYYMMDD`, some using local browser time, etc.). Standardising on UTC+10 ensures total order and predictability in the agentic logs.

## Before / After

- **Before**: Agents had to manually calculate the UTC+10 timestamp or relied on varying system defaults, leading to inconsistent `Created:` and `Date:` fields.
- **After**: Agents can simply run `.agents/tools/generate-timestamp.sh` to get the correct string every time.
