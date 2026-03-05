# Current Focus

**Branch**: feature/EP02-ST04-fsrs-scheduler
**Updated**: 2026-03-06

## Active Work

- **Epic**: EP02 — SRS Engine Core: Mastery + ANKI Scheduling
- **Story**: EP02-ST04 ✅ — complete
- **Status**: ST01 ✅ ST02 ✅ ST03 ✅ ST04 ✅ — FsrsScheduler adapter done

## Import Convention (Locked)

- Own source file imports → `.js` extension (required by tsc emit; TypeScript resolves to `.ts`)
- External package imports → package name only, no extension
- `allowImportingTsExtensions` is NOT enabled — would break tsc emit to `dist/`

## Last Session Outcome

EP02-ST04 — FsrsScheduler adapter complete.
- Added `ts-fsrs@^5` to `packages/srs-engine/package.json` dependencies
- Created `packages/srs-engine/src/scheduling/FsrsScheduler.ts` — ts-fsrs adapter; `enable_short_term: false` for day-based scheduling
- Created `packages/srs-engine/src/scheduling/__tests__/FsrsScheduler.test.ts` — 11 tests, all pass
- Updated `src/index.ts` to export `FsrsScheduler`
- `pnpm build` exits 0; 24 tests pass
- **Next**: EP02-ST05 (demo-srs.ts script — exercise `updateMastery` + `FsrsScheduler` on one word)

## EP02 Story Status

| Story | Title | Status |
|---|---|---|
| EP02-ST01 | Engine types | ✅ Done |
| EP02-ST02 | Mastery counting + phase transition | ✅ Done |
| EP02-ST03 | SpacedRepetitionScheduler interface | ✅ Done |
| EP02-ST04 | FsrsScheduler adapter | ✅ Done |
| EP02-ST05 | SRS core demo script | Pending |

## Key Decisions (ts-fsrs)

- `enable_short_term: false` — without this, ts-fsrs schedules new cards in minutes (`scheduled_days=0`). Day-based scheduling required.
- `Rating.Good` for correct, `Rating.Again` for wrong (lapse)
- `FsrsCardState` ↔ `Card` mapping: `elapsedDays`↔`elapsed_days`, `scheduledDays`↔`scheduled_days`, `lastReview`↔`last_review`; `learning_steps=0`, `state=State.Review` when converting from `FsrsCardState`
- Lapse count tracking (3-lapse reset) owned by `mastery.ts`, not `FsrsScheduler`

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
