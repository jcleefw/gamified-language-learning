# EP44-DS01: App Router Setup & Navigation Refactor Specification

**Date**: 20260715T231051Z
**Status**: Phase 1 & 2 Complete (ST01–ST03 done); Phase 3 (ST04–ST05) pending
**Epic**: [EP44 - App.vue Router Refactor](../../plans/epics/EP44-app-vue-router-refactor.md)

---

## 1. Feature Overview

`App.vue` is a 686-line component (script 383, template 181) that hand-rolls "routing" with a single `screen` string ref driving a chain of `v-if`/`v-else-if` branches. This DS introduces **Vue Router 4** so every screen gets a real URL, the browser back/forward buttons and bookmarking work, and `App.vue` collapses to a layout shell (`<NavMenu>` + `<RouterView>` + error banner).

**The single hardest fact this DS is built around** — and the one the prior draft got wrong — is that **`screen` is co-owned**. It is created in `App.vue` (line 45) but passed *by reference into `useLearningSession`* (`screen: Ref<Screen>`), and the composable mutates it directly (`screen.value = 'quiz' | 'results' | 'select'`). You cannot simply "delete the `screen` ref and drop in `<RouterView>`": every write to `screen.value` inside the composable and inside `navTo` must become a router navigation, or the state machine silently breaks. This DS therefore replaces the injected `Ref<Screen>` with an injected **navigation callback**, preserving the existing dependency-injection seam rather than making the composable import the router directly.

Two more code realities shape the design:

1. **The `curation` landing screen has no component** — it is inline `<div class="curation-landing">` markup in `App.vue` (lines 428–443). It must be extracted into a component before it can be mounted by a route.
2. **Navigation today runs through `navTo` (App.vue 203–252)**, which is *not* a trivial `screen.value = x`. It computes `isMidQuiz`, calls `crossesPhaseOrMidQuiz(...)` to decide a `window.confirm`, flushes the partial learning batch via `finishBatchAndTransition()`, then calls `finalizeRecordingOnNav(...)` and **aborts navigation if finalization fails**. This entire sequence must move into a `router.beforeEach` guard.

