# EP41-ST07: Test/debug hook extraction behind central env flags

**Created**: 20260711T212509Z
**Epic**: [EP41 - Per-User Config Preference Tier (T1)](../../plans/epics/EP41-config-preference-tier.md)
**Status**: Complete ✅

## Summary

Closing cleanup for EP41. `App.vue` had accumulated non-production instrumentation
inline in its boot/nav wiring: a test-only sentence-config fetch (the
`/api/test/config/sentence` seam DS02 §2 left intact) and a manual "Save Debug Logs"
button. Both ran on the normal user path with no guard, and env was read ad-hoc
(`import.meta.env.VITE_CHEAT_MODE` was also inlined in `QuizCard.vue`).

This story extracts each concern into a named unit, gates it behind a flag, and
introduces a **single central `env` module** so every build/runtime toggle is read
in one place. The two concerns are gated by **two distinct flags** because they serve
different runs:

- **`env.testHooks`** — *test-run only.* `VITE_TEST_HOOKS`, set in the E2E webServer;
  drives the deterministic sentence-config override. Off in manual dev and prod.
- **`env.debugMode`** — *manual UI run only.* Vite's built-in `import.meta.env.DEV`
  (true under `pnpm dev`, stripped from prod builds); reveals the Save Debug Logs
  button. Zero setup for manual runs.

Both guarded branches are dead-code-eliminated in production builds.

## Files Modified

### apps/srs-demo/src/env.ts (new)

- Central `env` object: `testHooks`, `debugMode`, `cheatMode`. The only place
  `import.meta.env` is read; consumers import plain booleans.

### apps/srs-demo/src/composables/useTestSentenceConfig.ts (new)

- Extracted the `/api/test/config/sentence` fetch + merge from `App.vue`'s
  `onMounted` into `applyTestSentenceConfig(CONFIG)`. Behaviour byte-identical
  (same endpoint, same shallow-merge of `sentenceScheduling`/`sentenceGraduation`,
  same non-fatal fallback).

### apps/srs-demo/src/App.vue

- Import `env` and `applyTestSentenceConfig`.
- Replaced the ~27-line inline test-config block with
  `if (env.testHooks) await applyTestSentenceConfig(CONFIG);`.
- Guarded the Save Debug Logs button with `v-if="env.debugMode && screen === 'results'"`.

### apps/srs-demo/src/components/QuizCard.vue

- `cheatMode` now reads `env.cheatMode` instead of inlining `import.meta.env`.

### apps/srs-demo/playwright.config.ts

- Added `VITE_TEST_HOOKS: 'true'` to the FE webServer env (alongside `VITE_CHEAT_MODE`).

### apps/srs-demo/.env.local.example

- Documented `VITE_TEST_HOOKS` and pointed at `src/env.ts`.

## Behavior Preserved / New Behavior

- **E2E unchanged**: `VITE_TEST_HOOKS` is set for the Playwright webServer, so the
  sentence-config override applies exactly as before during E2E runs.
- **Manual dev unchanged**: `pnpm dev` sets `import.meta.env.DEV`, so the debug-logs
  button still shows on the results screen for manual UI runs.
- **New in production**: neither the test fetch nor the debug button ships — both
  branches are eliminated from the prod bundle. Previously the test fetch ran on
  every prod boot.
- Config resolution, session logic, and all other boot wiring untouched.

## Verification

- `pnpm typecheck` (`vue-tsc --noEmit`) clean.

## Next Steps

- EP41 epic complete. No follow-on; `gentle`/`intense` preset bundles remain reserved
  for a later epic.
