# EP16-ST01: Rewrite `scripts/quiz-runner.ts` as HTTP API client

**Created**: 20260313T010000Z
**Epic**: [EP16 - Quiz Runner: HTTP-Based Interactive Quiz](.agents/plans/epics/EP16-quiz-runner-http-rewrite.md)
**Status**: Complete ✅

## Summary

Full rewrite of `scripts/quiz-runner.ts`. Removed all engine imports, seed-loading, and self-assessment logic. The script now calls the live HTTP server (`POST /seed` → `POST /batch` → collect keypresses → `POST /answers`) and displays per-word correctness results returned by the server. Answer authority is fully on the server; the client never sees the correct key until results are revealed.

Also added `@gll/api-contract` and `@types/node` to root `devDependencies`, and created a root `tsconfig.json` covering `scripts/` so the script typechecks correctly.

## Files Modified

### `scripts/quiz-runner.ts`

- Removed all imports of `@gll/srs-engine`, `node:fs`, `node:path`, `node:url`, local data packages
- Replaced engine-direct quiz loop with HTTP API client: `seed()`, `getBatch()`, `submitAnswers()` using native `fetch`
- Added raw keypress capture via `process.stdin.setRawMode` — valid keys `a/b/c/d` only, reprompts on invalid key, Ctrl+C exits gracefully
- Added `displayQuestion()` — shows separator, batch/question counter, targetText, labelled choices, answer prompt
- Added `displayResults()` — shows `✓`/`✗` per word with mastery delta; wrong answers reveal `you:` and `correct:` keys
- Added `CollectedAnswer` internal interface

### `package.json`

- Added `@gll/api-contract: workspace:*` to root `devDependencies`
- Added `@types/node: ^22` to root `devDependencies`

### `tsconfig.json` (new)

- Root tsconfig extending `tsconfig.base.json`, including `scripts/**/*` with `types: ["node"]` and `noEmit: true`

## Behavior Preserved / New Behavior

- **Removed**: Self-assessment ("did you get it right?") flow; engine-direct calls; seed data loading in the script
- **New**: Real multiple-choice quiz — choices are server-generated, correct key is withheld until results
- **New**: `selectedKey` submitted to server; server determines and returns `correct`, `correctKey`, `submittedKey`
- **New**: `word_block` and `audio` questions print `[not yet implemented — skipped]` and are not collected
- **New**: Results show mastery delta (`prev → current`) computed from server response

## Next Steps

- Manual E2E verification: `pnpm dev:server` then `pnpm quiz`
- EP16 epic complete — no further stories
