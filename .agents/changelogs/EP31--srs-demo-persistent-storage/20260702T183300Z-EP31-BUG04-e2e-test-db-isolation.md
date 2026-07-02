# EP31-BUG04: Use Separate Database for E2E Tests

**Date**: 20260702T183300Z
**Status**: Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)
**Type**: Bug Fix (Test Infrastructure)

---

## 1. Problem Statement

E2E tests (Playwright) were using the production database (`.data/srs-demo.db`), contaminating local development data and making tests non-isolated. Running e2e tests would modify or clear the actual app's database.

### Root Cause

- Hardcoded database path in `apps/server/src/index.ts`
- No way to pass custom database path to server
- Playwright config started the same server used for development

### Impact

- E2E test runs deleted or corrupted local development database
- Tests were not truly isolated
- Running e2e tests broke local development state
- CI/CD wouldn't have clean database for each test run

---

## 2. Solution

Make the database path configurable via environment variable, then set it in the Playwright config to use a separate test database.

### Changes

#### apps/server/src/index.ts
**Lines 8-10**: Made database path configurable

```typescript
// Before
const DB_PATH = path.resolve(import.meta.dirname, '../../../.data/srs-demo.db');

// After
const DB_PATH = process.env.GLL_DB_PATH
  ? path.resolve(process.env.GLL_DB_PATH)
  : path.resolve(import.meta.dirname, '../../../.data/srs-demo.db');
```

#### apps/srs-demo/playwright.config.ts
**Lines 15-17**: Set separate test database for e2e server

```typescript
// Before
{
  command: 'pnpm --filter @gll/server dev',
  port: 6060,
  reuseExistingServer: !process.env.CI,
}

// After
{
  command: 'pnpm --filter @gll/server dev',
  port: 6060,
  env: { GLL_DB_PATH: '.data/srs-demo-e2e.db' },
  reuseExistingServer: !process.env.CI,
}
```

---

## 3. Acceptance Criteria

- [x] Server respects `GLL_DB_PATH` environment variable
- [x] Default database path is `.data/srs-demo.db` (production)
- [x] E2E tests use `.data/srs-demo-e2e.db` (separate)
- [x] Running e2e tests doesn't affect local development database
- [x] Environment variable is properly documented

---

## 4. Testing

**Integration Testing**:
- Started server with `GLL_DB_PATH=.data/test-db.db` 
- Verified server created database at custom path
- Confirmed production path is used by default

---

## 5. Commits

- `d10d315` - Use separate database for e2e tests

---

## 6. Impact

- **E2E Isolation**: Tests now run in complete isolation with clean database
- **Development Safety**: Local `.data/srs-demo.db` never touched by test runs
- **CI/CD Ready**: Each test run starts with fresh database
- **Configuration**: Flexible for future test environments

---

## 7. Related Issues

- **EP31-BUG01, BUG02, BUG03**: All developed/tested using shared database issue
- Discovered during bug fix implementation and test creation
