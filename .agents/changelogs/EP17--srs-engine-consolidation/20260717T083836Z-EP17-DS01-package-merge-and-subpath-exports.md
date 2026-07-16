# EP17-DS01: Package Merge and Sub-path Exports Specification

**Date**: 20260717T083836Z
**Status**: Completed
**Epic**: [EP17 - SRS Engine Consolidation](../../plans/epics/EP17-srs-engine-consolidation.md)

---

## 1. Feature Overview

Fold `@gll/srs-review` and `@gll/srs-shelving` source into `@gll/srs-engine-v2` as internal phase modules (`src/learn/`, `src/shelving/`, `src/review/`), expose each phase as its own sub-path export (no barrel `index.ts`), and update the engine's own docs to whole-lifecycle scope. Covers EP17-ST01, ST02, ST03, ST08 — everything that happens *inside* `packages/srs-engine-v2` itself, with the old standalone `srs-review`/`srs-shelving` packages left untouched and still buildable throughout. No consumer (`apps/srs-demo`, `apps/server`, etc.) is touched by this DS — that's EP17-DS02. The package rename is EP17-DS03.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Module layout | `src/learn/`, `src/shelving/`, `src/review/`, each owning its own `index.ts`, `types.ts`, tests | Makes the three lifecycle phases structurally symmetric; matches the ADR's "whole word lifecycle" scope |
| Existing `src/engine/`, `src/types/`, `src/utils/` | Fold into `src/learn/` in ST03 alongside the exports-map work, not left at package root | Learn is a phase like Shelving/Review — it shouldn't be the only one living at package root |
| `src/config/language.ts` | Stays at `src/config/` (not moved into `learn/`) | Cross-phase config, not learn-specific |
| Package `exports` map | Three sub-paths: `./learn`, `./shelving`, `./review` — no top-level `.` barrel | ADR requires per-phase imports so consumers can't accidentally pull in phases they don't use (e.g. srs-demo importing `/review`) |
| Existing `./data/mock/*` sub-path exports | Left untouched | Unrelated to phase restructuring |
| Old `srs-review`/`srs-shelving` packages | Left in place, untouched, still buildable standalone | Nothing in this DS deletes or repoints them — that's ST07 in EP17-DS02, after consumers have migrated |
| Docs scope | `docs/02-concepts.md` and `docs/03-walkthrough.md` only (ST08) | `docs/01-stakeholder.md` and `README.md` are already updated per the ADR; this DS finishes the remaining two |

## 3. Data Structures

No new types are introduced. Existing types move wholesale with their modules:

```typescript
// packages/srs-engine-v2/src/shelving/types.ts (moved from packages/srs-shelving/src/types.ts, unchanged)
// packages/srs-engine-v2/src/shelving/policy.ts (moved from packages/srs-shelving/src/policy.ts, unchanged)

// packages/srs-engine-v2/src/review/types.ts (moved from packages/srs-review/src/types.ts, unchanged)
// packages/srs-engine-v2/src/review/FsrsScheduler.ts (moved from packages/srs-review/src/FsrsScheduler.ts, unchanged)
```

`package.json` `exports` map target shape (name unchanged until DS03):

```json
{
  "name": "@gll/srs-engine-v2",
  "exports": {
    "./learn": { "import": "./dist/src/learn/index.js", "types": "./dist/src/learn/index.d.ts" },
    "./shelving": { "import": "./dist/src/shelving/index.js", "types": "./dist/src/shelving/index.d.ts" },
    "./review": { "import": "./dist/src/review/index.js", "types": "./dist/src/review/index.d.ts" },
    "./data/mock/mock-decks": { "...": "unchanged" }
  }
}
```

## 4. User Workflows

```
START → move srs-shelving/src → src/shelving/ (ST01)
      → move srs-review/src → src/review/ (ST02)
      → fold engine/types/utils → src/learn/, wire exports map for /learn /shelving /review (ST03)
      → update docs/02-concepts.md, docs/03-walkthrough.md (ST08)
      → END (engine package is internally restructured and self-consistent;
              old srs-review/srs-shelving packages still exist untouched;
              no consumer has been repointed yet — that's EP17-DS02)
```

## 5. Stories

### EP17-ST01: Fold `srs-shelving` into the engine as an internal `shelving` module *(Done)*

