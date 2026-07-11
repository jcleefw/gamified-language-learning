# srs-demo rules

- Read build/runtime env flags only from `src/env.ts` (the central `env` object) — never inline `import.meta.env.*` in components or composables.
- Keep test/debug-only code out of the normal app path: extract it into a named unit and gate it behind a flag (`env.testHooks` for test-run hooks, `env.debugMode` for manual-run debug aids) so it is dead-code-eliminated in production builds.
