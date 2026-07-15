# EP44-DS01: App Router Setup & Navigation Refactor Specification

**Date**: 20260715T224014Z
**Status**: Draft
**Epic**: [EP44 - App.vue Router Refactor](../../plans/epics/EP44-app-vue-router-refactor.md)

**Architecture**:
- Vue Router 4: Client-side routing with lazy-loaded page components
- Route guards: mid-quiz confirmation, recording finalization on cross-phase nav
- App.vue shrinks from 687 lines to ~60 lines (layout + nav + error display only)
- State remains in composables (`useLearningSession`, `useReviewSession`, `useReviewState`) — no routing-driven state
- Each screen gets a routable URL; browser history and bookmarking work

---

## 1. Feature Overview

App.vue is a 687-line monolith mixing session orchestration (384 lines of script) with manual screen routing via nested v-if statements (182 lines of template). This creates:
- Non-shareable URLs (everything is `/`) — can't bookmark or deep-link
- Broken browser history — back button doesn't work
- Unmaintainable code — 3× the recommended 120-line component size

**This DS introduces Vue Router 4** to declaratively map URLs to route components. App.vue becomes a thin layout wrapper (~60 lines); session state remains in composables (no change to state management). Each screen gets its own URL, enabling shareable links, browser history, and deep-linking.

**The refactor has three phases** (ST01–ST05), scoped here in Phase 1 (Router Setup) and Phase 2 (View Stubs):
- **Phase 1 (ST01–ST02)**: Router install, route definitions, App.vue refactor with guards
- **Phase 2 (ST03)**: View component stubs (thin wrappers for existing screens)
- **Phase 3 (ST04–ST05)**: Integration testing and documentation (follow-on DS02 if needed)

**What does NOT change**: State management (composables stay the same), existing screen components, data flow, E2E test expectations (to be updated in Phase 3).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Router library | Vue Router 4 (npm) | Official Vue routing, lazy loading, type-safe named routes |
| Route definitions | Single `src/router.ts` file with all 9 routes | Clarity; all routes visible in one place; no fragmentation |
| App.vue refactor | Remove `screen` ref + v-if branches; add `<RouterView />` | Decouples routing from orchestration; each route owns its component |
| View components | Stubs in `src/views/` that import + forward props to screen components | Adapters between router (param-driven) and legacy screens (prop-driven) |
| Navigation | `router.push({ name, params?, query? })` in composables/components | Type-safe, named routes; composables don't know router internals |
| Route guards | `router.beforeEach` to confirm mid-quiz leave + finalize recording | Prevents accidental session loss |
| Lazy loading | `() => import('./views/PageName.vue')` for each route | Keeps initial bundle small; pages load on-demand |
| Session state | Remains in composables across route changes | State persistence is a composable concern, not router's |
| Deep linking | App hydrates composables on mount from localStorage or query params | Returning users recover where they were |
| Silent errors | No router metadata, no extra validation — let composables handle state validation | Router only maps URLs → components; composables validate state |

---

## 3. Data Structures