**Scope**: Move `packages/srs-shelving/src/*` into `packages/srs-engine-v2/src/shelving/`, carry its tests over, wire up internal imports — no consumer-facing changes yet.
**Read List**: `packages/srs-shelving/src/index.ts`, `policy.ts`, `types.ts`, `__tests__/unit/policy.test.ts`, `__tests__/unit/exports.test.ts`; `packages/srs-engine-v2/package.json`
**Tasks**:
- [x] Move `types.ts`, `policy.ts`, `index.ts` to `packages/srs-engine-v2/src/shelving/`
- [x] Move `__tests__/unit/policy.test.ts`, `__tests__/unit/exports.test.ts` to `src/shelving/__tests__/`
- [x] Update any relative imports broken by the move

**Acceptance Criteria**:
- [x] `packages/srs-engine-v2` builds and its shelving tests pass in the new location
- [x] `packages/srs-shelving` is untouched (still builds standalone)

### EP17-ST02: Fold `srs-review` into the engine as an internal `review` module *(Done)*

**Scope**: Move `packages/srs-review/src/*` into `packages/srs-engine-v2/src/review/`, carry its tests over, wire up internal imports — no consumer-facing changes yet.
**Read List**: `packages/srs-review/src/index.ts`, `FsrsScheduler.ts`, `types.ts`, `__tests__/unit/FsrsScheduler.test.ts`, `__tests__/unit/exports.test.ts`
**Tasks**:
- [x] Move `types.ts`, `FsrsScheduler.ts`, `index.ts` to `packages/srs-engine-v2/src/review/`
- [x] Move both test files to `src/review/__tests__/`
- [x] Update any relative imports broken by the move

**Acceptance Criteria**:
- [x] `packages/srs-engine-v2` builds and its review tests pass in the new location
- [x] `packages/srs-review` is untouched (still builds standalone)

### EP17-ST03: Expose per-phase sub-path exports *(Done)*

**Scope**: Fold existing `src/engine/`, `src/types/`, `src/utils/` into `src/learn/`; configure the package `exports` map for `@gll/srs-engine-v2/learn`, `/shelving`, `/review` (no single barrel `index.ts`); verify each sub-path resolves and tree-shakes independently of the others.
**Read List**: `packages/srs-engine-v2/package.json`, `src/index.ts`, `src/engine/*`, `src/types/*`, `src/utils/shuffle.ts`, `tsconfig.build.json`
**Tasks**:
- [x] Move `src/engine/*`, `src/types/*`, `src/utils/*` into `src/learn/` (preserving relative structure), update internal imports
- [x] Create `src/learn/index.ts`, `src/shelving/index.ts`, `src/review/index.ts` barrels
- [x] Delete top-level `src/index.ts`
- [x] Update `package.json` `exports` map to the three sub-paths (leave `./data/mock/*` untouched)

**Acceptance Criteria**:
- [x] `import ... from '@gll/srs-engine-v2/learn'`, `/shelving`, `/review` each resolve correctly in a scratch test
- [x] No lingering import of the deleted top-level barrel anywhere in `packages/srs-engine-v2`
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck && test` pass

### EP17-ST08: Update remaining engine docs to whole-lifecycle scope *(Done)*

**Scope**: Add Shelving and Review sections to `packages/srs-engine-v2/docs/02-concepts.md` and `docs/03-walkthrough.md`, matching the structure already applied to `docs/01-stakeholder.md` and `README.md`.
**Read List**: `packages/srs-engine-v2/docs/01-stakeholder.md`, `README.md` (already updated, use as the template), `docs/02-concepts.md`, `docs/03-walkthrough.md` (current state)
**Tasks**:
- [x] Add Shelving and Review sections to `02-concepts.md`
- [x] Add Shelving and Review sections to `03-walkthrough.md`

**Acceptance Criteria**:
- [x] Both docs describe Learning, Shelving, and Review as peer phases of one lifecycle

## 6. Success Criteria

1. [x] `srs-review` and `srs-shelving` logic lives inside `@gll/srs-engine-v2`, exposed via `/learn`, `/shelving`, `/review` sub-paths
2. [x] The old standalone `srs-review`/`srs-shelving` packages still exist and still build — this DS does not delete them
3. [x] No consumer has been repointed to the new sub-paths yet
4. [x] `packages/srs-engine-v2` docs (`02-concepts.md`, `03-walkthrough.md`) cover Learning, Shelving, and Review
5. [x] No change in behaviour: FSRS scheduling, shelving policy, and rating inference are bit-for-bit unchanged
6. [x] No type errors
