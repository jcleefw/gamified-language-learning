# EP02-ST01 Changelog: Engine types

**Date**: 2026-03-06
**Branch**: feature/EP02-ST01-engine-types
**Story**: EP02-ST01 — Engine types

---

## What changed

### Created
- `packages/srs-engine/src/types.ts` — all engine-owned types: `MasteryPhase`, `WordCategory`, `FsrsCardState`, `WordState`, `QuizAnswer`, `SrsConfig`

### Modified
- `packages/srs-engine/src/index.ts` — replaced empty stub with named re-exports of all 6 types
- `CODEMAP.md` — added `src/types.ts` entry; updated `src/index.ts` description

---

## Acceptance criteria

- [x] `MasteryPhase`, `WordCategory`, `FsrsCardState`, `WordState`, `QuizAnswer`, `SrsConfig` all exported from `@gll/srs-engine`
- [x] `pnpm build` exits 0 with no TypeScript errors
- [x] No `any` types used
