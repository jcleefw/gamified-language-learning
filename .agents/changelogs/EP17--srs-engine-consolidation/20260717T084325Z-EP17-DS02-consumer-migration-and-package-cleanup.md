# EP17-DS02: Consumer Migration and Package Cleanup Specification *(Done)*

**Date**: 20260717T084325Z
**Status**: Completed
**Epic**: [EP17 - SRS Engine Consolidation](../../plans/epics/EP17-srs-engine-consolidation.md)

---

## 1. Feature Overview

Repoint every consumer of `@gll/srs-review` and `@gll/srs-shelving` to the new `@gll/srs-engine-v2` sub-paths established in EP17-DS01, then delete the two now-unused standalone packages. Covers EP17-ST04 through ST07. Runs strictly after EP17-DS01 is merged and green — consumers need a working sub-path to migrate to before the old packages can be safely deleted. The package rename (EP17-ST09) is EP17-DS03, run only after this DS is verified.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Sequencing | Runs only after EP17-DS01 (ST01-ST03, ST08) is merged and its sub-paths verified resolvable | Consumers can't migrate to an export that doesn't exist yet |
| `apps/srs-demo` phase access | `/learn` and `/shelving` only, never `/review` (server-only per ADR D3) | Enforces the client/server boundary already decided in the ADR |
| Deletion order | `packages/srs-review/` and `packages/srs-shelving/` deleted only in ST07, after ST04-ST06 all pass | No consumer should be left depending on a package that's about to disappear |
| Store interfaces (`ILearningStore`, `IReviewStore`) | Unchanged, stay in `packages/db` | Out of scope per epic — persistence boundary is a separate concern from packaging |

## 3. Data Structures

No new types. Import specifiers change from the old standalone package names to the engine's sub-paths:

```typescript
// before
import { ShelvingPolicy } from '@gll/srs-shelving'
import { FsrsScheduler } from '@gll/srs-review'

// after
import { ShelvingPolicy } from '@gll/srs-engine-v2/shelving'
import { FsrsScheduler } from '@gll/srs-engine-v2/review'
```

## 4. User Workflows

```
START → confirm EP17-DS01 merged, /learn /shelving /review resolve
      → migrate apps/srs-demo to /learn + /shelving (ST04)
      → migrate apps/server + apps/cli-demo-db to /learn /shelving /review as needed (ST05)
      → migrate packages/db + packages/api-contract (ST06)
      → delete packages/srs-review/, packages/srs-shelving/ (ST07)
      → END (all consumers on the new sub-paths, old packages gone,
              still under the srs-engine-v2 name — EP17-DS03 renames it)
```

## 5. Stories

### EP17-ST04: Migrate `apps/srs-demo` to sub-path imports *(Done)*

**Scope**: Update imports across `App.vue`, composables, components, and tests to `@gll/srs-engine-v2/learn` and `/shelving` only (never `/review` — server-only per ADR D3); update `package.json` dependency, drop `@gll/srs-shelving`.
**Read List**: `apps/srs-demo/src/App.vue`, `src/composables/useLearningSession.ts`, `useAppBoot.ts`, `useStore.ts`, `src/types.ts`, `src/components/*.vue`, `src/views/OverviewPage.vue`, `apps/srs-demo/package.json`
**Tasks**:
- [x] Repoint every `@gll/srs-engine-v2` and `@gll/srs-shelving` import to the correct sub-path
- [x] Drop the `@gll/srs-shelving` dependency from `package.json`

**Acceptance Criteria**:
- [x] `apps/srs-demo` has zero imports from `@gll/srs-engine-v2/review`
- [x] `pnpm --filter srs-demo typecheck && test` pass

### EP17-ST05: Migrate `apps/server` and `apps/cli-demo-db` to sub-path imports *(Done)*

**Scope**: Update imports across server routes, seed scripts, and `cli-demo-db` scripts to the three engine sub-paths as needed; update `package.json` dependencies, drop `@gll/srs-review` and `@gll/srs-shelving`.
**Read List**: `apps/server/src/routes/*.ts`, `src/learning/apply-answer.ts`, `src/review/graduation-performance.ts`, `src/seed/*.ts`, `apps/cli-demo-db/src/*.ts`, both `package.json`
**Tasks**:
- [x] Repoint every `@gll/srs-engine-v2`, `@gll/srs-review`, `@gll/srs-shelving` import in both apps to the correct sub-path
- [x] Drop the now-redundant `@gll/srs-review` / `@gll/srs-shelving` dependencies from both `package.json`

**Acceptance Criteria**:
- [x] Neither app depends on `@gll/srs-review` or `@gll/srs-shelving` in `package.json`
- [x] `pnpm --filter server --filter cli-demo-db typecheck && test` pass

### EP17-ST06: Migrate `packages/db` and `packages/api-contract` to sub-path imports *(Done)*

**Scope**: Update any type-only or logic imports in these packages to the new sub-paths; update `package.json` dependencies.
**Read List**: `packages/db/src/sqlite-learning-store.ts`, `sqlite-answer-event-store.ts`, `src/types/learning-store.ts`, `src/types/answer-event-store.ts`, `packages/api-contract/src/srs.ts`, both `package.json`
**Tasks**:
- [x] Repoint imports to the correct sub-path
- [x] Update `package.json` dependencies if either package listed `@gll/srs-review` or `@gll/srs-shelving` directly

**Acceptance Criteria**:
- [x] `pnpm --filter db --filter api-contract typecheck && test` pass

### EP17-ST07: Delete the standalone `srs-review` and `srs-shelving` packages *(Done)*

**Scope**: Remove `packages/srs-review/` and `packages/srs-shelving/` entirely (package.json, tsconfigs, vitest config, README, CODEMAP) once all consumers pass on the new sub-path imports — no empty shells left behind.
**Read List**: root `package.json` (workspaces), `pnpm-lock.yaml` if present
**Tasks**:
- [x] Delete `packages/srs-review/` and `packages/srs-shelving/` directories
- [x] Run install to regenerate the lockfile / workspace graph

**Acceptance Criteria**:
- [x] `grep -r "srs-review\|srs-shelving" packages/ apps/` returns no hits outside historical changelogs/ADRs
- [x] Full repo `typecheck` and `test` pass with the packages removed

## 6. Success Criteria

1. Consumers import only the phase sub-paths they use (`apps/srs-demo` never imports `/review`)
2. Neither app/package depends on `@gll/srs-review` or `@gll/srs-shelving` anymore
3. Both standalone packages are deleted with no empty shells left behind
4. All existing tests (engine, demo, server, cli-demo-db, db) pass after migration
5. No change in behaviour: FSRS scheduling, shelving policy, and rating inference are bit-for-bit unchanged
6. No type errors
7. Package is still named `@gll/srs-engine-v2` at the end of this DS — the rename is EP17-DS03, run only after this DS is verified
