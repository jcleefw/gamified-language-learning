# CODEMAP.md — `packages/srs-engine/`

Package-level navigation index for `@gll/srs-engine`.

**Update this file when**: package config files change, new top-level folders are added, or the integration test coverage changes.

---

## Package Config

| File               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `package.json`     | Package manifest — ESM, `@gll/srs-engine`, build/test/lint scripts   |
| `tsconfig.json`    | Extends `../../tsconfig.base.json`; `rootDir: src`, `outDir: dist`   |
| `vitest.config.ts` | Vitest config — `globals: true`, `passWithNoTests: true`, setup file |
| `README.md`        | Test run instructions                                                |

---

## Source

→ See [src/CODEMAP.md](src/CODEMAP.md)

---

## Integration Tests

`__tests__/` folders are excluded from CODEMAP per convention. Integration test files are self-documenting via file-level doc comments.

| File                                            | Coverage                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/setup.ts`                            | `afterEach(vi.useRealTimers)` — prevents fake timer bleed across tests                                                   |
| `__tests__/integration/srs-lifecycle.test.ts`   | Cross-module: `updateMastery` + `FsrsScheduler` — mastery floor, phase promotion, interval growth, lapse reset (4 tests) |
| `__tests__/integration/batch-lifecycle.test.ts` | Cross-module: `updateMastery` + `composeBatch` — priority ordering, distribution sum, audio redistribution (4 tests)     |
