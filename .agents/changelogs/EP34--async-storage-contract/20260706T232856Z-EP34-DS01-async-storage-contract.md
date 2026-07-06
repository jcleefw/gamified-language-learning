# EP34-DS01: Async Storage Contract Specification

**Date**: 20260706T232856Z
**Status**: Complete ✅ — ST01 · ST02 · ST03 · ST04 all done; full monorepo test suite, typecheck, and lint green
**Epic**: [EP34 — Async Storage Contract](../../plans/epics/EP34-async-storage-contract.md)
**ADR authority**: [Async Storage Contract ADR](../../../product-documentation/architecture/20260706T125834Z-engineering-async-storage-contract.md)

---

## 1. Feature Overview

Convert the `LearningStore` boundary from **synchronous** to **async** — every method returns `Promise<...>` — while keeping the existing `better-sqlite3` driver underneath via trivial `async` wrappers. **Zero behavioural change**: the wrappers `return`/`await` the same synchronous Drizzle calls, tests stay green.

The contract change ripples outward through the app layer only:

```
packages/db/src/learning-store.ts          ← interface: all methods → Promise<...>
packages/db/src/sqlite-learning-store.ts   ← impl: methods become `async` (no logic change)
        │
        ├── apps/server/src/routes/state.ts        ← await store calls; sync handlers → async
        ├── apps/server/src/routes/shelving.ts      ← await store calls; sync handlers → async
        ├── apps/server/src/routes/test-seed.ts     ← await store calls  (NOT in ADR trace)
        ├── apps/cli-demo-db/src/db-tools.ts         ← await store calls  (NOT in ADR trace)
        └── apps/cli-demo-db/src/learning-io.ts      ← callback TYPES widen; call sites await
                └── engine: packages/srs-engine-v2/src/types/word-state.ts
                            GraduationHook → `void | Promise<void>`  (only engine-core touch)
```

**Boundary discipline preserved**: the engine's *scoring core* is never touched. The single engine edit is widening the `GraduationHook` **callback type** to accept a promise — a signature, not logic. All async execution lives in `@gll/db` and the app layer, exactly as the library boundary intends.

The actual async **driver** swap (libSQL/D1/Firestore) is explicitly **out of scope** — deferred to a future hosting ADR. This DS lands the contract shape only.

---

## 2. Scope Corrections vs the ADR Trace

The ADR traced the ripple at a high level. Reading the code surfaced consumers and a lint gap the ADR did not name:

| Item | ADR said | Actual |
|---|---|---|
| Store methods | "getAllWordStates etc." (4-method snapshot) | **14 methods** — incl. stagnation counters (5) + shelving (4) + `clearUserState`, `close`; all become async |
| Server routes | `state.ts`, `shelving.ts` | **also `test-seed.ts`** — third route consuming the store |
| CLI call sites | `onWordAnswer` at learning-io.ts:394 | **all callbacks** — `onWordAnswer`, `onSentenceAnswer`, `onShelve`, `onUnshelveAll`, `onGetStagnantIds`, `onGraduation`; **plus `db-tools.ts`** |
| `onGetStagnantIds` | not mentioned | returns `store.getStagnantWords(...)` → now `Promise<string[]>`; its call site `?.(ids) ?? []` must `await` |
| ESLint enforcement | "add `no-floating-promises`" | `apps/**` currently lints with **non-type-checked** `recommended` — the rule *cannot run* there without a type-aware config. `packages/**` already gets it via `strictTypeChecked`. The gap is exactly the app layer where the new `await`s live. |

---

