# srs-demo rules

- Read build/runtime env flags only from `src/env.ts` (the central `env` object) — never inline `import.meta.env.*` in components or composables.
- Keep debug/dump/test-only code out of normal feature functions, even when it's correctly flag-gated: extract it into its own named unit (function/composable) rather than inlining it into a happy-path function like a nav handler or submit handler. This keeps the feature's control flow readable at a glance, and lets the unit's own gate (`env.testHooks` for test-run hooks, `env.debugMode` for manual-run debug aids) fully dead-code-eliminate it in production builds — a flag check spliced into the middle of a feature function doesn't get eliminated even if it's always false at runtime.