**Scope of this DS**: Phase 1 (router install + `App.vue` refactor + guard) and Phase 2 (view wrappers). State management does **not** change — session state stays in the existing composables. Individual screen-component refactors (the audit's FAIL list: DeckOverview, QuizCard, MarkAudio) remain **out of scope** (EP45+).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Router library | Vue Router 4 (`npm install vue-router@4`) | Not currently a dependency; `main.ts` is a bare `createApp(App).mount('#app')`. Official router, lazy loading, typed named routes. |
| Route table | Single `src/router.ts`, **10 routes** matching the 10 `Screen` union values | Grounds the table in `src/types.ts`; no invented "9 routes". One file, all routes visible. |
| `screen` ref removal | Delete `screen` ref; **replace the `Ref<Screen>` dependency of `useLearningSession` with a `navigate` callback** | `useLearningSession` mutates `screen` internally (lines 263/352/538/578). Injecting a callback preserves the existing DI seam and keeps the composable router-agnostic. |
| `useReviewSession` | **No signature change** | It never received `screen`; it returns status strings (`'entered'`/`'stayed'`) and App.vue decided the screen. The deciding logic moves to the review view wrapper. |
| Curation landing | **Extract `CurationLanding.vue`** from App.vue's inline markup, then route to it | A route cannot mount inline template markup; extraction is a prerequisite, not optional. |
| QuizCard reuse | `QuizCard.vue` backs **two** routes (learning quiz + review session) via two view wrappers with different props | One component, two routes — matches today's dual `v-if` usage (App.vue 508 vs 542). |
| ReviewSummary | **Not a route** — rendered as a sub-state inside the review-session view | Today it is the `reviewQuestion === null` branch within `screen === 'review'`; keep that internal switch in the view. |
| BatchResults | Own route `/learn/results` | Real `Screen` value `'results'`; the prior draft omitted it. |
| Deck identity | `:deckId` path param for `/learn/quiz/:deckId` and `/learn/overview/:deckId` | Replaces the standalone `overviewDeckId` ref (App.vue 46) and reconciles with the existing `LAST_DECK_KEY` localStorage resume. |
| Review mode | Query param `?mode=due\|anytime` on `/review/session` | `useReviewSession` already tracks `reviewMode`; one route, mode in query. |
| Navigation guard | `router.beforeEach` reproducing `navTo`'s logic: `crossesPhaseOrMidQuiz` → `window.confirm` → `finishBatchAndTransition()` → `finalizeRecordingOnNav()`; **abort nav if finalize returns `'failed'`** | This is the real guard behavior in App.vue 203–252 — not a bare "leave quiz?" confirm. |
| Debug recording | Guard uses the existing `useDebugRecording()` singleton and `finalizeRecordingOnNav`/`crossesPhaseOrMidQuiz` helpers | Correct names — there is **no** `useDebugRecorder`. State is a module-level singleton. |
| Curation route gating | Curation routes guarded by `env.curationMode` (guard redirect to `/`) | Today the three curation blocks are gated by `env.curationMode` in the template; preserve that gate. |
| Lazy loading | `() => import('./views/PageName.vue')` per route | Keeps initial bundle small. |
| Deep-link hydration | Boot hydration stays in `App.vue onMounted`; views read route params/query and reconcile with `LAST_DECK_KEY` | Only `useLearningSession` touches localStorage (one key). No URL reading exists today; add param/query hydration in the views, not the router. |

---

## 3. Data Structures

```typescript
// ── src/types.ts (existing — the source of truth for screens) ──────────
// export type Screen =
//   | 'home' | 'select' | 'quiz' | 'results' | 'overview'
//   | 'review-hub' | 'review' | 'curation' | 'curate' | 'mark'
// 10 values → 10 routes.

// ── src/router.ts ──────────────────────────────────────────────────────
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

export const ROUTE_NAMES = {
  HOME: 'home',
  DECK_SELECT: 'select',
  QUIZ: 'quiz',
  RESULTS: 'results',
  OVERVIEW: 'overview',
  REVIEW_HUB: 'review-hub',
  REVIEW_SESSION: 'review',
  CURATION: 'curation',
  CURATE: 'curate',
  MARK: 'mark',
} as const

const routes: RouteRecordRaw[] = [
  { path: '/',                     name: ROUTE_NAMES.HOME,        component: () => import('./views/HomePage.vue') },
  { path: '/learn/select',         name: ROUTE_NAMES.DECK_SELECT, component: () => import('./views/DeckSelectPage.vue') },
  { path: '/learn/quiz/:deckId',   name: ROUTE_NAMES.QUIZ,        component: () => import('./views/QuizPage.vue') },
  { path: '/learn/results',        name: ROUTE_NAMES.RESULTS,     component: () => import('./views/ResultsPage.vue') },
  { path: '/learn/overview/:deckId', name: ROUTE_NAMES.OVERVIEW,  component: () => import('./views/OverviewPage.vue') },
  { path: '/review',               name: ROUTE_NAMES.REVIEW_HUB,  component: () => import('./views/ReviewHubPage.vue') },
  { path: '/review/session',       name: ROUTE_NAMES.REVIEW_SESSION, component: () => import('./views/ReviewSessionPage.vue') }, // ?mode=due|anytime
  { path: '/curation',             name: ROUTE_NAMES.CURATION,    component: () => import('./views/CurationLandingPage.vue'), meta: { curationOnly: true } },
  { path: '/curation/curate',      name: ROUTE_NAMES.CURATE,      component: () => import('./views/CurateAudioPage.vue'), meta: { curationOnly: true } },
  { path: '/curation/mark',        name: ROUTE_NAMES.MARK,        component: () => import('./views/MarkAudioPage.vue'), meta: { curationOnly: true } },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// ── src/composables/useLearningSession.ts — dependency change ──────────
// BEFORE:  deps include  screen: Ref<Screen>   // composable did screen.value = 'quiz'
// AFTER:   deps include  navigate: (name: string, params?, query?) => void | Promise<void>
//   internal 'quiz'    →  navigate('quiz', { deckId })
//   internal 'results' →  navigate('results')
//   internal 'select'  →  navigate('select')
// No other composable-internal state changes.

// ── src/router-guards.ts (or inline in router.ts) ──────────────────────
// Reproduces App.vue navTo (lines 203–252):
router.beforeEach(async (to, from) => {
  // 0. Curation gating
  if (to.meta.curationOnly && !env.curationMode) return { name: ROUTE_NAMES.HOME }

  const { batchState, finishBatchAndTransition } = useLearningSession(/* shared instance */)
  const recorder = useDebugRecording()

  const fromPhase = phaseOf(from.name)          // maps route → recording phase
  const targetPhase = phaseOf(to.name)
  const isMidQuiz = from.name === ROUTE_NAMES.QUIZ && to.name !== ROUTE_NAMES.QUIZ

  // 1. Confirm if crossing phase / leaving mid-quiz (crossesPhaseOrMidQuiz, App.vue:211)
  if (crossesPhaseOrMidQuiz(fromPhase, targetPhase, isMidQuiz)) {
    const hasPartial = isMidQuiz && batchState.value?.results?.length > 0
    if (hasPartial && !window.confirm('Leave this quiz? Your current batch will be finished.')) {
      return false // abort
    }
    if (hasPartial) await finishBatchAndTransition() // flush partial batch (App.vue:226)
  }

  // 2. Finalize recording AFTER flush; abort nav if it fails (App.vue:232)
  const result = await finalizeRecordingOnNav(recorder, targetPhase, isMidQuiz)
  if (result === 'failed') return false

  return true
})
```

> **Shared-instance caveat**: `useLearningSession` currently takes constructor deps and is instantiated once in `App.vue`. The guard needs the *same* instance's `batchState`/`finishBatchAndTransition`. ST02 must expose that single instance (module-singleton pattern like `useDebugRecording`, or a provide/inject) rather than calling `useLearningSession(...)` a second time inside the guard.

---

## 4. User Workflows

```
Boot / deep link
  ↓
main.ts: createApp(App).use(router).mount('#app')
  ↓
App.vue onMounted hydrates: fetch /api/decks, wordPool, loadConfig, loadRunState,
   refresh review badge/availability, load shelved words (LAST_DECK_KEY)
  ↓
Router resolves current URL (or '/') → RouterView mounts the matching view
  ↓
View reads composables (+ route params/query) → renders existing screen component

Mid-quiz navigation (the guarded path — replaces navTo)
  ↓
User clicks NavMenu "Home" while on /learn/quiz/:deckId
  ↓
router.push({ name: 'home' }) → beforeEach guard runs
  ↓
crossesPhaseOrMidQuiz(quiz→home, isMidQuiz=true) === true
  ↓
batchState has partial results? → window.confirm('Leave this quiz?...')
  ├─ Cancel → return false (navigation blocked, stays on quiz)
  └─ OK     → await finishBatchAndTransition() (flush partial batch)
  ↓
await finalizeRecordingOnNav(recorder, 'home', isMidQuiz)
  ├─ 'failed' → return false (navigation blocked)
  └─ ok       → return true → route changes to '/' → HomePage mounts
```

---

## 5. Stories

### Phase 1: Router Setup & App.vue Refactor (EP44-PH01)

#### EP44-ST01: Install Vue Router 4 & scaffold `src/router.ts` *(Done)*

**Scope**: Dependency + route table + bootstrap wiring
**Read List**: `apps/srs-demo/package.json`, `apps/srs-demo/src/main.ts`, `apps/srs-demo/src/types.ts` (the `Screen` union), `apps/srs-demo/src/env.ts`

**Tasks**:

- [x] Install Vue Router 4
      **Acceptance Criteria**:
- [x] `npm install vue-router@4` succeeds; `package.json` + lockfile updated and committed
- [x] Create `src/router.ts` with all 10 routes
      **Acceptance Criteria**:
- [x] One route per `Screen` value (`src/types.ts`); names match `ROUTE_NAMES`
- [x] `/learn/quiz/:deckId` and `/learn/overview/:deckId` declare the `:deckId` param
- [x] Curation routes carry `meta: { curationOnly: true }`
- [x] Each route uses lazy `() => import('./views/...')`
- [x] `createWebHistory(import.meta.env.BASE_URL)`; `router` exported
- [x] Wire router into bootstrap
      **Acceptance Criteria**:
- [x] `src/main.ts` calls `.use(router)` before `.mount('#app')`
- [x] App mounts with no console errors; `router.getRoutes()` lists all 10
- [x] No TypeScript errors in `router.ts`

**Implementation notes**: `ROUTE_NAMES` was split into its own `src/routeNames.ts` (not inline in `router.ts` as the spec sketched) so `router-guards.ts` can import route names without a `router.ts` ↔ `router-guards.ts` import cycle.

---

#### EP44-ST02: Refactor App.vue to `<RouterView>`, rewire `useLearningSession`, add the nav guard *(Done)*

**Scope**: App.vue script/template collapse; `useLearningSession` dependency swap; `beforeEach` guard
**Read List**: `src/App.vue` (entire), `src/composables/useLearningSession.ts` (esp. the `screen` writes at 263/352/538/578 and `finishBatchAndTransition` 355–364/538), `src/composables/useReviewSession.ts`, `src/composables/useDebugRecording.ts` (helpers `finalizeRecordingOnNav` 274, `crossesPhaseOrMidQuiz` 242), `src/types.ts`

**Tasks**:

- [x] Replace the `Ref<Screen>` dependency of `useLearningSession` with a `navigate` callback
      **Acceptance Criteria**:
- [x] `useLearningSession` no longer imports/receives `screen`
- [x] Internal `screen.value = 'quiz'|'results'|'select'` become `navigate(...)` calls (quiz passes `{ deckId }`)
- [x] `useReviewSession` signature unchanged
- [x] Expose a **single shared** `useLearningSession` instance reachable by the guard (module singleton or provide/inject)
- [x] Remove `screen` from App.vue and collapse the template to `<RouterView>`
      **Acceptance Criteria**:
- [x] `screen` ref (App.vue:45) and `overviewDeckId` (App.vue:46) removed
- [x] All 10 `v-if`/`v-else-if` screen branches (incl. the 3 curation blocks and the review sub-switch) removed
- [x] Template = `<NavMenu>` + `<RouterView>` + `apiError` banner + env-gated debug buttons only
- [x] App.vue template ≤ ~40 lines (from 181) — **script is ~240 lines, not ≤~80**; see implementation notes
- [x] `onMounted` boot hydration retained
- [x] Port `navTo` logic into a `router.beforeEach` guard
      **Acceptance Criteria**:
- [x] Guard computes `isMidQuiz`, calls `crossesPhaseOrMidQuiz(...)`, and shows `window.confirm` only when leaving a quiz with `batchState.results.length > 0`
- [x] On confirm, `await finishBatchAndTransition()` before navigating; on cancel, navigation is blocked (`return false`)
- [x] `await finalizeRecordingOnNav(...)` runs after the batch flush; returns `false` (aborts nav) when it yields `'failed'`
- [x] `env.curationMode === false` redirects `curationOnly` routes to `/`
- [x] NavMenu `@home/@learn/@review/@curation` call `router.push(...)`; `activeNav` derived from `route.name`
- [x] App renders (RouterView empty until ST03); no console/type errors

**Implementation notes**:
- Guard logic lives in `src/router-guards.ts` (`registerNavigationGuard`), not inline in `App.vue`/`router.ts` — keeps `router.ts` a pure route table. `learningSessionSingleton.ts` is the module-level seam the guard uses to reach the one `useLearningSession` instance App.vue creates (the guard runs outside the component tree and can't `inject()`).
- **Script-length AC not met**: App.vue's script is ~240 lines, well over the ~80-line target. The overage is boot hydration (`onMounted`, retained per spec), the debug-recording toggle/dump handlers, and — largest single contributor — extensive rationale comments explaining non-obvious seams (`internalNavigate`'s `markInternalNavigation()` call, the singleton registration, audio-resolution computeds). No routing/screen-branching logic remains in the script; the line count is fully accounted for by retained non-routing responsibilities and documentation, not incomplete extraction.
- A `markInternalNavigation()` seam (`skipNextGuard` flag in `router-guards.ts`) was added, not in the original DS: `useLearningSession`'s own internal transitions (batch finish, clear, exit-with-empty-batch) call `navigate()` too, and without this seam the guard couldn't distinguish them from user-initiated NavMenu clicks — every normal batch completion (quiz→results) would trip `isMidQuiz` and pop the "Leave this quiz?" confirm.
- Confirm-dialog copy branches on `recorder.isRecording.value` (two messages), which the DS's guard sketch didn't call out.
- Curation-as-source in `fromPhaseOf` and curation-as-target both bypass the guard's confirm/flush/finalize path entirely (preserving the pre-existing quirk that NavMenu's Curation tab never ran through `navTo` originally) — broader than the DS's single "redirect if `!curationMode`" gate, but verified against `router-guards.ts` as the intended, documented behavior.
- Verified 20260716: `vue-tsc --noEmit` clean, 109/109 tests passing.

