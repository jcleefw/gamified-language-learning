# EP26-DS03: BDD Shelving Test Strategy

**Date**: 20260626T140026Z
**Status**: Draft
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)

---

## 1. Feature Overview

BDD test coverage for the EP26 shelving and stagnation pipeline in srs-demo. Tests exercise the full stack (Vue UI -> Hono API -> SQLite) via Playwright + playwright-bdd (Cucumber), using the infrastructure established in EP33.

Tests require a **test seed API** (`POST /api/test/seed`) that bulk-loads scenario fixture files into the database, enabling both automated BDD execution and manual exploratory testing against the same seed data.

A **test config override endpoint** (`POST /api/test/config/shelving`) allows scenarios to control `stagnationBatchWindow` and `maxShelved` without affecting the production defaults.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| BDD framework | Playwright + playwright-bdd (EP33) | Already established; no new tooling |
| Seed strategy | Central JSON fixture files in `e2e/fixtures/scenarios/` + `POST /api/test/seed` bulk loader | Single source of truth for automated + manual testing |
| Config override | `POST /api/test/config/shelving` sets per-request shelving config; `DELETE /api/test/config/shelving` resets to default | Fast stagnation triggers in tests (window=2) without touching prod defaults |
| Assertion surface | `.pool-debug` panel (active/queue/mastered counts + word IDs) + shelving API state | Cheat mode already exposes pool state; shelving state verified via `GET /api/shelving` |
| Deck data | Real deck data (`lets-eat-something`, `lets-go-somewhere`) | Tests use actual app decks; no synthetic deck registration needed |
| Cross-deck isolation | Two-deck scenarios using existing deck selector | Deck switching is exposed in UI |
| Session lifecycle | End session (back to decks) -> reload -> resume/new session within single scenario | Real user flow; clean DB per scenario prevents state bleed |

## 3. Data Structures

### Scenario Fixture Schema

```typescript
interface ScenarioFixture {
  name: string;
  description: string;
  deckId: string;
  wordStates: Array<{
    wordId: string;
    seen: number;
    correct: number;
    mastery: number;
    correctStreak: number;
    wrongStreak: number;
    lapses: number;
  }>;
  stagnationCounters: Array<{
    wordId: string;
    count: number;
    lastBoundaryMastery: number;
  }>;
  shelvedWords: Array<{
    wordId: string;
    shelvedAtBatch: number;
  }>;
  config?: {
    stagnationBatchWindow?: number;
    maxShelved?: number;
  };
}
```

### Test Seed API

```typescript
// POST /api/test/seed — bulk load a scenario fixture
// Request body: ScenarioFixture
// Response: { success: true, data: null }
//
// Behavior:
//   1. DELETE /api/state (clear all word states)
//   2. Clear user_shelved_words and user_deck_word_tracking for demo-user
//   3. Insert wordStates via upsertWordState
//   4. Insert stagnationCounters into user_deck_word_tracking
//   5. Insert shelvedWords into user_shelved_words
//   6. If config provided, set shelving config override for session

// POST /api/test/config/shelving — override shelving config
// Request body: { stagnationBatchWindow?: number, maxShelved?: number }
// Response: { success: true, data: null }

// DELETE /api/test/config/shelving — reset to DEFAULT_SHELVING_CONFIG
// Response: 204
```

## 4. User Workflows

### Automated (BDD)

```
Feature file -> Given step loads fixture via POST /api/test/seed
             -> Given step sets config via POST /api/test/config/shelving
             -> When steps interact with UI (select deck, answer questions, advance batches)
             -> Then steps assert via pool-debug panel + GET /api/shelving
```

### Manual

```
Developer runs `pnpm dev` (both servers)
         -> curl POST /api/test/seed -d @e2e/fixtures/scenarios/<name>.json
         -> Open browser, reload app
         -> Interact with app, observe shelving behavior
         -> curl GET /api/shelving?deckId=<id> to verify DB state
```

## 5. Stories

### Phase 1: Test Infrastructure (EP26-PH05)

### EP26-ST07: Test seed API + fixture files

**Scope**: Server-side test seed endpoint + fixture file structure + config override endpoint
**Read List**:
- `apps/server/src/routes/state.ts` (existing test API pattern)
- `apps/server/src/routes/shelving.ts` (shelving routes on EP26 branch)
- `apps/server/src/app.ts` (route mounting)
- `packages/db/src/learning-store.ts` (LearningStore interface)
- `packages/srs-shelving/src/types.ts` (ShelvingConfig, DEFAULT_SHELVING_CONFIG)

**Tasks**:
- [ ] Create `apps/srs-demo/e2e/fixtures/scenarios/` directory with fixture JSON files:
      - `stagnant-word-ready-to-shelve.json` — one word at stagnation_count = window-1, next batch triggers shelving
      - `two-words-shelved-cap-reached.json` — maxShelved words already shelved, new stagnant word should NOT shelve
      - `cross-deck-isolation.json` — word shelved in deck A, same word active in deck B
      - `fresh-session-with-shelved-words.json` — words shelved from prior session, new session should unshelve
      - `mid-session-stagnation.json` — clean state, config override with window=2 for fast stagnation
      **Acceptance Criteria**:
- [ ] Each fixture file is valid JSON conforming to `ScenarioFixture` schema
- [ ] `wordId` values reference real words from existing decks (`lets-eat-something`, `lets-go-somewhere`)

- [ ] Create `apps/server/src/routes/test-seed.ts` with:
      - `POST /api/test/seed` — accepts ScenarioFixture body, clears state, bulk-inserts
      - `POST /api/test/config/shelving` — stores config override in module-level variable
      - `DELETE /api/test/config/shelving` — resets to DEFAULT_SHELVING_CONFIG
      - `GET /api/test/config/shelving` — returns current effective config
      **Acceptance Criteria**:
