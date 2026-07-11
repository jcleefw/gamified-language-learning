# EP38-DS03: `App.vue` Composable Refactor Specification

**Date**: 20260709T220554Z
**Status**: Draft
**Epic**: [EP38 - Review Mode in `srs-demo`](../../plans/epics/EP38-review-mode-srs-demo.md)

**Architecture**: No new behaviour — this is a structural cleanup of the client code EP38-ST05–ST08
landed in [`App.vue`](../../../apps/srs-demo/src/App.vue). No ADR changes; Learning/Review authority
boundaries stay exactly as DS01/DS02 defined them, this DS only moves where the client-side
orchestration code lives.

---

## 1. Feature Overview

`App.vue` is now ~1056 lines. EP38 (landing dashboard, Review session, nav menu) was layered onto
an already-large Learning-flow file without splitting it, and it shows: the file mixes four
unrelated concerns as one flat sea of `ref`s and top-level functions —

1. **Boot** (`onMounted`, ~110 lines): fetch decks, load config, load run state, load the Review
   due-badge, load shelved words, apply a test-only sentence-config override.
2. **Learning session state machine** (~350 lines): `sessionState`, `globalRunState`, `batchState`,
   `sentenceRunState`, `batchNum`, `shelvedSet`, `completedDeckIds`, and the functions that drive
   them — `startBatch`, `initSession`, `finishBatchAndTransition` (the single largest function,
   ~170 lines, and it also inlines the shelving pipeline), `onAnswered`, `onExitBatch`, `onResume`,
   `onClear`.
3. **Review session state machine** (~150 lines, added by EP38-ST05–ST07): `dueReviews`,
   `reviewBatchState`, `reviewQuestion`, `reviewSummary`, `reviewCaughtUp`, `badgeError`, and
   `onReview`, `advanceReviewQueue`, `onReviewAnswered`, `onReviewExit`.
4. **Screen/nav orchestration** (added by EP38-ST08): `screen`, `activeNav`, `navTo`, plus the
   shelving-handler glue (`onUnshelveWord`, `onUpdateShelvedSet`, `onUpdateWordStates`).

This DS decomposes (2) and (3) into composables, matching the pattern the codebase already uses for
client-side logic — `useStore.ts` (fetch wrappers), `useShelving.ts` (fetch wrappers),
`useQuizDebugLog.ts` (debug logging). `App.vue` currently has no composable for its own state
machines even though it's by far the largest concentration of logic in the app. After this DS,
`App.vue` holds only `screen`/`apiError`/boot-orchestration/nav wiring and the template — instantiate
the composables, wire their outputs to props/emits.

**This is a pure refactor** (per `.agents/skills/dev/refactor/SKILL.md`): no behavior change, no
public-interface change (the rendered `Screen` states, template bindings, and child-component
props/emits are identical before and after). If a bug is spotted during the move, it is noted, not
fixed inline.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Decomposition unit | Extract two Vue composables: `useLearningSession.ts`, `useReviewSession.ts`. Boot logic (`onMounted`) stays in `App.vue` (it seeds state both composables need, and only runs once) | Matches the existing `useStore`/`useShelving` composable pattern; avoids inventing a third "boot" abstraction for ~40 lines of sequential fetches that are not reused elsewhere |
| `useLearningSession` inputs | Takes `wordPool`, `appDecks`, `CONFIG`, `configReady`, `deckId` (readonly refs owned by `App.vue`/boot) plus its own internal state (`sessionState`, `globalRunState`, `batchState`, `sentenceRunState`, `batchNum`, `shelvedSet`, `completedDeckIds`) | `globalRunState` must be readable by boot (to seed `hasSavedSession`) and by `useReviewSession`'s `reviewUnlocked` gate — expose it from the composable's return, don't duplicate it |
| `useReviewSession` inputs | Takes `wordPool` and `globalRunState` (from `useLearningSession`'s return) as readonly refs; owns its own `dueReviews`, `reviewBatchState`, `reviewQuestion`, `reviewSummary`, `reviewCaughtUp`, `badgeError`, `dueReviewCount` | `reviewUnlocked` depends on `globalRunState` (Learning's mastery data) — cross-composable read, not a new source of truth |
| Function boundary | Each composable exports the exact same functions currently on `App.vue`, unrenamed (`startBatch`, `initSession`, `finishBatchAndTransition`, `onAnswered`, `onExitBatch`, `onResume`, `onClear` → `useLearningSession`; `onReview`, `advanceReviewQueue`, `onReviewAnswered`, `onReviewExit` → `useReviewSession`) | Renaming while moving conflates two changes; keep the diff a pure relocation so it's easy to verify nothing else changed |
| `finishBatchAndTransition`'s shelving pipeline | Moves as-is into `useLearningSession` (imports `useShelving.ts` functions directly, as `App.vue` does today) | It's Learning-only logic (stagnation counters, `applyShelving`, active-pool rebalance) — no reason to split it into a third composable in this pass; that's a separate future cleanup if `finishBatchAndTransition` still reads long after this split |
| `navTo` / `activeNav` / shelving-handler glue | Stay in `App.vue` | These are cross-composable orchestration (nav decides whether to flush Learning before entering Review) and template-prop glue (`onUnshelveWord` etc. just forward to `shelvedSet`) — they don't belong to either single composable |
| `App.vue`'s `onMounted` | Stays in `App.vue`, but calls into composable-exposed setters/functions where it currently mutates state directly (e.g. `sessionState.value = ...` → whatever `useLearningSession` exposes for resuming) | Boot is inherently cross-cutting (decks → config → run state → review badge → shelved words) — pulling it into a composable would just relocate the same coupling under a different name |
| Public interface | Identical: same `Screen` union, same template markup/bindings, same child-component props/emits, same `localStorage` keys, same API calls in the same order | Per the refactor skill — a structural-only change; any interface change stops and aligns with the user first |