```typescript
// ── src/router.ts ─────────────────────────────────────────────────────
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// Route names (optional enum for type safety)
export const ROUTE_NAMES = {
  HOME: 'home',
  DECK_SELECT: 'deckSelect',
  QUIZ: 'quiz',
  OVERVIEW: 'overview',
  REVIEW_HUB: 'reviewHub',
  REVIEW_SESSION: 'reviewSession', // Query param: ?mode=due|anytime
  CURATION_LANDING: 'curationLanding',
  CURATE_AUDIO: 'curateAudio',
  MARK_AUDIO: 'markAudio',
} as const

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('./views/HomePage.vue'),
  },
  {
    path: '/learn/select',
    name: ROUTE_NAMES.DECK_SELECT,
    component: () => import('./views/DeckSelectPage.vue'),
  },
  {
    path: '/learn/quiz/:deckId',
    name: ROUTE_NAMES.QUIZ,
    component: () => import('./views/QuizPage.vue'),
  },
  {
    path: '/learn/overview/:deckId',
    name: ROUTE_NAMES.OVERVIEW,
    component: () => import('./views/OverviewPage.vue'),
  },
  {
    path: '/review',
    name: ROUTE_NAMES.REVIEW_HUB,
    component: () => import('./views/ReviewHubPage.vue'),
  },
  {
    path: '/review/session',
    name: ROUTE_NAMES.REVIEW_SESSION_DUE, // Reused; mode is in query param
    component: () => import('./views/ReviewSessionPage.vue'),
  },
  {
    path: '/curation',
    name: ROUTE_NAMES.CURATION_LANDING,
    component: () => import('./views/CurationLandingPage.vue'),
  },
  {
    path: '/curation/curate',
    name: ROUTE_NAMES.CURATE_AUDIO,
    component: () => import('./views/CurateAudioPage.vue'),
  },
  {
    path: '/curation/mark',
    name: ROUTE_NAMES.MARK_AUDIO,
    component: () => import('./views/MarkAudioPage.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// ── Navigation Guard (in router.ts or App.vue) ─────────────────────────
router.beforeEach(async (to, from) => {
  const { batch, finishBatch } = useLearningSession()
  
  // If leaving quiz mid-batch, confirm + finalize
  const isMidQuiz = from.name === ROUTE_NAMES.QUIZ && to.name !== ROUTE_NAMES.QUIZ
  if (isMidQuiz && batch.value?.in_progress) {
    const confirmed = window.confirm(
      'You are in the middle of a quiz. Leave and finish this batch?'
    )
    if (!confirmed) {
      return false // Cancel navigation
    }
    await finishBatch() // Finalize before navigating
  }
  
  return true // Allow navigation
})

// ── View Component Type (all views implement this pattern)
// apps/srs-demo/src/views/HomePage.vue (template)
// <template>
//   <HomeDashboard
//     :review-unlocked="reviewUnlocked"
//     :due-count="dueReviewCount"
//     @learn="navigateToLearn"
//     @review="navigateToReview"
//   />
// </template>
//
// apps/srs-demo/src/views/HomePage.vue (script)
// <script setup lang="ts">
// import { useRouter } from 'vue-router'
// import HomeDashboard from '@/components/HomeDashboard.vue'
// import { useReviewSession } from '@/composables/useReviewSession'
// import { useLearningSession } from '@/composables/useLearningSession'
//
// const router = useRouter()
// const { dueReviewCount, reviewUnlocked } = useReviewSession()
// const { screen } = useLearningSession()
//
// const navigateToLearn = () => router.push({ name: 'deckSelect' })
// const navigateToReview = () => router.push({ name: 'reviewHub' })
// </script>
```

---

## 4. User Workflows

```
User opens app
  ↓
App hydrates composables (from localStorage or URL params)
  ↓
Router initializes; loads current route or defaults to /
  ↓
View component mounts; reads composable state; renders screen
  ↓
User clicks "Select Deck" button
  ↓
Event handler calls router.push({ name: 'quiz', params: { deckId } })
  ↓
Router beforeEach guard runs (no mid-quiz, so allow)
  ↓
Route changes from /learn/select → /learn/quiz/:deckId
  ↓
QuizPage.vue mounts; reads useLearningSession()
  ↓
User is in quiz state; can answer questions
  ↓
User clicks back button in browser
  ↓
Router navigates back to /learn/select
  ↓
DeckSelectPage.vue mounts; composable still has user's history
  ↓
User sees where they left off

---

User is mid-quiz and clicks navbar "Home" button
  ↓
Navigation handler calls router.push({ name: 'home' })
  ↓
Router beforeEach guard intercepts
  ↓
Guard detects from.name === 'quiz' && batch.in_progress
  ↓
Guard shows confirmation dialog: "Leave quiz?"
  ↓
If user clicks "Cancel": navigation is blocked (return false)
  ↓
If user clicks "OK": guard calls finishBatch() to save state
  ↓
Router allows navigation → / (HomePage)
  ↓
HomePage.vue mounts; quiz session has been finalized
```

---

## 5. Stories

### Phase 1: Router Setup (EP44-PH01)

