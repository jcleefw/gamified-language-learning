# EP17 - SRS Engine Consolidation

**Created**: 20260717T082916Z
**Status**: Completed

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan *(Done)*
**Depends on**: EP20 (`srs-engine-v2` core), EP26 (`srs-shelving`), EP36 (`srs-review`)
**Parallel with**: N/A
**Predecessor**: N/A — this is a packaging/scope consolidation of three existing shipped packages, not a rebuild of any of them
**Architecture**: [SRS Engine Consolidation — Redefined Product Scope & Package Merge](../../../product-documentation/architecture/20260717T080435Z-engineering-srs-engine-consolidation-and-scope.md) (this epic implements that ADR)

---

## Problem Statement

The word lifecycle — learn, shelve when stuck, graduate, schedule for long-term review — is split across three sibling packages (`@gll/srs-engine-v2`, `@gll/srs-review`, `@gll/srs-shelving`) that carry full package scaffolding around ~190 combined lines of actual Review + Shelving logic. This split exists because the engine's scope was originally defined as "the Learning phase" rather than "the whole word lifecycle," making Review and Shelving look like separate concerns instead of two more phases of the same thing. Left uncorrected, every future lifecycle phase repeats the pattern of spinning up another sibling package.

## Scope

**In scope**:

- Redefining the engine's product scope to the whole word lifecycle (docs already partially updated per the ADR)
- Merging `srs-review` and `srs-shelving` source into the engine package as internal modules, then deleting the two standalone packages
- Per-phase sub-path exports (`/learn`, `/shelving`, `/review`) instead of one barrel `index.ts`
- Repo-wide import path and `package.json` dependency updates across all consumers (`apps/srs-demo`, `apps/server`, `apps/cli-demo-db`, `packages/db`, `packages/api-contract`)
- Adding Shelving and Review sections to `docs/02-concepts.md` and `docs/03-walkthrough.md`
- Package rename `srs-engine-v2` → `srs-engine` (last story, done only after everything else is verified working)

**Out of scope**:

- Any change to persistence, store interfaces (`ILearningStore`, `IReviewStore` stay in `packages/db`), FSRS behaviour, or rating-inference logic
- Reconciling the pre-existing doc/code mismatch about where `LearningStore` should live (flagged in the ADR's Related section as a separate follow-up)

---

## Stories

### Phase 1: Package Merge (EP17-PH01)

### EP17-ST01: Fold `srs-shelving` into the engine as an internal `shelving` module

**Scope**: Move `packages/srs-shelving/src/*` into `packages/srs-engine-v2/src/shelving/`, carry its tests over, wire up internal imports — no consumer-facing changes yet.

### EP17-ST02: Fold `srs-review` into the engine as an internal `review` module

**Scope**: Move `packages/srs-review/src/*` into `packages/srs-engine-v2/src/review/`, carry its tests over, wire up internal imports — no consumer-facing changes yet.

### EP17-ST03: Expose per-phase sub-path exports

**Scope**: Configure package `exports` map for `@gll/srs-engine-v2/learn`, `/shelving`, `/review` (no single barrel `index.ts`); verify each sub-path resolves and tree-shakes independently of the others.

### Phase 2: Consumer Migration (EP17-PH02)

### EP17-ST04: Migrate `apps/srs-demo` to sub-path imports

**Scope**: Update imports across `App.vue`, composables, components, and tests to `@gll/srs-engine-v2/learn` and `/shelving` only (never `/review` — server-only per ADR D3); update `package.json` dependency, drop `@gll/srs-shelving`.

### EP17-ST05: Migrate `apps/server` and `apps/cli-demo-db` to sub-path imports

**Scope**: Update imports across server routes, seed scripts, and `cli-demo-db` scripts to the three engine sub-paths as needed; update `package.json` dependencies, drop `@gll/srs-review` and `@gll/srs-shelving`.

### EP17-ST06: Migrate `packages/db` and `packages/api-contract` to sub-path imports

**Scope**: Update any type-only or logic imports in these packages to the new sub-paths; update `package.json` dependencies.

### EP17-ST07: Delete the standalone `srs-review` and `srs-shelving` packages

**Scope**: Remove `packages/srs-review/` and `packages/srs-shelving/` entirely (package.json, tsconfigs, vitest config, README, CODEMAP) once all consumers pass on the new sub-path imports — no empty shells left behind.

### Phase 3: Docs & Rename (EP17-PH03 — last, only after PH01–PH02 are verified)

### EP17-ST08: Update remaining engine docs to whole-lifecycle scope

**Scope**: Add Shelving and Review sections to `packages/srs-engine-v2/docs/02-concepts.md` and `docs/03-walkthrough.md`, matching the structure already applied to `docs/01-stakeholder.md` and `README.md`.

### EP17-ST09: Rename `@gll/srs-engine-v2` → `@gll/srs-engine`

**Scope**: Repo-wide rename of the package name, directory, and every consumer's `package.json` dependency + import path, done only after the merge and sub-path exports are fully verified working under the old name.

---

## Overall Acceptance Criteria

- [x] `docs/02-concepts.md` and `docs/03-walkthrough.md` cover Learning, Shelving, and Review
- [x] `srs-review` and `srs-shelving` logic lives inside the engine package; both standalone packages are deleted
- [x] Consumers import only the phase sub-paths they use (`apps/srs-demo` never imports `/review`)
- [x] All existing tests (engine, demo, server, cli-demo-db, db) pass after migration
- [x] Package is renamed to `@gll/srs-engine` repo-wide, with no lingering `srs-engine-v2` references
- [x] No change in behaviour: FSRS scheduling, shelving policy, and rating inference are bit-for-bit unchanged

---

## Dependencies

- ADR: `20260717T080435Z-engineering-srs-engine-consolidation-and-scope.md`
- EP20, EP26, EP36 (the three packages being merged)

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS)
3. Begin implementation (PH01 first, PH03 docs/rename last as instructed)
