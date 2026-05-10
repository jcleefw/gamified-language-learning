# EP21-DS02: SRS Engine v2 Library Boundary Refactor

**Created**: 20260510T162859Z
**Epic**: [EP21 - SRS Engine v2: Revision Phase](../../plans/epics/EP21-srs-engine-v2-revision-phase.md)
**Status**: Complete ✅

## Summary

Design spec establishing the library boundary for `srs-engine-v2`. The package had grown into a hybrid — pure engine logic and terminal I/O coexisted in the same file (`learning-io.ts`), and there was no `src/index.ts` public API. This spec defined the refactor plan: extract pure engine functions to `src/engine/session.ts`, create a clean `src/index.ts` barrel, and move all terminal demo code to a top-level `demo/` folder.

The spec also settled that persistence (`better-sqlite3`) does not belong in this package — it belongs in the server — and that `ts-fsrs` stays in the package but only behind the `ReviewScheduler` interface in `src/scheduler/` (EP21-ST01 scope).

## Design Decisions

| Decision | Rationale |
|---|---|
| `processRecheckResult`, `nextActivePool`, `updateMasteryState` → `src/engine/session.ts` | These are pure computations a web server calls directly — they must not live alongside `process.stdin` code |
| `demo/` folder at package root | Separates "how to use the library" from the library itself; demo imports from `../src/index.js` exactly as a consumer would |
| `src/index.ts` as the sole public surface | Consumers must not import internal paths |
| Remove `better-sqlite3` | Persistence is the server's concern, not the engine's |
| Retain `ts-fsrs` | Scheduling is engine domain — it will live in `src/scheduler/` behind an interface |

## Stories Delivered

- EP21-ST02: Extract engine session functions
- EP21-ST03: Create `src/index.ts` and move demo files

## Next Steps

- EP21-ST01: Revision runner + FSRS scheduler (can now proceed on clean foundation)