## 3. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Async surface scope | **All** `LearningStore` methods → `Promise<...>`, including `close()` | ADR: "the whole storage surface"; half a boundary is not a boundary. `close()` async too — connection teardown is async for pooled/networked drivers |
| Implementation | `SqliteLearningStore` methods marked `async`, wrapping existing sync Drizzle calls unchanged | Zero behavioural change; isolates the contract change from the driver swap |
| Behaviour | No logic change anywhere; all existing test suites pass unchanged | This is the whole point — a mechanical, de-risked conversion |
| Server route handlers | Sync handlers (`GET /state`, `DELETE /state`, `GET /shelving`, `GET /stagnation/stagnant`) become `async (c) =>`; every store call `await`ed | A store call is now a Promise; handlers must await before responding |
| Engine callback types | `GraduationHook` → `(...) => void \| Promise<void>` | Only engine edit; a type widening, not scoring logic. Sibling app callback types widen the same way |
| App callback types | `onWordAnswer`/`onSentenceAnswer`/`onShelve`/`onUnshelveAll`/`onGraduation` → `void \| Promise<void>`; `onGetStagnantIds` → `string[] \| Promise<string[]>` | Callbacks now delegate to async store methods; the loop must `await` them |
| Callback call sites | `learning-io.ts` `await`s each callback invocation inside the batch loop and at loop exit | Missed `await` = lost write / silent stagnation-check skip |
| Lint enforcement | Add a **type-aware** ESLint config block for `apps/**` enabling `@typescript-eslint/no-floating-promises` (evaluate `require-await`) | The app layer is where new `await`s live and where the rule is currently absent |
| Driver swap | **Out of scope** — no libSQL/D1/Firestore | Separate hosting ADR; conflating contract + driver + hosting is how migrations break |
| Vue `srs-demo` app | Untouched | Consumes the server over HTTP, never the store directly |

---

## 4. Data Structures

### `LearningStore` interface — after (all 14 methods async)

```ts
// packages/db/src/learning-store.ts
export interface LearningStore {
  getAllWordStates(userId: string): Promise<RunState>;
  upsertWordState(userId: string, state: WordState): Promise<void>;

  getAllSentenceStates(userId: string): Promise<SentenceRunState>;
  upsertSentenceState(userId: string, state: SentenceState): Promise<void>;

  clearUserState(userId: string): Promise<void>;

  // Stagnation tracking
  updateStagnationCounters(userId: string, deckId: string, activeWordIds: string[]): Promise<void>;
  getStagnantWords(userId: string, deckId: string, threshold: number): Promise<string[]>;
  resetStagnationCounters(userId: string, deckId: string): Promise<void>;
  resetStagnationCountersForWords(userId: string, deckId: string, wordIds: string[]): Promise<void>;

  // Shelving
  getShelvedWords(userId: string, deckId: string): Promise<ShelvedWord[]>;
  shelveWord(userId: string, deckId: string, wordId: string, batchNum: number): Promise<void>;
  unshelveWord(userId: string, deckId: string, wordId: string): Promise<void>;
  unshelveAllWords(userId: string, deckId: string): Promise<void>;

  close(): Promise<void>;
}
```

### `SqliteLearningStore` — async wrapper pattern (no logic change)

```ts
// before
getAllWordStates(userId: string): RunState {
  const rows = this.db.select().from(schema.user_word_states)
    .where(eq(schema.user_word_states.user_id, userId)).all();
  return new Map(rows.map(/* ... */));
}

// after — identical body, `async` keyword only
async getAllWordStates(userId: string): Promise<RunState> {
  const rows = this.db.select().from(schema.user_word_states)
    .where(eq(schema.user_word_states.user_id, userId)).all();
  return new Map(rows.map(/* ... */));
}
```

### Engine `GraduationHook` — widened (only engine-core edit)

```ts
// packages/srs-engine-v2/src/types/word-state.ts
export type GraduationHook = (
  graduatedWordIds: string[],
  runState: RunState,
) => void | Promise<void>;   // ← was: => void
```

### App callback types in `learning-io.ts` — widened

```ts
onWordAnswer?:     (state: WordState) => void | Promise<void>;
onSentenceAnswer?: (state: SentenceState) => void | Promise<void>;
onGraduation?:     GraduationHook;
onShelve?:         (wordId: string, batchNum: number) => void | Promise<void>;
onUnshelveAll?:    () => void | Promise<void>;
onGetStagnantIds?: (activeWordIds: string[]) => string[] | Promise<string[]>;
```

---

## 5. Stories

### Phase 1: Async storage contract (EP34-PH01)

### EP34-ST01: Async `LearningStore` interface + `SqliteLearningStore` wrappers

**Scope**: The storage contract only — `@gll/db`. Interface methods → `Promise<...>`; impl methods become `async` wrapping the existing sync Drizzle calls. No logic change.

**Read list**:
- `packages/db/src/learning-store.ts`
- `packages/db/src/sqlite-learning-store.ts`
- `packages/db/src/__tests__/sqlite-learning-store.test.ts`

**Tasks**:
- [x] `learning-store.ts`: change all 14 method return types to `Promise<...>` (incl. `close()`)
- [x] `sqlite-learning-store.ts`: add `async` to every method; bodies unchanged
- [x] `sqlite-learning-store.test.ts`: `await` every store call