---

### Phase 2: View Wrappers (EP44-PH02)

#### EP44-ST03: Create view wrappers in `src/views/` (incl. extracting `CurationLanding.vue`) *(Done)*

**Scope**: 10 thin view wrappers + one extracted curation-landing component
**Read List**: existing screen components in `src/components/` (`HomeDashboard`, `DeckSelector`, `QuizCard`, `BatchResults`, `DeckOverview`, `ReviewHub`, `ReviewSummary`, `CurateAudio`, `MarkAudio`), and `App.vue` lines 386–566 (current prop/event bindings to copy verbatim)

**Tasks**:

- [x] Extract `src/components/CurationLanding.vue` from App.vue's inline `curation-landing` markup (lines 428–443)
      **Acceptance Criteria**:
- [x] Component renders the same markup; emits `curate` and `mark` events
- [x] Create `src/views/` and one wrapper per route
      **Acceptance Criteria**:
- [x] `HomePage` → `HomeDashboard` (`reviewUnlocked`, `dueCount`, `badgeError`; `@learn`/`@review` → `router.push`)
- [x] `DeckSelectPage` → `DeckSelector` (`@select`/`@overview` → `router.push({ name, params: { deckId } })`; `@resume`/`@clear` → composable)
- [x] `QuizPage` → `QuizCard` (learning): reads `route.params.deckId`, wires `@answered`/`@exit` to `onAnswered`/`onExitBatch`
- [x] `ResultsPage` → `BatchResults`
- [x] `OverviewPage` → `DeckOverview`: reads `route.params.deckId`; `@start-quiz` → `initSession(deckId, false)`; `@back` → `router.push({ name: 'select' })`
- [x] `ReviewHubPage` → `ReviewHub`
- [x] `ReviewSessionPage` → renders `QuizCard` **or** `ReviewSummary` based on `reviewQuestion` being null; reads `route.query.mode` (`due|anytime`); wires `@answered` → `onReviewAnswered`, exit → `router.push({ name: 'review-hub' })`
- [x] `CurationLandingPage` → `CurationLanding` (`@curate`/`@mark` → `router.push`)
- [x] `CurateAudioPage` → `CurateAudio`; `MarkAudioPage` → `MarkAudio` (`@back` → `router.push({ name: 'curation' })`, `@uploaded`/`@committed` → refresh)
- [x] Views contain no business logic — composable reads + route params/query + `router.push` only
- [x] Each route renders its component with no type errors

