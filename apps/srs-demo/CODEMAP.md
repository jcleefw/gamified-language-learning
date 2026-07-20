# apps/srs-demo CODEMAP

Package: `@gll/srs-demo`
Purpose: Vue 3 web app demonstrating the SRS learning engine. Quiz flow, deck
management, review sessions, and audio curation/marking for language learners.
Navigate to subfolder CODEMAPs for file-level detail.

---

## Root Files

| File | Purpose |
|---|---|
| `src/main.ts` | Vite/Vue entry point — `createApp(App).use(router).mount('#app')` |
| `src/App.vue` | Root layout shell (NOT a routing hub — see `src/router.ts`). Instantiates `useLearningSession`/`useReviewSession` once, registers the learning session into the router-guard singleton, `provide()`s shared state for views to `inject()`. Renders `NavMenu`, `DebugRecordingControls`, an error banner, and `<RouterView/>` |
| `src/env.ts` | The only place env flags should be read (RULES.md): `testHooks`, `debugMode`, `cheatMode`, `curationMode` from `import.meta.env.*` |
| `src/types.ts` | Local types: `ConfigType` (extends `SessionConfig` from `@gll/srs-engine/learn`). `Screen` union also lives here but appears unused — a likely leftover from pre-router `v-if`-based navigation |
| `index.html` | Vite HTML entry; mounts `#app`, loads `/src/main.ts` |
| `package.json` | Manifest. Scripts: `dev`, `build` (`vue-tsc --noEmit && vite build`), `typecheck`, `preview`, `e2e` (`bddgen test && playwright test`), `test`/`test:watch`. Deps: `@gll/api-contract`, `@gll/shared-utils`, `@gll/srs-engine` (workspace), `vue ^3.5`, `wavesurfer.js` |
| `vite.config.ts` | Vue plugin; dev-server proxy `/api` → `http://localhost:6060` (`@gll/server`) |
| `vitest.config.ts` | Test include `src/**/__tests__/**/*.test.ts`, `happy-dom` env, globals on |
| `playwright.config.ts` | `playwright-bdd` config (`features: e2e/features/**/*.feature`, `steps: e2e/steps/**/*.ts`); spins up server (port 6060) + app dev server (port 5174, `VITE_CHEAT_MODE`/`VITE_TEST_HOOKS`) `webServer`s |
| `tsconfig.json` | Extends root base config; ESNext/DOM/Vue JSX, bundler resolution, strict, `noEmit`; includes `src/**/*` |
| `.env.local.example` | Documents the 3 opt-in Vite env flags `src/env.ts` reads: `VITE_CHEAT_MODE`, `VITE_TEST_HOOKS`, `VITE_CURATION_MODE` |
| `RULES.md` | App conventions: env-flag access only via `env.ts`; SFC size/structure limits; routing rules (routes not `v-if` branches, guard logic in `router-guards.ts`, session state via composables/provide-inject not route params, never reintroduce a `screen` ref); file-org guide |
| `README.md` | App overview, quick start, content seeding, routing architecture table, "adding a route" howto |

---

## Routing (`src/`)

| File | Purpose |
|---|---|
| `router.ts` | Vue Router 4 instance (`createWebHistory`). 10 lazy-loaded routes matching `ROUTE_NAMES`: `home`, `select`, `quiz`, `results`, `overview`, `review-hub`, `review`, `curation`, `curate`, `mark`. Curation routes carry `meta: { curationOnly: true }`. Calls `registerNavigationGuard(router)` |
| `router-guards.ts` | `navTabOf(name)`, `markInternalNavigation()`, `registerNavigationGuard(router)` — the single `beforeEach`: gates curation-only routes on `env.curationMode`, shows a confirm dialog crossing Learning↔Review or leaving mid-quiz, flushes the in-progress batch, finalizes an active debug recording |
| `routeNames.ts` | `ROUTE_NAMES` constant (10 route-name strings) — split out to avoid a `router.ts` ↔ `router-guards.ts` import cycle |

---

## Subfolders

| Folder | Purpose | CODEMAP |
|---|---|---|
| `src/composables/` | State management and reusable logic as Vue composition functions | [CODEMAP](src/composables/CODEMAP.md) |
| `src/components/` | Presentational Vue SFCs | [CODEMAP](src/components/CODEMAP.md) |
| `src/views/` | Thin route-component wrappers — inject provided state, forward to a `components/` presentational component | [CODEMAP](src/views/CODEMAP.md) |
| `e2e/` | Playwright-BDD end-to-end tests | [CODEMAP](e2e/CODEMAP.md) |

---

## Integration Points

| Target | Used By | Purpose |
|---|---|---|
| `@gll/srs-engine/learn` | `useLearningSession`, `App.vue`, `DeckOverview.vue` | Quiz composition, adaptive session, batch queue |
| `@gll/srs-engine/shelving` | `useLearningSession`, `useShelving` | Shelving decision policy |
| `@gll/api-contract` | Most composables | Shared HTTP request/response type contracts |
| `@gll/shared-utils` | `useMarkerAuthoring`, `useSegmentPlayer` | WebVTT parse/build (`parseVtt`, `buildVtt`) |
| `wavesurfer.js` | `useSegmentPlayer`, `MarkAudio.vue` (regions plugin) | Waveform rendering + audio playback engine |

### Server endpoints in active use

`/api/decks`, `/api/state`, `/api/state/word`, `/api/answer`, `/api/reviews`,
`/api/reviews/anytime`, `/api/reviews/answer`, `/api/user/config`,
`/api/shelving`, `/api/shelving/apply`, `/api/shelving/unshelve-all`,
`/api/shelving/unshelve-word`, `/api/stagnation/update`,
`/api/stagnation/stagnant`, `/api/stagnation/reset`,
`/api/stagnation/reset-words`, `/api/test/config/shelving`,
`/api/test/config/sentence`, `/api/curation/decks/:id/audio`,
`/api/curation/decks/:id/audio/vtt`, `/api/debug/transitions`,
`/api/debug/transitions-recent`.

---

## Test Locations

Tests are in `src/**/__tests__/` (unit/component, vitest) and `e2e/` (BDD,
Playwright) — excluded from CODEMAP per code-map-guide, except `e2e/`'s
non-generated subfolders (`features/`, `fixtures/`, `steps/`), which are
hand-authored source and documented in [e2e/CODEMAP.md](e2e/CODEMAP.md).
`.features-gen/` is `playwright-bdd`-compiled output — excluded as build
output.