**Acceptance criteria**:
- [x] No `LearningStore` method returns a bare (non-Promise) value
- [x] `SqliteLearningStore` bodies are byte-for-byte identical apart from `async` + `Promise<...>` types
- [x] `pnpm --filter @gll/db test` passes unchanged (green)
- [x] `pnpm --filter @gll/db typecheck` clean
- [x] `strictTypeChecked` (already active on `packages/**`) reports **no** floating promises in `@gll/db` — though it did surface a pre-existing `require-await` conflict, resolved in ST04 (the async wrappers intentionally have no internal `await`)

---

### Phase 2: App-layer propagation (EP34-PH02)

### EP34-ST02: Server routes await store calls

**Scope**: `apps/server` route handlers — `state.ts`, `shelving.ts`, **and `test-seed.ts`**. Await every store call; convert currently-sync handlers to `async`.

**Read list**:
- `apps/server/src/routes/state.ts`
- `apps/server/src/routes/shelving.ts`
- `apps/server/src/routes/test-seed.ts`
- `apps/server/src/__tests__/` (route + seed tests)

**Tasks**:
- [x] `state.ts`: make `GET /state` and `DELETE /state` handlers `async`; `await` `getAllWordStates`, `upsertWordState`, `clearUserState`
- [x] `shelving.ts`: make `GET /shelving` and `GET /stagnation/stagnant` handlers `async`; `await` all store calls (incl. the `for` loop over `shelveWord` in `/shelving/apply`)
- [x] `test-seed.ts`: `await` `clearUserState`, `upsertWordState`, `shelveWord`
- [x] Update any server tests that assert on store state to `await` — also required fixing 4 un-awaited direct `store.*` calls inside `test-seed.test.ts` itself, not just the routes (discovered by rebuilding `@gll/db` and rerunning the suite — the stale `dist` had been masking this)

**Acceptance criteria**:
- [x] Every store call in the three route files is `await`ed
- [x] All four previously-sync handlers are `async`
- [x] `pnpm --filter server test` passes unchanged (green)
- [x] `pnpm --filter server typecheck` clean
- [x] **Edge case**: a rejected store write surfaces as a `500`/error response, not a silently-swallowed floating promise — covered by a test (`test-seed.test.ts > rejected store write propagation`), verified red-without-fix / green-with-fix

### EP34-ST03: CLI runner callbacks + engine hook type

**Scope**: `apps/cli-demo-db` callback propagation + the single engine callback-type widening. Widen callback types; `await` every callback call site in the batch loop; `await` store calls in `db-tools.ts`. Engine scoring core untouched.

**Read list**:
- `packages/srs-engine-v2/src/types/word-state.ts` (`GraduationHook`)
- `apps/cli-demo-db/src/learning-io.ts` (callback decls + call sites)
- `apps/cli-demo-db/src/learning-runner-db.ts` (callback wiring)
- `apps/cli-demo-db/src/db-tools.ts`
- `apps/cli-demo-db/src/__tests__/learning-io.test.ts`, `db-tools.test.ts`, `shelving-integration.test.ts`

**Tasks**:
- [x] `word-state.ts`: widen `GraduationHook` return to `void | Promise<void>`
- [x] `learning-io.ts`: widen `onWordAnswer`/`onSentenceAnswer`/`onShelve`/`onUnshelveAll` to `void | Promise<void>`; widen `onGetStagnantIds` to `string[] | Promise<string[]>`
- [x] `learning-io.ts`: `await` each callback invocation — `onWordAnswer(ws)`, `onSentenceAnswer(ss)`, `onShelve(...)`, `onUnshelveAll()`, `onGraduation(...)`, and `await onGetStagnantIds?.(activeIds) ?? []`
- [x] `db-tools.ts`: `await` `store.upsertWordState` (and any other store calls) — `seedDb` itself became `async`, requiring its one caller (`db-tools-cli.ts`) to `await` it too
- [x] `learning-runner-db.ts`: **this needed a real change, not just verification** — `initialRunState`/`initialSentenceRunState` (from `getAllWordStates`/`getAllSentenceStates`) were un-awaited and used directly as `RunState`/`SentenceRunState`, a typecheck failure once ST01's async contract actually took effect
- [x] Update CLI tests to `await` store calls / async callbacks — also required converting several `.push()`-returning test callbacks to block bodies, since `void | Promise<void>` doesn't get TS's usual "any return is fine for void" leniency the way plain `void` does