**Implementation notes**:
- `QuizPage` and `ReviewSessionPage` both add an `onMounted` deep-link guard: if no batch/session has been started yet (a cold visit to the URL, not one reached via `DeckSelectPage`/`ReviewHubPage`), they call `initSession(deckId, false)` / `onReview()`-or-`onAnytimeReview()` (picked by `route.query.mode`, default `due`) respectively. When a batch is already active, mount does nothing — this only fires on true deep links.
- Test infra added as a prerequisite (none existed for component-level tests before this story): `@vue/test-utils` + `happy-dom` devDependencies, `@vitejs/plugin-vue` + `environment: 'happy-dom'` added to `vitest.config.ts`.
- Found and fixed a Vue 3 `<script setup>` auto-unref footgun in `QuizPage.vue`/`ReviewSessionPage.vue`: a top-level injected `Ref` (`currentQuestionAudio`/`reviewQuestionAudio`) is auto-unwrapped in the template, so an explicit `.value` double-unwraps and crashes when the value is `undefined`.
- 109 tests passing (26 in `src/views/__tests__` + `src/components/__tests__/CurationLanding.test.ts`), `vue-tsc --noEmit` clean.
- Known pre-existing issue, not fixed (out of scope — individual component refactoring is EP45+): `DeckOverview`'s nested `AudioPlayer`/`useSegmentPlayer` unconditionally calls `WaveSurfer.create()` on mount regardless of whether audio exists, producing benign network-connection noise under test.

