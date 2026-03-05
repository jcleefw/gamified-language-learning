# Current Focus

**Branch**: feature/EP02-ST05-srs-demo
**Updated**: 2026-03-06

## Active Work

- **Epic**: EP02 — SRS Engine Core: Mastery + ANKI Scheduling
- **Story**: EP02-ST05 ✅ — complete
- **Status**: ST01 ✅ ST02 ✅ ST03 ✅ ST04 ✅ ST05 ✅ — EP02 Impl-Complete

## Last Session Outcome

EP02-ST05 — Demo script complete.
- Created `scripts/demo-srs.ts` — exercises `updateMastery` + `FsrsScheduler` on one word
- Added `"type": "module"` to root `package.json` (required for tsx to resolve ESM exports)
- Added `tsx@^4` + `@gll/srs-engine: workspace:*` to root devDeps
- Added `"demo": "tsx scripts/demo-srs.ts"` to root scripts
- `pnpm demo` exits 0, prints Learning→ANKI progression with interval
- EP02 status → `Impl-Complete`
- **Next**: improve `scripts/demo-srs.ts` to prove more behavior (separate conversation):
  1. Simulate multiple ANKI reviews to show interval growth (3 → 8 → 21 → 55 → 90)
  2. Simulate wrong answers in Learning phase — show mastery decrement
  3. Simulate 3 lapses in ANKI phase — show phase reset back to Learning + mastery=0
  - Then: human PR to merge epic branch → main

## Import Convention (Locked)

- Own source file imports → `.js` extension (required by tsc emit; TypeScript resolves to `.ts`)
- External package imports → package name only, no extension
- `allowImportingTsExtensions` is NOT enabled — would break tsc emit to `dist/`
- Root `package.json` has `"type": "module"` — tsx runs demo in ESM mode

## EP02 Story Status

| Story | Title | Status |
|---|---|---|
| EP02-ST01 | Engine types | ✅ Done |
| EP02-ST02 | Mastery counting + phase transition | ✅ Done |
| EP02-ST03 | SpacedRepetitionScheduler interface | ✅ Done |
| EP02-ST04 | FsrsScheduler adapter | ✅ Done |
| EP02-ST05 | SRS core demo script | ✅ Done |

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
