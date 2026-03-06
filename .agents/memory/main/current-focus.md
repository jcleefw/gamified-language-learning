# Current Focus

**Branch**: main
**Updated**: 20260306T000000Z

## Active Work

- **Epic**: Parallel EP04 + EP05 + EP06 — all in progress on separate worktrees
- **Status**: EP01 ✅ EP02 ✅ — parallel phase starting

## Last Session Outcome

EP02 fully merged to main. Three worktrees created for parallel Stage 1 completion:

| Worktree | Branch | Epic |
|---|---|---|
| `.worktrees/ep04` | `feature/EP04-srs-batch-composition` | EP04 — Batch Composition |
| `.worktrees/ep05` | `feature/EP05-srs-active-window-stuck-words` | EP05 — Active Window + Stuck Words |
| `.worktrees/ep06` | `feature/EP06-srs-foundational-deck` | EP06 — Foundational Deck |

## Next Steps (this window — coordination only)

1. Monitor EP04/EP05/EP06 PRs — merge in any order once each is done
2. After all three land on main: start EP07 (SRS Engine Orchestrator) from here
3. EP08 (Terminal Quiz Runner) follows EP07

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
