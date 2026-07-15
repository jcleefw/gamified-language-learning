# EP44 - App.vue Router Refactor (Shareable URLs & Browser History)

**Created**: 20260715T213400Z

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: None
**Parallel with**: None
**Successor**: TBD (next epic addressing Vue refactor priorities)
**Predecessor**: None

> **Context**: srs-demo currently uses manual route management via a `screen` ref and v-if statements in App.vue. This makes URLs non-shareable (everything is `/`), breaks browser history, and inflates App.vue to 687 lines. EP44 introduces Vue Router for proper client-side routing, giving each screen its own URL while keeping the app as a true SPA. Individual page refactoring (per the audit report) is deferred to EP45+.

---

## Problem Statement

App.vue is a 687-line monolith combining:
- Learning session state orchestration (384 lines of script)
- Manual screen routing via nested v-if statements (11 screens, 182 lines of template)
- Navigation guards with confirmation dialogs
- Debug recording lifecycle
- Boot-time initialization

**User impact**:
- No shareable URLs — all routes show `/`, can't bookmark a quiz session or share a learning state
- No browser history — back button doesn't work; page transitions aren't in the navigation stack
- Poor UX for returning users — can't deep-link to where they were

**Developer impact**:
- App.vue is unmaintainable (3x over the 120-line best practice)
- Screen transitions are brittle (any new screen = more v-if nesting)
- Routing logic is tangled with session logic
- Hard to add guard conditions (e.g., "don't leave mid-quiz without confirmation")

## Solution

Introduce **Vue Router** to handle URL-to-component mapping declaratively. Each screen becomes a route with its own URL. App.vue shrinks to a layout wrapper (~60 lines) with navbar + RouterView. Session state remains in composables (no change to state management).

**After refactor**:
- Each screen has a routable URL (`/learn/select`, `/learn/quiz/:deckId`, `/review`, etc.)
- Browser back button works; history is preserved
- URLs are bookmarkable and shareable
- App.vue is ~60 lines of orchestration + layout
- Routes are defined in a single `src/router.ts` file for clarity

---

## Scope

**In scope**:

- **Vue Router 4 setup** — install, configure, add router to app bootstrap
- **Route definitions** (`src/router.ts`) — map each screen to a component and URL:
  - `/` → HomePage
  - `/learn/select` → DeckSelectPage
  - `/learn/quiz/:deckId` → QuizPage
  - `/learn/overview/:deckId` → OverviewPage
  - `/review` → ReviewHubPage
  - `/review/due` → ReviewSessionPage (mode: due)
  - `/review/anytime` → ReviewSessionPage (mode: anytime)
  - `/curation` → CurationLandingPage
  - `/curation/curate` → CurateAudioPage
  - `/curation/mark` → MarkAudioPage
- **App.vue refactor** — extract routing logic, reduce to layout + nav + error display (~60 lines)
- **View component stubs** (`src/views/`) — placeholder components for each route (to be filled in EP45)
  - HomePage.vue
  - DeckSelectPage.vue
  - QuizPage.vue
  - OverviewPage.vue
  - ReviewHubPage.vue
  - ReviewSessionPage.vue
  - CurationLandingPage.vue
  - CurateAudioPage.vue
  - MarkAudioPage.vue
- **Route guards** — nav guards for mid-quiz confirmation, recording finalization on route change
- **Query params** (optional) — review mode (`?mode=due|anytime`) or pass via route name
- **Types** (`src/types.ts`) — update or add route-name enums if needed
- **Documentation** — update README with new route structure and development notes

**Out of scope**:

- Individual page component refactoring (oversizing, prop drilling, logic extraction) — **EP45+**
- State management changes — composables stay the same; only the routing layer changes
- E2E test updates — can be done later if tests exist
- Production routing (R2, asset serving) — unaffected; only client-side routing
- Server-side route configuration (all routes served by SPA index.html) — handled by existing Vite config

---

## Stories

### Phase 1: Router Setup (EP44-PH01)

#### EP44-ST01: Install Vue Router 4 & scaffold src/router.ts *(Done — see [EP44-DS01](../../changelogs/EP44--app-vue-router/20260715T231051Z-EP44-DS01-app-router-setup.md) ST01 for the authoritative, code-grounded spec/AC this was verified against — 10 routes, not 9)*

