# EP17-DS03: Rename `@gll/srs-engine-v2` → `@gll/srs-engine` Specification

**Date**: 20260717T084325Z
**Status**: Draft
**Epic**: [EP17 - SRS Engine Consolidation](../../plans/epics/EP17-srs-engine-consolidation.md)

---

## 1. Feature Overview

Repo-wide rename of the package directory, package name, and every consumer's dependency/import path from `srs-engine-v2` / `@gll/srs-engine-v2` to `srs-engine` / `@gll/srs-engine`. This is EP17-ST09 only, split into its own DS so the rename is a single, mechanical, independently-revertable change that runs strictly after EP17-DS01 (merge + exports) and EP17-DS02 (consumer migration + package cleanup) are both verified working under the old name — a pure rename carries much lower risk than the merge or migration, and bundling it with either would make it harder to isolate a regression to one cause.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Sequencing | Runs only after EP17-DS01 and EP17-DS02 are merged and green | Renaming mid-restructure would make it unclear whether a break came from the merge, the migration, or the rename |
| Scope of the rename | Directory `packages/srs-engine-v2/` → `packages/srs-engine/`; `package.json` `name` field; every import/dependency reference to `@gll/srs-engine-v2` (and its sub-paths `/learn`, `/shelving`, `/review`, `/data/mock/*`) | Sub-paths carry the package name as a prefix, so they must be updated alongside the bare specifier |
| Historical records | `.agents/changelogs/**`, `.agents/plans/epics/**`, `product-documentation/**` are NOT edited | These are point-in-time records of past decisions; rewriting them would falsify the historical record of what the package was called when those docs were written |
| Verification | Full repo `typecheck` + `test` run after the rename, before considering ST09 done | Confirms no consumer was missed; a rename is only as good as its weakest un-updated import |

## 3. Data Structures

No type changes. Mechanical string/path substitution only:

```
srs-engine-v2  → srs-engine
@gll/srs-engine-v2 → @gll/srs-engine
packages/srs-engine-v2/ → packages/srs-engine/
```

## 4. User Workflows

```
START → confirm EP17-DS01 + EP17-DS02 merged and passing
      → git mv packages/srs-engine-v2 packages/srs-engine
      → update packages/srs-engine/package.json name field
      → update every consumer package.json dependency name
      → update every import specifier (bare + sub-path) across consumers
      → update root-level references (package.json, CODEMAP.md, AGENT.md, eslint.config.ts)
      → full repo typecheck + test
      → END
```

## 5. File-Touch Scope (ST09)

Analysis performed against the current (pre-merge) repo state; the same consumer set carries the reference post-merge since EP17-DS02 already pointed every consumer at `@gll/srs-engine-v2` sub-paths. Historical docs (`.agents/changelogs/**`, `.agents/plans/epics/**`, `product-documentation/**` — ~122 more hits) are explicitly excluded per Core Requirements above.

| Category | Files |
| --- | --- |
| `apps/server/src/**` | 19 |
| `apps/cli-demo-db/src/**` | 17 |
| `apps/srs-demo/src/**` | 15 |
| `packages/db/src/**` | 6 |
| `packages/api-contract/src/**` | 1 |
| **Consumer source subtotal** | **58** |
| Consumer `package.json` (server, srs-demo, cli-demo-db, db) | 4 |
| The engine package itself (`package.json`, README, CODEMAP, RULES, `demo/README`, 2 test files) | 8 |
| Root-level (`package.json`, `CODEMAP.md`, `AGENT.md`, `eslint.config.ts`) | 4 |
| **Total** | **~74** |

## 6. Stories

### EP17-ST09: Rename `@gll/srs-engine-v2` → `@gll/srs-engine`

**Scope**: Repo-wide rename of the package name, directory, and every consumer's `package.json` dependency + import path, done only after the merge, sub-path exports, and consumer migration are fully verified working under the old name.
**Read List**: `packages/srs-engine-v2/package.json`, root `package.json` (workspaces), the 74 files enumerated in §5 (grep for `srs-engine-v2` at the start of the story to get a live, current-state list rather than relying on this DS's snapshot)
**Tasks**:
- [ ] `git mv packages/srs-engine-v2 packages/srs-engine`
- [ ] Update `packages/srs-engine/package.json` `name` field to `@gll/srs-engine`
- [ ] Update every consumer `package.json` dependency entry (server, srs-demo, cli-demo-db, db)
- [ ] Update every import specifier across consumer source (bare `@gll/srs-engine-v2` and sub-paths `/learn`, `/shelving`, `/review`, `/data/mock/*`) to `@gll/srs-engine`
- [ ] Update root-level references: `package.json`, `CODEMAP.md`, `AGENT.md`, `eslint.config.ts`
- [ ] Re-run install to regenerate the lockfile / workspace graph

**Acceptance Criteria**:
- [ ] `grep -r "srs-engine-v2"` across `packages/`, `apps/`, and root-level files returns no hits
- [ ] Full repo `typecheck` and `test` pass
- [ ] No behaviour change: FSRS scheduling, shelving policy, and rating inference are bit-for-bit unchanged

## 7. Success Criteria

1. Package is renamed to `@gll/srs-engine` repo-wide, with no lingering `srs-engine-v2` references in live code/config
2. All existing tests (engine, demo, server, cli-demo-db, db) pass after the rename
3. No type errors
4. Historical changelogs, epic plans, and ADRs remain unedited, still correctly describing the package as `srs-engine-v2` as of when they were written
