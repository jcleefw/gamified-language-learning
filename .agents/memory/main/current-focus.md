# Current Focus

**Branch**: feature/EP02-ST01-engine-types
**Updated**: 2026-03-06

## Active Work

- **Epic**: EP02 — SRS Engine Core: Mastery + ANKI Scheduling
- **Story**: EP02-ST01 ✅ — complete, pending commit
- **Status**: ST01 ✅ — engine types defined and exported

## Last Session Outcome

EP02-ST01 — Engine types complete.
- Created `packages/srs-engine/src/types.ts` with all 6 engine types
- Updated `src/index.ts` to re-export all types
- `pnpm build` exits 0, no TypeScript errors
- **Next**: commit EP02-ST01, then begin EP02-ST02 (mastery counting + phase transition)

## EP02 Story Status

| Story | Title | Status |
|---|---|---|
| EP02-ST01 | Engine types | ✅ Done |
| EP02-ST02 | Mastery counting + phase transition | Pending |
| EP02-ST03 | SpacedRepetitionScheduler interface | Pending |
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