#### EP44-ST01: Install Vue Router 4 & scaffold src/router.ts

**Scope**: Dependency installation + route definitions  
**Read List**: `package.json`, `src/main.ts` (app bootstrap), existing App.vue screen list

**Tasks**:

- [ ] Install Vue Router 4
      **Acceptance Criteria**:
      - [ ] `npm install vue-router@4` succeeds; `package.json` updated
      - [ ] `package-lock.json` updated (committed)

- [ ] Create `src/router.ts`
      **Acceptance Criteria**:
      - [ ] File exists with all 9 routes defined (see Data Structures above)
      - [ ] Each route uses lazy loading: `() => import('./views/...')`
      - [ ] Routes have proper `name` and `path` (use `ROUTE_NAMES` enum)
      - [ ] Router instance created with `createRouter` + `createWebHistory`
      - [ ] Router exported for use in `main.ts`

- [ ] Import router in `src/main.ts` and add to app
      **Acceptance Criteria**:
      - [ ] `app.use(router)` called before `app.mount()`
      - [ ] App mounts successfully (no console errors)
      - [ ] Routes load in dev console: `router.getRoutes()` lists all 9

- [ ] Verify route structure in dev
      **Acceptance Criteria**:
      - [ ] Browser dev console: `router.getRoutes()` returns all 9 routes with correct names/paths
      - [ ] No TypeScript errors in `src/router.ts`

**Read List for implementer**: `src/main.ts`, `App.vue` (line 1–50 to see current screens), `package.json`

---

#### EP44-ST02: Refactor App.vue to use RouterView & add guards

**Scope**: App.vue script + template refactor; navigation guard wiring  
**Read List**: `src/App.vue` (entire), `src/composables/useLearningSession.ts`, `src/composables/useReviewSession.ts`

**Tasks**:

- [ ] Replace manual `screen` routing with RouterView
      **Acceptance Criteria**:
      - [ ] `screen` ref removed
      - [ ] All 11 nested v-if branches removed from template
      - [ ] `<RouterView />` added in place of conditional screens
      - [ ] App.vue template is <40 lines (was 182)
      - [ ] NavMenu component stays (unchanged)

- [ ] Update App.vue script to use router instead of screen state
      **Acceptance Criteria**:
      - [ ] `import { useRouter } from 'vue-router'`
      - [ ] Remove all `screen.value = '...'` statements
      - [ ] Replace navigation with `router.push({ name, params?, query? })`
      - [ ] Session state still lives in composables (no change to `useLearningSession`, etc.)
      - [ ] App.vue script is ~60 lines (was 384)

- [ ] Add route guard for mid-quiz confirmation
      **Acceptance Criteria**:
      - [ ] `router.beforeEach` hook added
      - [ ] Detects: leaving quiz mid-batch → shows confirmation dialog
      - [ ] If user cancels: navigation is blocked
      - [ ] If user confirms: `finishBatch()` called; navigation proceeds
      - [ ] Confirmation only shows when mid-quiz (batch.in_progress === true)

- [ ] Add route guard for recording finalization
      **Acceptance Criteria**:
      - [ ] Guard checks if `debugRecorder.isRecording()` before cross-phase nav
      - [ ] If recording active: guard calls `finishDebugRecording()` before allowing nav
      - [ ] (Optional: show a silent toast or log)