**Acceptance Criteria**:
- [x] Vue Router 4 added to `package.json`
- [x] `src/router.ts` created with all 10 routes defined (see [EP44-DS01](../../changelogs/EP44--app-vue-router/20260715T231051Z-EP44-DS01-app-router-setup.md))
- [x] Routes use lazy-loaded imports (code-split per page)
- [x] Router instantiated and exported, ready to be added to app

**Tasks**:
1. `npm install vue-router@4`
2. Create `src/router.ts` with route definitions
3. Use `() => import('./views/HomePage.vue')` for lazy loading
4. Export `router` instance
5. Verify routes load in dev console

---

#### EP44-ST02: Refactor App.vue to use RouterView *(Done — see [EP44-DS01](../../changelogs/EP44--app-vue-router/20260715T231051Z-EP44-DS01-app-router-setup.md) ST02 for the authoritative spec/AC and implementation notes)*

**Acceptance Criteria**:
- [x] App.vue script reduced from 384 lines — **not to ~60**; landed at ~240 (retained boot hydration + debug-recording handlers + rationale comments; no routing logic remains — see DS01 ST02 notes)
- [x] NavMenu stays (unchanged)
- [x] All screen v-if branches replaced with `<RouterView />`
- [x] Session state remains in `useLearningSession()` and `useReviewSession()` composables
- [x] Navigation calls `router.push()` instead of `screen.value = ...`
- [x] Route guards added for: mid-quiz confirmation, recording finalization (in `src/router-guards.ts`)
- [x] `vue-tsc --noEmit` clean, 109/109 tests passing (verified 20260716)

**Tasks**:
1. Replace `import { screen, ... } from App.vue` with `import { useRouter } from 'vue-router'`
2. Remove `screen` ref and all v-if branches
3. Add `<RouterView />` in template where conditional screens were
4. Replace `screen.value = 'home'` with `router.push('/')`
5. Add navigation guard:
   ```ts
   router.beforeEach((to, from) => {
     // if leaving a quiz mid-session, confirm
     // if recording is active, finalize it
   })
   ```
6. Test navigation between routes

---

### Phase 2: View Component Stubs (EP44-PH02)

#### EP44-ST03: Create view component stubs *(Done)*

