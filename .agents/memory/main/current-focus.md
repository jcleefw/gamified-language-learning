# Current Focus

**Branch**: main
**Updated**: 20260311T000000Z

## Stage Status

- **Stage 1**: Complete ✅ — all 10 epics (EP01–EP10) delivered and merged
- **Stage 2**: Planning complete — roadmap written, epic plan files pending

## Stage 1 — Delivered Epics

| Epic | Title | Status |
|------|-------|--------|
| EP01 | Monorepo scaffolding | ✅ Merged |
| EP02 | SRS engine: mastery + phase transitions (absorbed EP03 ANKI scheduling) | ✅ Merged |
| EP04 | SRS engine: batch composition | ✅ Merged |
| EP05 | SRS engine: active window + stuck words | ✅ Merged |
| EP06 | SRS engine: foundational deck | ✅ Merged |
| EP07 | SRS engine: answer processing + SrsEngine class | ✅ Merged |
| EP08 | Terminal quiz runner + seed data | ✅ On branch `feature/EP08-terminal-quiz-runner` — merge pending |
| EP09 | Agentic dev workflow (GAP-05) | ✅ Delivered as workflow docs |
| EP10 | GitHub Actions CI | ✅ Merged |

**Housekeeping**: EP08 epic plan (`plans/epics/EP08-terminal-quiz-runner.md`) status still shows Draft — update to Completed after merge.

## Stage 2 — Next Up

**Roadmap**: `product-documentation/roadmap/20260311T000000Z-stage2-build-sequence.md`

| Epic | Title | Effort |
|------|-------|--------|
| EP11 | `@gll/api-contract` — shared HTTP types (types-only package) | 0.25 day |
| EP12 | `apps/server` — Hono server scaffold | 0.5 day |
| EP13 | `apps/server` — SRS routes + in-memory state | 1 day |
| EP14 | CI Stage 2 update | 0.25 day |

**Blocking prerequisite**: EP08 must be merged before EP11 starts.

## Stage 2 Locked Decisions

- App location: `apps/server`
- Package scope: `@gll/api-contract`
- Deck ID: random hash generated at seed time, printed to console on startup — fixed for process lifetime
- Batch ID: `crypto.randomUUID()`, server-generated
- `targetText`: in-memory `Map<wordId, wordDetail>` seeded from mappers
- `options[]` (MC distractors): omitted in Stage 2 (field optional in ADR)

## Next Steps

1. Merge EP08 PR → `main`
2. Update EP08 epic plan status to Completed
3. Write EP11–EP14 epic plan files
4. Begin EP11