---

### Phase 3: Integration & Docs (EP44-PH03) — follow-on

#### EP44-ST04: Manual navigation, history & deep-link verification

**Scope**: End-to-end behavior check (no automated e2e rewrite required)
**Read List**: `e2e/` (confirm selectors, not URLs, are asserted)

**Tasks**:

- [ ] Verify navigation, history, guards, deep-linking
      **Acceptance Criteria**:
- [ ] Home → Learn → Select → Quiz; NavMenu "Home" mid-quiz shows the confirm dialog; cancel stays, OK flushes batch then navigates
- [ ] Browser back after leaving quiz returns to the prior route (history preserved)
- [ ] Deep link `/learn/overview/:deckId` loads overview for that deck; `/review/session?mode=anytime` opens anytime review
- [ ] Recording active + cross-phase nav → `finalizeRecordingOnNav` runs; a `'failed'` result blocks navigation
- [ ] `env.curationMode=false` → `/curation*` redirects to `/`
- [ ] Existing e2e suite passes (selector-based, not URL-based); update only if DOM changed

---

#### EP44-ST05: Documentation

**Scope**: README routing section + RULES.md routing rule
**Read List**: `apps/srs-demo/README.md`, `apps/srs-demo/RULES.md`

**Tasks**:

- [ ] Document routing architecture
      **Acceptance Criteria**:
