// Central access point for build/runtime environment flags. Read env here and
// nowhere else, so every feature toggle is discoverable in one place and each
// consumer imports from a single `env` object instead of re-deriving flags from
// import.meta.env. All branches gated on these are dead-code-eliminated in prod.
export const env = {
  // Test-run only. Set via VITE_TEST_HOOKS in the E2E webServer
  // (playwright.config.ts). Enables test-server hooks such as the deterministic
  // sentence-config override.
  testHooks: import.meta.env.VITE_TEST_HOOKS === 'true',

  // Manual UI run only. Vite's built-in DEV flag: true under `pnpm dev`, stripped
  // from production builds. Enables manual-debugging aids (Save Debug Logs).
  debugMode: import.meta.env.DEV,

  // Reveals answers in the quiz UI for manual/E2E runs. Set via VITE_CHEAT_MODE.
  cheatMode: import.meta.env.VITE_CHEAT_MODE === 'true',

  // Curator tooling only. Set via VITE_CURATION_MODE. Gates the audio-upload page
  // (EP42-DS02, ST09); dead-code-eliminated from production builds when unset.
  curationMode: import.meta.env.VITE_CURATION_MODE === 'true',
} as const;
