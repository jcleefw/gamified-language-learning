# EP24 - Vue SRS Demo App

**Created**: 20260511T222121Z
**Status**: Draft

**Type**: Epic Plan
**Depends on**: EP20, EP21
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The SRS engine v2 is a pure-function library with no visual interface. Developers and stakeholders have no way to see the quiz loop in action without running the terminal demo. A minimal Vue 3 webapp would make the engine's behaviour immediately observable in a browser, with session state persisted across reloads.

## Scope

**In scope**:
- Vite + Vue 3 + TypeScript app at `apps/srs-demo/`
- Deck selection screen using mock data from `@gll/srs-engine-v2`
- Single-question quiz card (prompt + 4 choices)
- Batch results screen (mastery table per word)
- Full adaptive quiz loop: `composeBatchMulti` → answer → `updateMasteryState` → `nextActivePool`
- localStorage persistence via `useSession` composable (Map/Set serialisation)
- Resume on reload; clear session button

**Out of scope**:
- Backend / API server
- Real language data (uses engine's mock data only)
- Styling framework (plain CSS)
- Routing library
- Authentication

---

## Stories

### EP24-ST01: Scaffold `apps/srs-demo` Vite + Vue 3 app

**Scope**: Create `apps/srs-demo/` with `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, and workspace reference to `@gll/srs-engine-v2`.

### EP24-ST02: `useSession` composable — localStorage persistence

**Scope**: Serialise/deserialise `RunState` (Map), `recheckPending`/`recheckReentered` (Sets), `activeItems`, `queue`, and `deckId` to/from localStorage.

### EP24-ST03: `DeckSelector.vue` — deck selection + session resume

**Scope**: List available mock decks; detect existing saved session and offer resume or start-fresh.

### EP24-ST04: `QuizCard.vue` — single question display

**Scope**: Render `QuizQuestion` prompt and four labelled choices; emit `answered` with `QuizResult` on selection.

### EP24-ST05: `BatchResults.vue` — post-batch mastery table

**Scope**: Display per-word stats (seen / correct / mastery / streaks) from `RunState`; "Next Batch" button.

### EP24-ST06: `App.vue` — screen controller + quiz loop

**Scope**: Wire all engine calls (`composeBatchMulti`, `updateMasteryState`, `nextActivePool`) and screen transitions; save session after each batch.

---

## Overall Acceptance Criteria

- [ ] Selecting a deck and answering one full batch of questions works end-to-end in the browser
- [ ] Reloading the page resumes the session at the start of the next batch (deck + pool + mastery state intact)
- [ ] Mastered words no longer appear in subsequent batches
- [ ] New words enter the active pool from the queue once slots free up
- [ ] "Clear session" resets to deck selection
- [ ] No TypeScript errors (`tsc --noEmit` passes)

---

## Dependencies

- EP20 `@gll/srs-engine-v2` — engine package (built, published to workspace)
- EP21 — revision phase complete (stable public API)

## Next Steps

1. Review and approve plan
2. Begin implementation story by story