- [ ] Test App.vue renders correctly
      **Acceptance Criteria**:
      - [ ] App mounts without errors (dev console clean)
      - [ ] NavMenu renders
      - [ ] RouterView renders (currently empty because view stubs don't exist yet)
      - [ ] No console type errors

**Read List for implementer**: `src/App.vue` (entire), `src/composables/useLearningSession.ts` (finishBatch, batch), `src/composables/useDebugRecorder.ts` (if exists)

---

### Phase 2: View Component Stubs (EP44-PH02)

#### EP44-ST03: Create view component stubs in `src/views/`

**Scope**: 9 view component stubs (thin adapters)  
**Read List**: Existing screen components (`src/components/HomeDashboard.vue`, etc.), App.vue (see how props are passed)

**Tasks**:

- [ ] Create `src/views/` directory
      **Acceptance Criteria**:
      - [ ] Directory exists

- [ ] Create HomePage.vue stub
      **Acceptance Criteria**:
      - [ ] Imports `HomeDashboard` from `@/components`
      - [ ] Wraps `HomeDashboard` with correct props from composables
      - [ ] Navigation calls `router.push()` (no prop drilling)
      - [ ] Example: `@learn="router.push(...)"` forwarded to `HomeDashboard` as `@learn`

- [ ] Create DeckSelectPage.vue stub
      **Acceptance Criteria**:
      - [ ] Imports `DeckSelect` component
      - [ ] Reads from `useLearningSession()` (available decks, etc.)
      - [ ] Forwards @select to `router.push({ name: 'quiz', params: { deckId } })`

- [ ] Create QuizPage.vue stub
      **Acceptance Criteria**:
      - [ ] Imports `QuizCard` component
      - [ ] Reads `:deckId` from route params: `useRoute().params.deckId`
      - [ ] Loads quiz session for that deckId
      - [ ] Forwards @finish, @skip, etc. to navigation events

- [ ] Create OverviewPage.vue stub
      **Acceptance Criteria**:
      - [ ] Similar to QuizPage (deck-based route)
      - [ ] Imports DeckOverview component
      - [ ] Reads `:deckId` from route params

- [ ] Create ReviewHubPage.vue stub
      **Acceptance Criteria**:
      - [ ] Imports ReviewHub component
      - [ ] Reads from `useReviewSession()`
      - [ ] Forwards @review-due, @review-anytime to router.push

- [ ] Create ReviewSessionPage.vue stub (shared by both `/review/session?mode=due` and `/review/session?mode=anytime` routes)
      **Acceptance Criteria**:
      - [ ] Imports ReviewSession component
      - [ ] Reads review mode from query param: `useRoute().query.mode` (due|anytime)
      - [ ] Initializes review session with correct mode
      - [ ] Forwards @finish to router.push({ name: 'reviewHub' })

- [ ] Create CurationLandingPage.vue, CurateAudioPage.vue, MarkAudioPage.vue stubs
      **Acceptance Criteria**:
      - [ ] All three created with minimal props/event forwarding
      - [ ] No business logic; purely adapters

- [ ] Test view stubs render
      **Acceptance Criteria**:
      - [ ] Navigate to each route in browser (manually or via router.push)
      - [ ] Each view renders its wrapped screen component
      - [ ] No TypeScript errors in view files

**Read List for implementer**: Existing screen components, App.vue (template section showing current prop/event usage)

---

## 6. Success Criteria

1. [ ] App.vue script is ~60 lines (was 384); template is <40 lines (was 182)
2. [ ] All 9 screens routable via their own URLs (/, /learn/select, /learn/quiz/:deckId, etc.)
3. [ ] Browser back button works; navigation stack is preserved
4. [ ] Deep linking works: paste `/learn/quiz/deck1` into address bar → app loads quiz state
5. [ ] Mid-quiz confirmation dialog shown when navigating away from quiz
6. [ ] Recording is finalized on cross-phase navigation (no lost debug traces)
7. [ ] URLs are shareable (no more everything-is-/)
8. [ ] State is NOT lost during route transitions (composables persist; no re-initialization)
9. [ ] No TypeScript errors in App.vue, src/router.ts, or view stubs
10. [ ] Manual smoke test: Home → Learn → Select → Quiz → navigate away + confirm → Home (all works)

---

## 7. Out of Scope (Deferred to EP45+)

- Individual screen component refactoring (oversizing, prop drilling, logic extraction)
- State management changes (composables stay as-is)
- E2E test updates (deferred to ST04)
- Breadcrumb navigation in navbar
- Route metadata enrichment (analytics, permissions, etc.)
- Server-side routing configuration (Vite SPA fallback already handles this)

---

## 8. Implementation Notes

### Lazy Loading Pattern

Every route uses `() => import(...)` to code-split by page:

```ts
{
  path: '/learn/quiz/:deckId',
  name: 'quiz',
  component: () => import('./views/QuizPage.vue'),  // Lazy loaded
}
```

This keeps the initial bundle small; each page's JS loads on-demand when the route is visited.

### Route Params vs. Query Params

- **`:deckId` (param)**: Required for route matching; part of the path (`/learn/quiz/deck1`)
- **`?mode=due` (query)**: Optional; doesn't affect route matching; used for metadata (e.g., review mode)

The design uses `:deckId` for quiz/overview routes and query params for review mode (`/review/session?mode=due` vs. `/review/session?mode=anytime`).

### Why Session State Stays in Composables

State is **not moved into router** because:
1. **Persistence**: Session state (quiz progress, shelved words, etc.) survives route changes if it lives in composables
2. **Hydration**: On deep-link or refresh, composables can restore state from localStorage without needing URL params
3. **Simplicity**: Router is a URL → component mapper; session logic is orthogonal

### View Stub Pattern

Each view stub is a thin adapter:
```vue
<template>
  <ScreenComponent :prop="composableValue" @event="handleEvent" />
</template>
<script setup>
const router = useRouter()
const { prop } = useComposable()
const handleEvent = () => router.push(...)
</script>
```

No business logic in views; they're **connectors** between the router and existing screens.

### Error Recovery (Deep Linking)

If a user pastes `/learn/quiz/deck1` directly:
1. Router matches route to QuizPage component
2. QuizPage mounts; calls `useLearningSession()`
3. `useLearningSession()` restores state from localStorage (or initializes empty)
4. Quiz loads with recovered or fresh state

The composable **handles hydration**, not the router.

---

## 9. Verification Steps (for implementer)

1. **Install & bootstrap**:
   ```bash
   npm install vue-router@4
   npm run dev
   ```
   No console errors; app mounts.

2. **Route structure**:
   ```js
   // In browser console:
   router.getRoutes().map(r => `${r.name}: ${r.path}`)
   ```
   All 9 routes listed with correct names/paths.

3. **Navigation (manual)**:
   - Start app at `/` (HomePage)
   - Click "Learn" button → `/learn/select` (DeckSelectPage)
   - Click deck → `/learn/quiz/:deckId` (QuizPage)
   - Click "Home" navbar → confirmation dialog appears
   - Click "OK" → navigates to `/` (HomePage)
   - Browser back button → `/learn/quiz/:deckId` (history preserved)

4. **Deep linking**:
   - Paste `http://localhost:5173/learn/quiz/deck1` into address bar
   - App loads quiz state (recovered from localStorage or freshly initialized)
   - No errors.

5. **Code size**:
   - App.vue script: count lines → should be ~60 (was 384)
   - App.vue template: count lines → should be <40 (was 182)

---

## 10. Related Decisions (ADRs)

- **Routing Architecture**: Vue Router 4, lazy loading, composable-driven state (no routing state)
- **State Persistence**: Composables own state; deep-link recovery via localStorage (see EP26 or existing seeding pattern)
- **Navigation Guards**: Confirmation dialogs for mid-quiz, finalization on cross-phase nav

---

## 11. Open Questions

- Do E2E tests currently exist?
  - **Decision**: Keep existing e2e tests. They test business logic (shelving, mastery, batch composition), not routing, so they'll work fine after refactor. Step implementations may need minor updates in ST04 if DOM selectors changed.

---

## 12. Changelog Entry

When this DS is implemented, create a CHANGELOG entry:

```markdown
### EP44-DS01: Router Setup & App.vue Refactor

**Shipped**: {DATE}

- ✅ Vue Router 4 installed; `src/router.ts` created with 9 routes
- ✅ App.vue refactored: script 384 → 60 lines; template 182 → <40 lines
- ✅ View stubs created in `src/views/` (9 adapters for existing screens)
- ✅ Navigation guards: mid-quiz confirmation + recording finalization
- ✅ Lazy loading enabled for all routes (code-split per page)
- ✅ URLs now shareable; browser history works; deep-linking recovers state
- ✅ State remains in composables (no routing-driven state)
```

When complete, mark all story tasks as **Done** in this DS and tag it as `(Shipped)`.