## 3. Data Structures

```typescript
// apps/srs-demo/src/composables/useLearningSession.ts
export function useLearningSession(deps: {
  wordPool: Ref<QuizItem[]>;
  appDecks: Ref<AppDeckPayload[]>;
  CONFIG: Ref<ConfigType>;
  configReady: Ref<boolean>;
  apiError: Ref<string | null>;
}) {
  // internal refs: sessionState, globalRunState, batchState, currentQuestion,
  // sentenceRunState, batchNum, shelvedSet, completedDeckIds, batchScore,
  // summary, questionKey, isFinishingBatch, deckId, hasSavedSession
  // computed: currentRunState, activeItems, queue, masteredDeck, masteredGlobal,
  //           nextDeckId, shelvedItems
  return {
    // state (readonly where only read externally)
    sessionState, globalRunState, batchState, currentQuestion, batchNum,
    shelvedSet, completedDeckIds, deckId, hasSavedSession, batchScore, summary,
    questionKey, savedDeckName,
    activeItems, queue, masteredDeck, masteredGlobal, nextDeckId, shelvedItems,
    // functions (unchanged signatures)
    startBatch, initSession, onResume, onClear, finishBatchAndTransition,
    onAnswered, onExitBatch, onNext, onSelectDeck, onUnshelveWord,
    onUpdateShelvedSet, onUpdateWordStates, recalculateCompletedDecks,
  };
}
```

```typescript
// apps/srs-demo/src/composables/useReviewSession.ts
export function useReviewSession(deps: {
  wordPool: Ref<QuizItem[]>;
  globalRunState: Ref<RunState>;   // from useLearningSession
  configReady: Ref<boolean>;
  CONFIG: Ref<ConfigType>;
  apiError: Ref<string | null>;
}) {
  // internal refs: dueReviews, dueReviewCount, badgeError, reviewBatchState,
  // reviewQuestion, reviewShownAt, reviewQuestionKey, reviewCaughtUp, reviewSummary
  return {
    dueReviews, dueReviewCount, badgeError, reviewBatchState, reviewQuestion,
    reviewQuestionKey, reviewCaughtUp, reviewSummary, reviewUnlocked,
    onReview, onReviewAnswered, onReviewExit, refreshDueBadge,
  };
}
```

`App.vue`'s remaining top-level state: `apiError`, `appDecks`, `wordPool`, `CONFIG`, `configReady`,
`screen`, `overviewDeckId`, `activeNav`, plus the two composable instances.

## 4. User Workflows

```
App.vue setup()
  → learning = useLearningSession({ wordPool, appDecks, CONFIG, configReady, apiError })
  → review   = useReviewSession({ wordPool, globalRunState: learning.globalRunState,
                                   configReady, CONFIG, apiError })
  → onMounted: fetch decks/config/state (as today) → seed learning.globalRunState,
    learning.hasSavedSession, learning.deckId → if review.reviewUnlocked, review.refreshDueBadge()
    → screen = 'home'

navTo(target)  [unchanged logic, now calling into learning/review]
  → if leaving an active quiz with results → await learning.finishBatchAndTransition()
  → if target === 'review' → void review.onReview()
  → else screen = target
```