- [ ] Seed endpoint clears existing state before inserting (idempotent)
- [ ] Stagnation counters and shelved words are inserted with correct deck_id
- [ ] Config override is consumed by App.vue shelving pipeline (requires App.vue to fetch config)

- [ ] Mount test-seed routes in `app.ts`
      **Acceptance Criteria**:
- [ ] Routes accessible at `/api/test/*`
- [ ] Manual `curl` load + browser reload shows seeded state

- [ ] Create `apps/srs-demo/e2e/fixtures/index.ts` — typed loader with scenario name registry
      **Acceptance Criteria**:
- [ ] Step definitions can import fixtures by name with type safety

---

### Phase 2: BDD Scenarios (EP26-PH06)

### EP26-ST08: Shelving feature file + step definitions

**Scope**: Gherkin feature file + step definitions for all shelving scenarios
**Read List**:
- `apps/srs-demo/e2e/features/session-mastery.feature` (pattern reference)
- `apps/srs-demo/e2e/steps/session-mastery.steps.ts` (cheat-hint answering, pool-debug assertions)
- `apps/srs-demo/e2e/fixtures/scenarios/*.json` (from ST07)
- `apps/srs-demo/src/composables/useShelving.ts` (API surface)

**Tasks**:

- [ ] Create `apps/srs-demo/e2e/features/shelving.feature` with scenarios:

  **Scenario 1: Word shelved after N stagnant batches**
  ```gherkin
  Given the scenario "mid-session-stagnation" is loaded
  And shelving config is set to window 2 and max shelved 2
  And the app is open with a clean session
  When I select the "let's eat something" deck
  And I answer all questions in the batch incorrectly for the target word
  And I click "Next Batch"
  And I answer all questions in the batch incorrectly for the target word
  Then the stagnant word should be shelved
  And the shelved word should not appear in the next batch
  ```

  **Scenario 2: Shelved word excluded from quiz questions**
  ```gherkin
  Given the scenario "stagnant-word-ready-to-shelve" is loaded
  And the app is open with a clean session
  When I select the "let's eat something" deck
  And I complete a batch
  Then the stagnant word should be shelved
  And the shelved word should not appear in any subsequent quiz questions
  ```

  **Scenario 3: maxShelved cap enforced**
  ```gherkin
  Given the scenario "two-words-shelved-cap-reached" is loaded
  And the app is open with a clean session
  When I select the "let's eat something" deck
  And a new word becomes stagnant
  Then only the maximum allowed words remain shelved
  And the new stagnant word stays in the active pool
  ```

  **Scenario 4: New session unshelves previously shelved words**
  ```gherkin
  Given the scenario "fresh-session-with-shelved-words" is loaded
  And the app is open with a clean session
  When I select the "let's eat something" deck
  Then no words should be shelved
  And previously shelved words should appear in the active pool
  ```

  **Scenario 5: Cross-deck isolation**
  ```gherkin
  Given the scenario "cross-deck-isolation" is loaded
  And the app is open with a clean session
  When I select the "let's eat something" deck
  Then I should see the shelved word is excluded from this deck
  When I click "Back to decks"
  And I select the "let's go somewhere" deck
  Then the same word should appear in the active pool for this deck
  ```

  **Scenario 6: Stagnation counters survive mid-session refresh**
  ```gherkin
  Given the scenario "mid-session-stagnation" is loaded
  And shelving config is set to window 2 and max shelved 2
  And the app is open with a clean session
  When I select the "let's eat something" deck
  And I answer all questions in the batch incorrectly for the target word
  And I reload the app
  And I resume the session
  And I answer all questions in the batch incorrectly for the target word
  Then the stagnant word should be shelved
  ```

  **Scenario 7: Shelving state persists across app restart**
  ```gherkin
  Given the scenario "stagnant-word-ready-to-shelve" is loaded
  And the app is open with a clean session
  When I select the "let's eat something" deck
  And I complete a batch to trigger shelving
  And I reload the app
  And I resume the session
  Then the shelved word should still be shelved
  And it should not appear in quiz questions
  ```

  **Acceptance Criteria**:
- [ ] All 7 scenarios pass with `pnpm e2e`
- [ ] Scenarios are independent — each starts from its own fixture, no ordering dependency
- [ ] No flaky waits — use `.pool-debug` and API assertions, not timing

- [ ] Create `apps/srs-demo/e2e/steps/shelving.steps.ts` with step definitions
      **Acceptance Criteria**:
- [ ] `Given the scenario {string} is loaded` — POSTs fixture JSON to `/api/test/seed`
- [ ] `Given shelving config is set to window {int} and max shelved {int}` — POSTs to `/api/test/config/shelving`
- [ ] Answer-incorrectly steps use cheat-hint to identify target word and deliberately choose wrong answer
- [ ] Shelving assertions check both UI state (`.pool-debug`) and API state (`GET /api/shelving?deckId=`)
- [ ] Step definitions follow existing patterns (module-level state, `createBdd()`, `page.request` for API calls)

## 6. Success Criteria

1. All 7 BDD scenarios pass with `pnpm e2e` from `apps/srs-demo`
2. Fixture files are loadable via `curl` for manual testing
3. Config override does not leak between scenarios (reset in Background/cleanup)
4. No cross-scenario state bleed — each scenario is independently runnable
5. `pnpm typecheck` clean across monorepo
6. No changes to production shelving logic — test infrastructure only
