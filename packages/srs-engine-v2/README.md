# @gll/srs-engine

Spaced repetition scheduling engine. Internal package — not published to npm.

## Running tests

**All tests (whole package):**

```bash
pnpm test
```

**Watch mode (re-runs on file change):**

```bash
pnpm test:watch
```

**Single test file:**

```bash
npx vitest run __tests__/unit/<filename>.test.ts
```

**Single test by name:**

```bash
npx vitest run -t "your test name or describe label"
```

**From repo root (any command above via filter):**

```bash
pnpm --filter @gll/srs-engine test
pnpm --filter @gll/srs-engine exec vitest run __tests__/unit/<filename>.test.ts
```