- [ ] README lists the 10 routes and their URLs/params
- [ ] Documents why session state stays in composables and how `navigate` injection replaced the `screen` ref
- [ ] RULES.md gains a routing best-practice note (navigate via named routes; views are thin adapters; guards own cross-phase side-effects)

---

## 6. Success Criteria

1. App.vue script ≤ ~80 lines (from 383); template ≤ ~40 lines (from 181); `screen` and `overviewDeckId` refs removed.
2. All 10 `Screen` states are reachable by their own URL; `router.getRoutes()` lists 10.
3. `useLearningSession` drives transitions via the injected `navigate` callback — no `screen` writes remain; `useReviewSession` unchanged.
4. Browser back/forward works; URLs are shareable/bookmarkable.
5. Deep linking works for `:deckId` routes and `?mode=` review sessions.
6. The `beforeEach` guard reproduces `navTo`: confirm-on-mid-quiz, `finishBatchAndTransition` flush, `finalizeRecordingOnNav`, and **nav abort on `'failed'`**.
7. `CurationLanding.vue` is a real component; curation routes gated by `env.curationMode`.
8. No state lost across route transitions (composables persist).
9. No TypeScript errors in `router.ts`, `App.vue`, or `src/views/*`.

---

## 7. Out of Scope (EP45+)

- Screen-component refactors from the audit (DeckOverview, QuizCard, MarkAudio oversizing; AudioPlayer `defineExpose`).
- Any state-management change beyond the `screen`→`navigate` dependency swap.
- Breadcrumbs, route-level analytics/permissions metadata.
- Server-side routing (Vite SPA fallback already serves all paths).

---

## 8. Divergences From the Withdrawn Draft (why this rewrite exists)

The prior DS01 was flawed against the real code:

| Prior claim | Reality |
| --- | --- |
| `screen` lived only in App.vue; "just add `<RouterView>`" | `screen` is injected into `useLearningSession`, which mutates it — requires the `navigate`-callback swap (ST02). |
| Composables `useReviewState`, `useDebugRecorder` | Do not exist. Real names: `useReviewSession`, `useDebugRecording` (a module singleton). |
| "9 routes" | 10 `Screen` values → 10 routes; `QuizCard` is shared by quiz + review; `ReviewSummary` is a sub-state, not a route. `BatchResults` (`results`) was omitted. |
| Curation is a routable screen | Curation landing is inline App.vue markup — must be extracted to `CurationLanding.vue` first. |
| Guard = "confirm leave quiz" + `finishBatch()` | Real guard = `crossesPhaseOrMidQuiz` → conditional `window.confirm` → `finishBatchAndTransition()` → `finalizeRecordingOnNav()` with **nav abort on failure**. |
| Deep-link recovery via broad localStorage hydration | Only `useLearningSession` uses localStorage (single `LAST_DECK_KEY`); boot hydration lives in App.vue `onMounted`. No URL reading exists today. |