**Acceptance Criteria**:
- [x] 9 view components created under `src/views/` (10 — `ResultsPage` also needed, for `App.vue`'s pre-refactor `results` screen)
- [x] Each is a stub that imports the corresponding screen component and passes props
- [x] Props match what App.vue currently passes
- [x] No logic in stubs yet (forwarding, plus the navigation glue App.vue's inline handlers used to own, and deep-link session/mode entry — see [EP44-DS01](../../changelogs/EP44--app-vue-router/20260715T231051Z-EP44-DS01-app-router-setup.md) for the authoritative, code-grounded ST03 spec this was actually verified against)

**Example**:
```vue
<!-- src/views/HomePage.vue -->
<template>
  <HomeDashboard
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    @learn="navigateToLearn"
    @review="navigateToReview"
  />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import HomeDashboard from '@/components/HomeDashboard.vue'
import { useReviewSession } from '@/composables/useReviewSession'

const router = useRouter()
const { dueReviewCount, reviewUnlocked } = useReviewSession(...)

const navigateToLearn = () => router.push('/learn/select')
const navigateToReview = () => router.push('/review')
</script>
```

**Tasks**:
1. [x] Create `src/views/` directory
2. [x] Create stub for each of 9 routes (10, see AC note above)
3. [x] Import App.vue's composables into each view — via `inject()` against the keys `App.vue` provides, not by re-instantiating the composables
4. [x] Pass props and wire events to the underlying component
5. [x] Test that each route renders the correct component — 109 tests passing, `vue-tsc --noEmit` clean

**Notes for follow-on work**: see [EP44-DS01](../../changelogs/EP44--app-vue-router/20260715T231051Z-EP44-DS01-app-router-setup.md)'s ST03 implementation notes for the full detail (the `CurationLanding.vue` extraction, the `ReviewSessionPage`/`QuizPage` deep-link entry points, the auto-unref footgun found and fixed, and the pre-existing `AudioPlayer`/`WaveSurfer` test noise deferred to EP45+).

---

### Phase 3: Integration & Testing (EP44-PH03)

#### EP44-ST04: Test router navigation and history

**Acceptance Criteria**:
- Browser back/forward buttons work correctly
- Each route preserves its state (quiz progress, shelved words, etc.) via composables
- Deep linking works (can paste URL and app recovers state)
- Recording mid-quiz and navigating works (guard finalizes)
- All existing e2e tests pass (updated if needed)

**Tasks**:
1. Manual test: navigate Home → Learn → Select → Quiz → navigate to Review (confirm dialog shown)
2. Test back button: should return to Learn, not Home
3. Test deep link: paste `/learn/quiz/:deckId` into address bar, app loads quiz
4. Test recording guard: start recording, try to navigate away, confirm it finalizes
5. Run e2e suite; update tests if routes changed

---

#### EP44-ST05: Documentation

**Acceptance Criteria**:
- README updated with route structure
- New dev notes on: how to add a route, how router state flows, how session composables work
- RULES.md updated with routing best practice (if not already there)

**Tasks**:
1. Add "Routing Architecture" section to README
2. Document the 9 routes and their purposes
3. Explain why session state stays in composables, not Router params
4. Link to Vue Router docs for common patterns
5. Note: page refactoring is EP45+

---

## Implementation Notes

### State Flow (No Change)

Session state remains in composables across all routes:

```
useLearningSession() ────┐
useReviewSession()       ├─→ Composed in view stubs
useReviewState()         ────┘
```

Routes don't own state; views read from composables. This is a routing refactor, not a state management refactor.

### Route Guards (New)

```ts
router.beforeEach(async (to, from) => {
  // If leaving quiz mid-batch, confirm + finalize recording if active
  const isMidQuiz = from.name === 'quiz' && to.name !== 'quiz'
  if (isMidQuiz && window.confirm('Leave quiz?')) {
    await finishBatchAndTransition()
  }
})
```

### URL Parameters

Quiz route uses `:deckId` param:
```ts
router.push({ name: 'quiz', params: { deckId } })
```

Review mode uses query param (optional):
```ts
router.push({ path: '/review', query: { mode: 'anytime' } })
```

Or split into two routes (`/review/due`, `/review/anytime`); your choice.

### Lazy Loading

Each view is code-split:
```ts
const views = {
  HomePage: () => import('./views/HomePage.vue'),
  DeckSelectPage: () => import('./views/DeckSelectPage.vue'),
  // ...
}
```

This keeps the initial bundle small; pages load on-demand.

---

## Success Criteria

- [ ] App.vue script is ~60 lines (was 384)
- [ ] All 9 screens routable via URL
- [ ] Browser back/forward buttons work
- [ ] URLs are shareable and bookmarkable
- [ ] Navigation guards prevent mid-quiz loss
- [ ] Recording is finalized on cross-phase navigation
- [ ] No state is lost during route transitions (composables persist)
- [ ] E2E tests pass
- [ ] Documentation updated

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| State lost on navigation | State is in composables, not components; survives route changes |
| Deep link breaks recovery | Test with `/learn/quiz/:deckId`; ensure composables hydrate on mount |
| Recording spans phases | Nav guard finalizes recording before allowing cross-phase nav |
| E2E tests expect old URLs | Update tests to use new routes during ST04 |

---

## Effort Estimate

- **ST01** (router setup): 1-2 hours
- **ST02** (App.vue refactor): 2-3 hours
- **ST03** (view stubs): 2-3 hours
- **ST04** (testing): 1-2 hours
- **ST05** (docs): 1 hour

**Total**: ~7-11 hours (distributed across ST01–ST05)

---

## Open Questions

- Should review mode be two routes (`/review/due`, `/review/anytime`) or one with a query param?
- Do E2E tests exist? If so, how many need updates?
- Should we add breadcrumb navigation in the navbar?

---

## Next Steps

After EP44 is complete, prioritize from the Vue refactor audit report (3 FAIL components: DeckOverview, QuizCard, MarkAudio). Scope for the next epic will be determined based on impact and availability.
