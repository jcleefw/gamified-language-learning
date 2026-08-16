# EP50-DS02: Cleanup — Fixture Removal and Documentation Pruning Specification

**Date**: 20260816T183415Z
**Status**: Draft
**Epic**: [EP50 - Graph RAG Governance Retrofit](../../plans/epics/EP50-graph-rag-governance-retrofit.md)

---

## 1. Feature Overview

`packages/graph-rag` currently defaults its build root to a frozen test fixture rather than the live repo, and carries two documentation files with stale `concern`-era terminology (pre-dating the `ryoiki` rename). This DS removes the fixture-pointing capability from the CLI so the package always builds against repo root, and prunes documentation so no file duplicates or contradicts another.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Build root | Always resolve to actual repo root; no override | Package is leaving spike status — there is no reason a governed package defaults to a synthetic fixture |
| `--root` CLI flag | Removed from `src/cli/build.ts` and `src/server/serve.ts` | Sole purpose was pointing at the fixture; no other use is documented anywhere |
| `.graph-rag-config.json`'s `root` field | Removed (or hardcoded to repo root, never a fixture path) | Same reason — config-level override is the other half of the same escape hatch |
| Test fixture | `__fixtures__/two-axis-sample/` deleted | No longer referenced once the two dependent tests are rewritten |
| Test data for `adr-reader.test.ts` / `ryoiki-reader.test.ts` | Inline or temp-directory fixtures scoped to each test | Keeps tests independent of a shared on-disk fixture tree that could silently drift |
| `EXTRACTION_PATTERNS.md` | Deleted | Stale `concern` terminology; content duplicated by `ARCHITECTURE.md` |
| `RESEED_GUIDE.md` | Deleted, one paragraph relocated | Duplicates `README.md` Usage section; the `--root` cross-process gotcha is real and worth keeping, moved into `README.md` |
| `ARCHITECTURE.md` | One link fix only | Line 174 links to `RESEED_GUIDE.md`, which no longer exists |
| `docs/graph-model-explained.md` | Untouched | Correct terminology, distinct conceptual-primer audience |

## 3. Data Structures

N/A — this DS changes CLI argument handling, config shape, and documentation; no new types.

## 4. User Workflows

```
BEFORE:
`graph:build` → reads `--root=` or config.root → defaults to __fixtures__/two-axis-sample
`graph:ui`    → same override, independently — can silently diverge from graph:build's root

AFTER:
`graph:build` → always resolves against actual repo root
`graph:ui`    → always resolves against actual repo root
(no flag, no config field, no divergence possible)
```

## 5. Stories

### EP50-ST10: Remove fixture-pointing and test fixtures _(Done)_

**Scope**: Delete `__fixtures__/two-axis-sample/`; remove the `--root` CLI override and `config.root` field from `src/cli/build.ts` and `src/server/serve.ts`; rewrite the two dependent tests to use local fixture data instead of the shared directory.

**Read List**: `src/cli/build.ts`, `src/server/serve.ts`, `src/config.ts`, `.graph-rag-config.json`, `__tests__/unit/adr-reader.test.ts`, `__tests__/unit/ryoiki-reader.test.ts`

**Tasks**:

- [x] Remove the `--root=` argument parsing and `config.root` fallback from `src/cli/build.ts` (lines 21-24); always resolve against `repoRoot` (computed the same way, four levels up from `src/cli/`)
- [x] Remove the equivalent `--root` override from `src/server/serve.ts` (line 46) and its documented usage in the file's header comment (line 12)
- [x] Remove the `root` field from `ConfigLoader`'s type/default in `src/config.ts` and from `.graph-rag-config.json`
- [x] Rewrite `__tests__/unit/adr-reader.test.ts` to build its `FIXTURE_ROOT` fixture data inline or in a temp directory created/torn down by the test, instead of reading `__fixtures__/two-axis-sample/`
- [x] Rewrite `__tests__/unit/ryoiki-reader.test.ts` the same way
- [x] Delete `__fixtures__/two-axis-sample/` in full

**Acceptance Criteria**:

- [x] No CLI flag, config field, or code path can point a build at anything other than repo root
- [x] `__fixtures__/` no longer exists under `packages/graph-rag/`
- [x] Both rewritten tests pass without any dependency on a shared fixture directory
- [x] Full test suite passes (`pnpm --filter @gll/graph-rag test`)
- [x] `pnpm --filter @gll/graph-rag graph:build` succeeds against the live repo with no flags

### EP50-ST11: Prune documentation _(Done)_

**Scope**: Delete `EXTRACTION_PATTERNS.md` and `RESEED_GUIDE.md`; relocate the `--root` cross-process gotcha into `README.md`; fix the dangling `RESEED_GUIDE.md` link in `ARCHITECTURE.md`.

**Read List**: `EXTRACTION_PATTERNS.md`, `RESEED_GUIDE.md`, `README.md`, `ARCHITECTURE.md` (line 174)

**Tasks**:

- [x] Delete `packages/graph-rag/EXTRACTION_PATTERNS.md`
- [x] Delete `packages/graph-rag/RESEED_GUIDE.md`
- [x] Add a short paragraph to `README.md`'s CLI/Usage section: `graph:build` and `graph:ui` each resolve root independently in separate processes — rebuilding against one root does not update an already-running UI process pointed at another; restart the UI to pick up a changed root
- [x] Update `ARCHITECTURE.md` line 174 to link to `README.md`'s Usage section instead of the deleted `RESEED_GUIDE.md`
- [x] Grep the repo for any other reference to `EXTRACTION_PATTERNS.md` or `RESEED_GUIDE.md` and update or remove those references

**Acceptance Criteria**:

- [x] `EXTRACTION_PATTERNS.md` and `RESEED_GUIDE.md` no longer exist
- [x] No remaining reference to either deleted file anywhere in the repo
- [x] The cross-process `--root` gotcha is documented exactly once, in `README.md`
- [x] `docs/graph-model-explained.md` and `ARCHITECTURE.md` (aside from the one link fix) are unchanged

## 6. Success Criteria

1. `packages/graph-rag` cannot be built against anything other than repo root.
2. Documentation set is `README.md`, `ARCHITECTURE.md`, `docs/graph-model-explained.md` — no duplicated or stale-terminology files remain.
3. No type errors.
4. Full test suite passes.