No change to the sequence of API calls, screen transitions, or child-component events — this DS
only moves where the code that implements each step lives.

## 5. Stories

### EP38-ST09: Extract `useReviewSession` composable

**Scope**: Move all Review-session state and functions out of `App.vue` into
`composables/useReviewSession.ts`, following `useLearningSession`'s dependency-injection shape
(pass in `wordPool`/`globalRunState`/`CONFIG`/`configReady`/`apiError` as refs). Extracted first —
it's the smaller, more self-contained of the two, and de-risks the pattern before the larger move.
**Read List**: `apps/srs-demo/src/App.vue` (current Review section, `resolveDueItems`,
`toReviewQuestionType`, `reviewUnlocked`, `onReview`/`advanceReviewQueue`/`onReviewAnswered`/
`onReviewExit`), `apps/srs-demo/src/composables/useStore.ts` (`loadDueReviews`/`postReviewAnswer`,
already exist — reused as-is), `apps/srs-demo/src/composables/useShelving.ts` (sibling composable
shape/style to match)
**Tasks**:

- [ ] Create `useReviewSession.ts` with the refs/computed/functions listed in §3, unchanged bodies
- [ ] Update `App.vue` to instantiate it and rewire template bindings (`reviewQuestion`,
      `reviewBatchState`, `reviewSummary`, `reviewCaughtUp`, `dueReviewCount`, `badgeError`) and event
      handlers (`@review="navTo('review')"` → still calls `navTo`, which now calls
      `review.onReview()`) to the composable's exports
- [ ] Delete the now-dead code from `App.vue`
- [ ] Add `apps/srs-demo/src/composables/__tests__/useReviewSession.test.ts` (vitest, see §7): cover
      `reviewUnlocked` gate (locked/unlocked/fail-closed on `!configReady`), `resolveDueItems` orphan
      skipping, `onReview` building the queue from due items, `advanceReviewQueue`
      exhaustion→summary transition, and `onReviewAnswered`'s failure path (does not advance the queue)
      **Acceptance Criteria**:
- [ ] `pnpm --filter @gll/srs-demo typecheck` passes with no errors
- [ ] `pnpm --filter @gll/srs-demo test` (new script, §7) passes, covering the cases above
- [ ] No behavior/interface change — same `Screen` values, same props/emits on `QuizCard` /
      `ReviewSummary` / `NavMenu`

### EP38-ST10: Extract `useLearningSession` composable

**Scope**: Move all Learning-session state and functions (§3) out of `App.vue` into
`composables/useLearningSession.ts`, including the inline shelving pipeline inside
`finishBatchAndTransition`. This is the larger, riskier move — do it after ST09 so the
composable-extraction pattern is already proven once.
**Read List**: `apps/srs-demo/src/App.vue` (current Learning section: `startBatch`, `initSession`,
`finishBatchAndTransition`, `onAnswered`, `onExitBatch`, `onResume`, `onClear`, and every computed
that reads `sessionState`/`globalRunState`), `apps/srs-demo/src/composables/useShelving.ts` (already
imported by `finishBatchAndTransition` — import path doesn't change, just which file calls it),
`apps/srs-demo/src/composables/useQuizDebugLog.ts` (already imported by `startBatch`/
`finishBatchAndTransition` — same)
**Tasks**:

- [ ] Create `useLearningSession.ts` with the refs/computed/functions listed in §3, unchanged bodies
      (including the shelving pipeline inside `finishBatchAndTransition`)
- [ ] Update `App.vue` to instantiate it, pass `learning.globalRunState` into `useReviewSession`
      (ST09), and rewire every remaining template binding (`currentQuestion`, `batchState`,
      `activeItems`, `queue`, `masteredDeck`, `masteredGlobal`, `shelvedItems`, `summary`,
      `batchScore`, `completedDeckIds`, `nextDeckId`, `savedDeckName`) and handler
      (`onSelect`/`onOverview`/`onNext`/`onNextDeck`/`onUnshelveWord`/`onUpdateShelvedSet`/
      `onUpdateWordStates`) to the composable's exports
- [ ] Move `onMounted`'s direct state mutations (`sessionState.value = ...`,
      `globalRunState.value = runState`, `shelvedSet.value = ...`) to call the composable's exposed
      setters/functions instead of reaching into its internals
