# Current Focus

**Branch**: feature/EP02-ST03-scheduler-interface
**Updated**: 2026-03-06

## Active Work

- **Epic**: EP02 — SRS Engine Core: Mastery + ANKI Scheduling
- **Story**: EP02-ST03 ✅ — complete
- **Status**: ST01 ✅ ST02 ✅ ST03 ✅ — scheduler interface + ReviewResult defined

## Import Convention (Locked)

- Own source file imports → `.js` extension (required by tsc emit; TypeScript resolves to `.ts`)
- External package imports → package name only, no extension
- `allowImportingTsExtensions` is NOT enabled — would break tsc emit to `dist/`

## Last Session Outcome

EP02-ST03 — SpacedRepetitionScheduler interface + ReviewResult type complete.
- Created `packages/srs-engine/src/scheduling/types.ts` — `ReviewResult` interface
- Created `packages/srs-engine/src/scheduling/scheduler.interface.ts` — `SpacedRepetitionScheduler` interface
- Updated `src/index.ts` to export both
- `pnpm build` exits 0
- **Next**: EP02-ST04 (FsrsScheduler adapter — implement the interface wrapping ts-fsrs)

## EP02 Story Status

| Story | Title | Status |
|---|---|---|
| EP02-ST01 | Engine types | ✅ Done |
| EP02-ST02 | Mastery counting + phase transition | ✅ Done |
| EP02-ST03 | SpacedRepetitionScheduler interface | ✅ Done |
| EP02-ST04 | FsrsScheduler adapter | Pending |
| EP02-ST05 | SRS core demo script | Pending |

## Build Sequence (Accepted)

| Stage | Feature | Key Dependency |
|---|---|---|
| 1 | SRS engine + terminal runner (in-memory, pure TS) | None — start here |
| 2 | Hono API layer (engine over HTTP, in-memory) | Stage 1 engine |
| 3 | Database persistence (local SQLite first → cloud D1 later) | Stage 2 API |
| 4 | Quiz UI (mobile-first, seed data) | Stage 3 DB |
| 5 | Auth (Google OAuth + JWT) | Stage 2 API |
| 6 | Curation engine (pure TS, parallel track) | Stage 1 monorepo |
| 7 | Gemini integration (real AI-generated decks) | Stage 6 + Stage 2 |
| 8 | Curator UI | Stage 7 |
| 9 | TTS audio system | Stage 8 |
| 10 | Admin UI | Stage 5 auth |
