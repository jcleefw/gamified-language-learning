---
unit: apps/srs-demo
sources: [EP44]
updated: 2026-07-19
---

# srs-demo — Domain Knowledge

## Routing

- Navigation is handled by Vue Router 4. Every screen has its own URL, so routes
  are bookmarkable and shareable and the browser back/forward buttons work.
- There is one route per value of the `Screen` union (ten in total). Routes are
  lazy-loaded so each screen is code-split out of the initial bundle.
- Deck-scoped screens carry the deck identity in the path (`:deckId`); review
  sessions carry their mode (`due` / `anytime`) as a query param. Curation routes
  are gated — when curation mode is off the guard redirects them to home.
- Screen navigation goes through named routes. Session state stays in composables,
  never in route params — routing is an addressing layer over the existing state,
  not a state store.
- The learning-session composable does not own screen transitions. It receives a
  `navigate` callback and calls it; the router, not the composable, decides URLs.
- Cross-phase side effects live in a single global navigation guard, not in
  components: leaving a quiz mid-batch prompts for confirmation, flushes the
  partial batch, and finalizes any active debug recording — and navigation is
  aborted if finalization fails. The guard reaches the one live session instance
  through a module-level singleton, because it runs outside the component tree.

## App Shell

- `App.vue` is a layout shell: navigation menu, a router outlet, and an API-error
  banner. It no longer contains screen-branching logic.
- Views are thin adapters. Each reads its composables, pulls route params/query,
  and pushes routes — no business logic lives in the view layer.
- Boot-time hydration (deck fetch, word-pool build, config load, run-state
  restore, review-badge and shelved-word restore) is owned by a dedicated boot
  composable that the shell invokes once on mount.
- Debug-recording controls are a self-contained component, shown only when debug
  mode is enabled; it reports failures back to the shell for the shared error
  banner.