**Acceptance criteria**:
- [x] The **only** file changed under `packages/srs-engine-v2/` is `types/word-state.ts` (type widening) — no scoring-logic file touched. (The engine's own **demo** file, `packages/srs-engine-v2/demo/learning-io.ts`, needed a 1-line `await` fix in ST04 after this widening broke its un-awaited `onGraduation` call — not scoring logic, but worth noting.)
- [x] Every callback call site inside the batch loop and at loop exit is `await`ed
- [x] `onGetStagnantIds` result is awaited before `evaluateShelving`
- [x] `pnpm --filter cli-demo-db test` passes unchanged (green)
- [x] `pnpm --filter cli-demo-db typecheck` and `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### Phase 3: Guardrail (EP34-PH03)

### EP34-ST04: Enforce `no-floating-promises` on the app layer

**Scope**: Close the lint gap — `apps/**` currently lints with non-type-checked `recommended`, so `no-floating-promises` cannot run there. Add a type-aware config block for `apps/**`.

**Read list**:
- `eslint.config.ts`

**Tasks**:
- [x] Add an `apps/**/*.ts` config block extending a type-checked preset (or `recommendedTypeChecked`) with `languageOptions.parserOptions.project: true`, enabling `@typescript-eslint/no-floating-promises` — **decision**: extends `recommended` (not `recommendedTypeChecked`) plus this one explicit rule; the full type-checked bundle surfaced ~35 unrelated pre-existing issues (`no-unsafe-assignment`, `no-unnecessary-type-assertion`, parsing errors on Playwright e2e files outside any `tsconfig.json`'s `include`) that are out of scope for this migration
- [x] Evaluate enabling `@typescript-eslint/require-await` — **decision: defer**, scoped-disabled for `sqlite-learning-store.ts` only (14 pre-existing violations there, by design — ST01's async-over-sync wrappers intentionally have zero internal `await`)
- [x] Fix any violations the rule surfaces (should be zero if ST02/ST03 are complete — the rule acts as verification) — it wasn't quite zero: caught 2 real gaps (see below)
- [x] Confirm `packages/**` retains the rule via `strictTypeChecked` (no change needed)

**Acceptance criteria**:
- [x] `no-floating-promises` is active for both `apps/**` and `packages/**`
- [x] `pnpm lint` passes with zero violations across the repo
- [x] Introducing a deliberate un-awaited store call fails lint (manual spot-check on `state.ts`'s `clearUserState`, then reverted)

**What the rule actually caught** (proof ST02/ST03 weren't fully clean):
- `learning-runner-db.ts`'s `onUnshelveAll`/`onGetStagnantIds` inline callbacks had fire-and-forget store calls flagged in ST03 as a risk, not fixed — now `async` with sequential `await`s.
- `packages/srs-engine-v2/demo/learning-io.ts` — un-awaited `onGraduation(...)`, broken by ST03's `GraduationHook` widening and missed because it's a demo file with no test coverage exercising the lint-relevant path.

---

## 6. Ordering & Verification

1. **ST01 → ST02/ST03 → ST04.** The awaits (ST02/ST03) must land before the rule is enabled (ST04), otherwise lint fails on the very code being converted.
2. ST04's rule is the **verification mechanism**: after ST01–ST03, turning it on should pass clean. A remaining violation means a missed `await`.
3. Each story's primary safety net is **tests-stay-green** — behaviour is unchanged, so any red test signals a real regression in the mechanical conversion.

---

## 7. Success Criteria — all met ✅

1. [x] `LearningStore` and `SqliteLearningStore` are fully async; no method returns a bare value.
2. [x] No behavioural change — `@gll/db`, `server`, and `cli-demo-db` test suites pass unchanged (green): 31/31, 62/62, 40/40.
3. [x] Server routes and CLI callbacks `await` every store call; no floating promises remain.
4. [x] Engine scoring core is unmodified — the only engine edit is the `GraduationHook` type widening.
5. [x] `no-floating-promises` is active in CI (`apps/**` + `packages/**`) and passes with zero violations.
6. [x] A rejected store write propagates through the awaiting route/callback rather than being silently swallowed (tested).
7. [x] No type errors: `pnpm typecheck` clean across all packages.

**Delivered across 3 commits** on `EP-34--async-storage-contract`: `795fd6a` (ST02), `26425c7` (ST03), `e2bc94d` (ST04). ST01 landed earlier (`a4613c0`).
