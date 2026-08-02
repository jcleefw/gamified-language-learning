# EP18-DS02: Phase 2 — Monorepo Boundary Enforcement Specification

**Date**: 20260802T182947Z
**Status**: Completed
**Epic**: [EP18 - Monorepo Linting & Boundary Enforcement](../../plans/epics/EP18-monorepo-linting-and-boundary-enforcement.md)
**Covers**: EP18-PH02 (EP18-ST05–ST09) only. Phase 1 (ST01–ST04) is covered by EP18-DS01.

---

## 1. Feature Overview

Five new ESLint boundary rules, generalizing the `no-restricted-imports` approach proven in Phase 1 (EP18-DS01) beyond `packages/srs-engine`. Four of the five (ST05–ST08) are flat `no-restricted-imports` blocks — same mechanism, same zero-new-dependency footprint as Phase 1. The fifth (ST09) is structurally different: cycle detection cannot be expressed as a `no-restricted-imports` pattern, so it needs a new plugin (`eslint-plugin-import`'s `import/no-cycle` rule), scoped narrowly to `apps/srs-demo/src/composables/**` only — not applied repo-wide.

Verified directly (grep, package.json dependency lists) before writing this spec, not assumed:

- `packages/logger`'s only dependency is `pino`; `packages/shared-utils` has no dependencies at all. Both are true leaves today.
- `packages/api-contract`'s only dependency is `zod`. No `@gll/db`, `@gll/server`, `drizzle-orm`, or `better-sqlite3` import exists in its source.
- `apps/srs-demo/package.json` depends only on `@gll/api-contract`, `@gll/shared-utils`, `@gll/srs-engine` — no `@gll/db`.
- No app's `package.json` lists another app as a dependency, and no app's source imports another app's source (relative-path reach-through or otherwise). `apps/srs-demo` has no path aliases configured (`vite.config.ts` has no `resolve.alias`, no tsconfig `paths`) — cross-app imports, if they existed, would only be reachable via relative path traversal (e.g. `../../../server/src/...`), which is what ST08's rule targets.
- `apps/srs-demo/src/composables/**` has 19 `.ts` files; no cycle-detection tooling (`eslint-plugin-import`, `dependency-cruiser`, `madge`) is currently installed anywhere in the repo.

All five rules are additive to the existing root `eslint.config.ts` (flat config via `tseslint.config(...)`), enforced through the existing `lint-staged` pre-commit hook (EP18-ST03) and CI `lint` job — no new enforcement mechanism needed for ST05–ST08. ST09 needs a new devDependency and is scoped as an investigation-first story (baseline unmeasured).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| ST05 rule shape | `no-restricted-imports` with `patterns: [{ group: ['@gll/*'] }]`, scoped to `packages/{logger,shared-utils}/src/**/*.ts` | Single glob-scoped block covers both packages; `@gll/*` blocks every workspace package uniformly — no per-package allowlist needed since both are confirmed true leaves |
| ST06 rule shape | `no-restricted-imports` with `paths: [{ name: '@gll/db' }, { name: '@gll/server' }]` plus `patterns` for `drizzle-orm`, `better-sqlite3`, and relative reach-through into `**/packages/db/**` | Named-path blocking catches the bare-import case (matches ST02a's precedent); pattern blocking catches both DB-driver packages directly and any relative bypass attempt |
| ST07 rule shape | Extend the existing ST02b block (`files: ['apps/srs-demo/**/*.ts']`) by adding `{ name: '@gll/db' }` to its `paths` array, rather than a new block | Same file scope as the existing `@gll/srs-engine/review` blacklist; one block per file-scope is simpler to read and maintain than two near-duplicate blocks |
| ST08 rule shape (rescoped) | Bare-segment `patterns` (`**/server/**`, `**/srs-demo/**`, `**/cli-demo-db/**`), not `**/apps/<name>/**` — verified via direct ESLint `Linter` probe that the `apps/`-prefixed form does not match realistic relative traversal (`../../../server/src/...`), while the segment-boundary form does, with no substring false-positive risk (e.g. `somepackage-server` does not match `**/server/**`). Also add `paths` bans on each app's package name, as forward-looking insurance against a future cross-app package dependency. | The original `**/apps/<name>/**` shape only matches a contrived deep-traversal path, not the real vector — a rule that never fires isn't enforcement. Confirmed empirically before implementation, not assumed. |
| ST08 config placement (rescoped) | ESLint flat config does not merge `no-restricted-imports` options across two config objects whose `files` glob matches the same file — the later block in array order fully replaces the earlier one's options for that rule, not merges with them. Confirmed empirically: adding new `apps/server` and `apps/cli-demo-db` blocks after the existing ST02a block (`files: ['apps/**/*.ts', ...]`, bans bare `@gll/srs-engine`) silently dropped ST02a's ban for those two apps' files. Fix: each new ST08 block must restate the bare-`@gll/srs-engine` path ban inline (not just the other-apps bans), and the `srs-demo` case must merge into the existing ST02b/ST07 block rather than add a fourth competing block over the same files. | Without this, ST08 would ship a regression in already-enforced Phase-1 behavior (ST02a) for `apps/server` and `apps/cli-demo-db`, and would compound (not fix) `srs-demo`'s pre-existing loss of the same ban. This is scoped to what ST08 itself introduces — the `srs-demo` and `packages/api-contract` (ST06) instances of this same defect that predate ST08 are tracked separately, not fixed as part of this story. |
| ST09 tooling | `eslint-plugin-import` + `import/no-cycle`, new devDependency, scoped to `files: ['apps/srs-demo/src/composables/**/*.ts']` only | No syntactic `no-restricted-imports` equivalent exists for cycle detection; `eslint-plugin-import` is the standard ESLint-native option (vs. a separate CLI like `madge`/`dependency-cruiser`, which would need its own pre-commit/CI wiring outside the existing lint pipeline) |
| ST09 resolver | Default Node resolver (no `eslint-import-resolver-typescript` needed) | `apps/srs-demo` has zero path aliases (`vite.config.ts` has no `resolve.alias`; no tsconfig `paths`) — all internal imports are plain relative paths, which the default resolver handles without extra config |
| ST09 baseline | Investigate-first: run `import/no-cycle` in report-only/dry mode against `apps/srs-demo/src/composables/**` before enforcing as `error` | Unlike ST05–ST08 (confirmed zero-violation by direct grep), no cycle count has been measured yet — could surface pre-existing cycles that need a scoped fix-up list before the rule can ship as a hard error |
| Incremental adoption | All five rules apply going forward only (same as Phase 1) — no repo-wide remediation pass | Consistent with the epic's stated incremental-adoption principle; ST05–ST08 are zero-violation today anyway, so this mainly matters for ST09 if cycles are found |

## 3. Config Additions

```typescript
// ST05: packages/logger and packages/shared-utils are leaf packages — no
// @gll/* import inside either, by construction (not just convention).
{
  files: ['packages/{logger,shared-utils}/src/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@gll/*'],
            message:
              'packages/logger and packages/shared-utils are leaf packages — no @gll/* imports allowed.',
          },
        ],
      },
    ],
  },
},

// ST06: packages/api-contract stays a pure types/contract package — no
// @gll/db, @gll/server, or DB-driver import.
{
  files: ['packages/api-contract/src/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@gll/db',
            message: 'api-contract must stay a pure types package — no db access.',
          },
          {
            name: '@gll/server',
            message: 'api-contract must stay a pure types package — no server-side deps.',
          },
        ],
        patterns: [
          {
            group: ['drizzle-orm', 'better-sqlite3', '**/packages/db/**'],
            message: 'api-contract must stay a pure types package — no DB driver or db package reach-through.',
          },
        ],
      },
    ],
  },
},

// ST08 (rescoped): apps must not import each other's source directly — see
// epic Decisions Log for the runtime-pairing clarification (srs-demo/server
// remain a deployed client/server pair via @gll/api-contract over HTTP;
// this rule only blocks direct source imports).
//
// Rule shape uses bare-segment patterns (`**/server/**`, not
// `**/apps/server/**`) — the apps/-prefixed form does not match realistic
// relative traversal (`../../../server/src/...`); the segment-boundary form
// does, with no substring false-positive risk. Each new app-scoped block
// below also restates the bare-`@gll/srs-engine` ban already enforced by the
// existing ST02a block (`files: ['apps/**/*.ts', ...]`), because flat config
// does not merge `no-restricted-imports` options across overlapping blocks —
// the later block replaces the earlier one's options for that rule, for the
// files both match. Without restating it here, adding these two new blocks
// would silently regress ST02a's enforcement for apps/server and
// apps/cli-demo-db.
{
  files: ['apps/server/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@gll/srs-engine',
            message: 'Import a subpath (/learn, /shelving, /review, /data/*) — there is no barrel export.',
          },
          {
            name: '@gll/srs-demo',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
          {
            name: 'cli-demo-db',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
        patterns: [
          {
            group: ['**/srs-demo/**', '**/cli-demo-db/**'],
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
      },
    ],
  },
},
{
  files: ['apps/cli-demo-db/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@gll/srs-engine',
            message: 'Import a subpath (/learn, /shelving, /review, /data/*) — there is no barrel export.',
          },
          {
            name: '@gll/server',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
          {
            name: '@gll/srs-demo',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
        patterns: [
          {
            group: ['**/server/**', '**/srs-demo/**'],
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
      },
    ],
  },
},
// srs-demo's ST08 bans are NOT a fourth block — they merge into the existing
// ST02b/ST07 block below (same file scope; a competing fourth block here
// would trigger the same override problem against ST02b/ST07's paths).

// ST09: no import cycles among apps/srs-demo's composables — investigate
// baseline before flipping this to 'error' (see EP18-ST09).
{
  files: ['apps/srs-demo/src/composables/**/*.ts'],
  plugins: { import: importPlugin },
  rules: {
    'import/no-cycle': 'error', // or 'warn' during baseline investigation
  },
},
```

ST07 and srs-demo's share of ST08 are not new blocks — both extend the existing EP18-ST02b block in-place (a fourth competing block over the same `apps/srs-demo/**/*.ts` files would trigger the same flat-config override problem described above):

```typescript
{
  // EP18-ST02b + ST07 + ST08(srs-demo): srs-demo may not import
  // @gll/srs-engine/review (server-side scheduling), @gll/db (server-side
  // storage), or apps/server's / apps/cli-demo-db's source directly.
  files: ['apps/srs-demo/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@gll/srs-engine/review',
            message: 'review scheduling is server-side only — see packages/srs-engine/RULES.md',
          },
          {
            name: '@gll/db',
            message: 'db access is server-side only — apps/srs-demo talks to server over HTTP.',
          },
          {
            name: '@gll/server',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
          {
            name: 'cli-demo-db',
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
        patterns: [
          {
            group: ['**/server/**', '**/cli-demo-db/**'],
            message: 'apps must not import each other\'s source directly — share types via @gll/api-contract instead.',
          },
        ],
      },
    ],
  },
},
```

Note: this block does not restate ST02a's bare-`@gll/srs-engine` ban. That ban is *already* silently lost here (this block has overridden ST02a for `apps/srs-demo` since Phase 1, independent of ST08) — a pre-existing defect, not something ST08 introduces or worsens. It's tracked as a separate follow-up, not fixed as part of this story (see ST08's Risks note below).

Root `package.json` devDependency addition for ST09:

```json
"eslint-plugin-import": "^2"
```

## 4. User Workflows

```
START → developer edits packages/logger/src/*.ts, adds `import { x } from '@gll/shared-utils'`
      → git commit → lint-staged runs eslint --fix on staged file
      → ESLint flags ST05 violation (not auto-fixable) → commit blocked
      → developer removes the import or inlines the needed logic → commit succeeds

START → developer edits apps/srs-demo/src/composables/useX.ts, adds `import { y } from '../../server/src/...'`
      → git commit → lint-staged runs eslint --fix
      → ESLint flags ST08 violation → commit blocked
      → developer moves the shared type into @gll/api-contract, imports from there instead → commit succeeds

START → developer adds a new composable that imports back into one already importing it (cycle)
      → git commit → lint-staged runs eslint --fix
      → import/no-cycle (ST09) flags the cycle → commit blocked
      → developer breaks the cycle (extract shared logic to a third module) → commit succeeds
```

## 5. Stories

### EP18-ST05: Leaf-package lock — `packages/logger` + `packages/shared-utils`

**Scope**: One `no-restricted-imports` block banning any `@gll/*` import inside `packages/logger/src/**` and `packages/shared-utils/src/**`.
**Read List**: `eslint.config.ts`, `packages/logger/package.json`, `packages/shared-utils/package.json`
**Tasks**:

- [x] Add the ST05 block to `eslint.config.ts`
- [x] Add a regression test (ephemeral fixture, same pattern as ST01/ST02) covering a violation in each of the two packages plus one control case (a non-`@gll/*` import, e.g. `pino`, still allowed)
      **Acceptance Criteria**:
- [x] ESLint flags any `@gll/*` import inside `packages/logger/src/**` or `packages/shared-utils/src/**`
- [x] ESLint does not flag existing non-`@gll/*` imports (e.g. `pino` in `logger`)

### EP18-ST06: `packages/api-contract` purity rule

**Scope**: One `no-restricted-imports` block banning `@gll/db`, `@gll/server`, `drizzle-orm`, `better-sqlite3`, and relative reach-through into `packages/db/**`, scoped to `packages/api-contract/src/**`.
**Read List**: `eslint.config.ts`, `packages/api-contract/package.json`
**Tasks**:

- [x]Add the ST06 block to `eslint.config.ts`
- [x]Add a regression test covering a bare `@gll/db` violation, a `drizzle-orm` violation, and a control case (`zod`, still allowed)
      **Acceptance Criteria**:
- [x]ESLint flags `@gll/db`, `@gll/server`, `drizzle-orm`, or `better-sqlite3` imported inside `packages/api-contract/src/**`
- [x]ESLint does not flag the existing `zod` import

### EP18-ST07: `apps/srs-demo` must not import `@gll/db`

**Scope**: Extend the existing ST02b block (`files: ['apps/srs-demo/**/*.ts']`) with a second banned path, `@gll/db`.
**Read List**: `eslint.config.ts` (the existing ST02b block)
**Tasks**:

- [x]Add `{ name: '@gll/db', message: ... }` to the existing ST02b block's `paths` array
- [x]Add a regression test covering a `@gll/db` violation in `apps/srs-demo`, alongside the existing ST02b tests
      **Acceptance Criteria**:
- [x]ESLint flags `@gll/db` imported from any file under `apps/srs-demo/**`
- [x]Existing ST02b behavior (blocking `@gll/srs-engine/review`) is unchanged

### EP18-ST08: Apps must not import each other's source directly

**Scope (rescoped)**: Two new `no-restricted-imports` blocks (`apps/server`, `apps/cli-demo-db`) plus one merge into the existing `apps/srs-demo` (ST02b/ST07) block — not three independent new blocks. Each block bans, per the other two apps: (a) bare-segment `patterns` (`**/server/**`, `**/srs-demo/**`, `**/cli-demo-db/**`) for relative-path reach-through, and (b) `paths` bans on the other apps' package names as forward-looking insurance. The two new blocks additionally restate the bare-`@gll/srs-engine` ban already enforced by ST02a, since flat config replaces (not merges) `no-restricted-imports` options across blocks whose `files` overlap for the same file — omitting the restatement would silently regress ST02a's enforcement for these two apps, which is a regression this story would directly cause.
**Read List**: `eslint.config.ts` (ST02a and the existing ST02b/ST07 block), `eslint-rules/eslint-boundary-rules.test.ts`, each app's `package.json` (`name` field, to confirm `cli-demo-db` has no `@gll/`-scoped name)
**Tasks**:

- [x]Add the `apps/server` block: bans on `srs-demo`/`cli-demo-db` (segment patterns + package-name paths) plus the restated `@gll/srs-engine` bare-import ban
- [x]Add the `apps/cli-demo-db` block: bans on `server`/`srs-demo` (segment patterns + package-name paths) plus the restated `@gll/srs-engine` bare-import ban
- [x]Merge `srs-demo`'s bans on `server`/`cli-demo-db` into the existing ST02b/ST07 block (do not add a fourth competing block over `apps/srs-demo/**/*.ts`)
- [x]Add regression tests: 2 violation cases + 1 control per app (9 total), using realistic relative traversal (`../../../<app>/...`), not an `apps/`-prefixed literal
- [x]Re-run the full `eslint-rules/eslint-boundary-rules.test.ts` suite (not just the new tests) to confirm no previously-passing test regresses
      **Acceptance Criteria**:
- [x]ESLint flags relative-path reach-through from any app into either of the other two apps' source
- [x]ESLint flags a bare import of either other app's package name
- [x]ESLint does not flag an app's own in-app relative imports
- [x]ST02a's bare-`@gll/srs-engine` ban still fires for `apps/server` and `apps/cli-demo-db` after these blocks are added (regression check — this is the specific failure mode this rescope exists to prevent)
- [x]Existing ST02b/ST07 behavior (`@gll/srs-engine/review`, `@gll/db`) is unchanged for `apps/srs-demo`

**Risks and known gaps (out of scope for this story)**: `apps/srs-demo` already silently loses ST02a's bare-`@gll/srs-engine` ban today (the existing ST02b/ST07 block has overridden it since Phase 1) — pre-existing, not caused or worsened by ST08, and not fixed here. `packages/api-contract` has the same defect via the ST06 block (already shipped). Both are tracked as a separate follow-up: consolidating every `no-restricted-imports` block that shares a `files` scope with ST02a's `apps/**/*.ts` / `packages/!(srs-engine)/**/*.ts` glob into a single block per scope, so flat config's per-rule override behavior can't silently drop a ban again.

### EP18-ST09: Circular-import detection for `apps/srs-demo` composables

**Scope**: Install `eslint-plugin-import`, wire `import/no-cycle` scoped to `apps/srs-demo/src/composables/**`, measure the current baseline before deciding severity.
**Read List**: `eslint.config.ts`, `apps/srs-demo/src/composables/**/*.ts` (19 files), `apps/srs-demo/vite.config.ts` (confirm no path aliases needing a custom resolver)
**Tasks**:

- [x]Add `eslint-plugin-import` as a root devDependency
- [x]Add the ST09 block to `eslint.config.ts` with `import/no-cycle` set to `'warn'` initially
- [x]Run ESLint against `apps/srs-demo/src/composables/**` and record the actual cycle count (the baseline is unmeasured as of this DS)
- [x]If the baseline is zero: flip the rule to `'error'` in the same story. If non-zero: stop and report the specific cycles found — do not flip to `'error'` or attempt fixes without user confirmation (this is a design decision point, not an implementation detail)
      **Acceptance Criteria**:
- [x]`import/no-cycle` runs against `apps/srs-demo/src/composables/**` and its result (clean, or a specific list of existing cycles) is reported back before the rule's final severity is decided

## 6. Success Criteria

1. ESLint flags all five new boundary violations described above, and does not flag any currently-passing import in the affected scopes (verified via regression tests, not manual spot-checks)
2. No new devDependency is added except `eslint-plugin-import` (ST09 only)
3. `lint-staged` and CI enforce all five rules with no additional pre-commit hook changes beyond what EP18-ST03 already wired
4. ST09's baseline cycle count is known and reported before the rule is enforced as `'error'` — not assumed clean
5. No type errors