- [ ] Delete the now-dead code from `App.vue`
- [ ] Add `apps/srs-demo/src/composables/__tests__/useLearningSession.test.ts` (vitest, see §7): cover
      `startBatch` question assembly, `initSession` mastered/shelved exclusion, `onAnswered`'s
      batch-done→`finishBatchAndTransition` handoff, `finishBatchAndTransition`'s persistence-failure
      revert path (`confirmed` map fallback), the shelving-trigger branch (stagnant word → shelved +
      active pool rebalanced), and `recalculateCompletedDecks`
      **Acceptance Criteria**:
- [ ] `pnpm --filter @gll/srs-demo typecheck` passes with no errors
- [ ] `pnpm --filter @gll/srs-demo test` passes, covering the cases above
- [ ] `App.vue` is reduced to boot orchestration (`onMounted`), `screen`/`apiError`/`overviewDeckId`,
      `navTo`/`activeNav`, and the template — no Learning- or Review-specific business logic remains
      at the top level
- [ ] No behavior/interface change — diff the reference copy
      (`/private/tmp/.../scratchpad/App.vue.reference.vue`, taken before this DS's work started)
      against the final `App.vue` to confirm every removed line reappears verbatim in one of the two
      new composables, not altered

## 6. Success Criteria

1. `App.vue` shrinks from ~1056 lines to boot + nav + template only (target: under 350 lines).
2. Two new composables (`useLearningSession.ts`, `useReviewSession.ts`) each own one state machine,
   matching the existing `useStore.ts`/`useShelving.ts`/`useQuizDebugLog.ts` pattern.
3. `pnpm --filter @gll/srs-demo typecheck` passes; no `ts-fsrs` or `vue-router` import introduced.
4. No behavior change: every screen transition, API call sequence, and child-component prop/emit is
   identical before and after, verified by the new vitest unit tests (BDD/e2e is skipped — see Note
   below) and by diffing against the pre-refactor reference copy of `App.vue`.
5. `finishBatchAndTransition`'s shelving pipeline and every other function body moves unrenamed and
   unaltered — this is a pure relocation, not a rewrite.
6. `pnpm --filter @gll/srs-demo test` runs green in CI-equivalent form (new script, §7).

## 7. Note on Verification

Per user direction, this refactor's safety net is **vitest unit tests on the two extracted
composables**, and it **skips the `pnpm e2e` Playwright/BDD suite** (already flaky for `srs-demo`,
per EP38's epic Next Steps). This is a deliberate substitution of the `refactor` skill's default
safety net ("tests must be green before you start / run after every step") — the composables are
new files with no pre-existing unit coverage, so the tests are written *as part of* each extraction
story (ST09, ST10) rather than pre-existing; each is added and passing before that story is
considered done, then re-run after the next story to catch regressions.

**Test infra** (`srs-demo` currently has zero unit tests — Playwright-BDD only, per DS02 §7):

- Add `vitest` to `apps/srs-demo/package.json` devDependencies and a `test` script
  (`"test": "vitest run"`); add `apps/srs-demo/vitest.config.ts` mirroring
  `packages/srs-engine-v2/vitest.config.ts`'s shape (`include: ['src/**/__tests__/**/*.test.ts']`,
  `globals: true`, `passWithNoTests: true`)
- Add `apps/srs-demo` to `vitest.workspace.ts` (currently only globs `packages/*/vitest.config.ts`)
- Composables call `fetch` (via `useStore.ts`/`useShelving.ts`); tests stub `global.fetch` per-case
  (e.g. `vi.stubGlobal('fetch', vi.fn(...))`) rather than hitting a real server — consistent with
  these being **unit** tests of orchestration logic, not integration tests of the HTTP layer
- Style/assertion conventions follow `packages/srs-engine-v2/src/__tests__/unit/adaptive-loop.test.ts`
  (`describe`/`it`/`expect`, small local factory functions for fixtures like `makeItem`/`makeState`)

This is a narrower safety net than the skill's default, accepted because: the existing e2e suite was
already an unreliable gate for this file (per the epic's own Next Steps), the change is mechanical
(move, don't rewrite — bodies are unchanged), and a structural diff against the pre-refactor
reference copy of `App.vue` (saved to the scratchpad before ST09 began) backstops that no logic was
altered in transit, only relocated.
