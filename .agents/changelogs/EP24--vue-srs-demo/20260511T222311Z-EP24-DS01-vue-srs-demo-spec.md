# EP24-DS01: Vue SRS Demo App Specification

**Date**: 20260511T222311Z
**Status**: Draft
**Epic**: [EP24 - Vue SRS Demo App](../../plans/epics/EP24-vue-srs-demo.md)

---

## 1. Feature Overview

A Vite + Vue 3 + TypeScript single-page app at `apps/srs-demo/` that runs the `@gll/srs-engine-v2` quiz loop entirely in the browser. No server. Session state (RunState, active pool, queue) is serialised to localStorage so the user can resume where they left off on reload.

Three screens rendered by `App.vue` based on a `screen` ref: `'select'` → `'quiz'` → `'results'` → `'quiz'` (loop).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Framework | Vue 3 Composition API + `<script setup>` | Modern, minimal boilerplate |
| Build tool | Vite | Standard for Vue 3; fast HMR |
| Engine source | `@gll/srs-engine-v2` workspace package | No server needed; pure functions |
| Data | Mock data from engine package (`mock-consonants`, `mock-vowels`, `mock-words`, `mock-decks`) | Sufficient for demo |
| Persistence | `localStorage` via `useSession` composable | Simple; survives reload |
| Styling | Plain CSS in `<style scoped>` | No framework dependency |
| State management | `ref`/`reactive` in `App.vue` only | No Pinia/Vuex needed at this scope |
| TypeScript | Strict, no `any` | Consistent with monorepo conventions |

## 3. Data Structures

```typescript
// What gets written to localStorage
interface PersistedSession {
  deckId: string
  activeItems: QuizItem[]
  queue: QuizItem[]
  runState: [string, WordState][]   // Map → Array<[key, value]>
  recheckPending: string[]          // Set → Array
  recheckReentered: string[]        // Set → Array
}

// App.vue reactive state
interface AppState {
  screen: 'select' | 'quiz' | 'results'
  deckId: string | null
  activeItems: QuizItem[]
  queue: QuizItem[]
  runState: RunState                // Map<string, WordState>
  recheckPending: Set<string>
  recheckReentered: Set<string>
  // transient (not persisted)
  questions: QuizQuestion[]
  currentIndex: number
  answers: QuizResult[]
}

// BatchResults receives this
interface BatchSummary {
  wordId: string
  seen: number
  correct: number
  mastery: number
  correctStreak: number
  wrongStreak: number
}
```

## 4. User Workflows

```
LOAD PAGE
  ↓
loadSession() → session found?
  ├─ YES → hydrate AppState → screen = 'quiz' → composeBatch
  └─ NO  → screen = 'select'

DECK SELECT screen
  └─ Pick deck → init pool via nextActivePool → screen = 'quiz' → composeBatch

QUIZ screen (one question at a time)
  composeBatchMulti(activeItems, wordPool, { questionLimit: 8 })
  ↓
  QuizCard renders question[currentIndex]
  ↓
  User picks choice → answers.push(QuizResult) → currentIndex++
  ↓
  currentIndex === questions.length?
  ├─ NO  → render next QuizCard
  └─ YES → updateMasteryState → nextActivePool → saveSession → screen = 'results'

RESULTS screen
  BatchResults shows mastery table
  ↓
  "Next Batch" → composeBatch → screen = 'quiz'

CLEAR SESSION (button in DeckSelector header)
  clearSession() → reset AppState → screen = 'select'
```

## 5. Stories

### EP24-ST01: Scaffold `apps/srs-demo` Vite + Vue 3 app

**Scope**: Package scaffold only — no business logic
**Read List**: `package.json` (root), `pnpm-workspace.yaml`, `turbo.json`, any existing `apps/` package for reference
**Tasks**:

- [ ] Create `apps/srs-demo/package.json` with `vue`, `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc` deps and workspace ref to `@gll/srs-engine-v2`
- [ ] Create `apps/srs-demo/vite.config.ts`
- [ ] Create `apps/srs-demo/tsconfig.json` extending root config
- [ ] Create `apps/srs-demo/index.html` with `<div id="app">` mount point
- [ ] Create `apps/srs-demo/src/main.ts` mounting `App.vue`
- [ ] Create stub `apps/srs-demo/src/App.vue` (renders "SRS Demo" text)
- [ ] Verify `pnpm install` resolves and `pnpm --filter srs-demo dev` starts without errors

      **Acceptance Criteria**:
- [ ] `pnpm --filter srs-demo dev` serves the app on localhost
- [ ] `@gll/srs-engine-v2` types resolve in the app

### EP24-ST02: `useSession` composable — localStorage persistence

**Scope**: Serialisation/deserialisation only — no Vue reactivity wiring
**Read List**: `packages/srs-engine-v2/src/types/word-state.ts`, `packages/srs-engine-v2/src/types/foundational.ts`, `packages/srs-engine-v2/src/index.ts`
**Tasks**:

- [ ] Create `src/composables/useSession.ts`
- [ ] Implement `saveSession(state: PersistedSession): void` — serialise Map/Set to arrays, write to `localStorage`
- [ ] Implement `loadSession(): PersistedSession | null` — parse and validate, return `null` on missing/corrupt
- [ ] Implement `clearSession(): void`

      **Acceptance Criteria**:
- [ ] Round-trip: save then load returns identical `RunState` Map and `recheckPending` Set values
- [ ] `loadSession()` returns `null` when localStorage is empty
- [ ] `loadSession()` returns `null` (no throw) when stored JSON is malformed

### EP24-ST03: `DeckSelector.vue` — deck selection + session resume

**Scope**: UI for deck pick and session resume/clear — no engine calls
**Read List**: `packages/srs-engine-v2/data/mock/mock-decks.ts`, `packages/srs-engine-v2/src/types/deck.ts`
**Tasks**:

- [ ] Create `src/components/DeckSelector.vue`
- [ ] Render list of available mock decks (name + word count)
- [ ] Emit `select(deckId: string)` on deck click
- [ ] Show "Resume session" banner with deck name when saved session exists; emit `resume`
- [ ] Show "Clear session" button; emit `clear`

      **Acceptance Criteria**:
- [ ] All mock decks are listed
- [ ] Clicking a deck emits `select` with correct `deckId`
- [ ] Banner appears only when `loadSession()` returns non-null
- [ ] "Clear session" emits `clear`

### EP24-ST04: `QuizCard.vue` — single question display

**Scope**: Stateless presentation component — receives one `QuizQuestion`, emits one answer
**Read List**: `packages/srs-engine-v2/src/types/quiz.ts`
**Tasks**:

- [ ] Create `src/components/QuizCard.vue`
- [ ] Accept prop `question: QuizQuestion`
- [ ] Render `question.prompt` as heading
- [ ] Render four choice buttons labelled `a`–`d` with choice value text
- [ ] On choice click: emit `answered` with `{ wordId: question.wordId, correct: choice.isCorrect }`
- [ ] Disable all buttons after answer is selected (visual feedback before parent advances)

      **Acceptance Criteria**:
- [ ] Correct choice emits `answered` with `correct: true`
- [ ] Wrong choice emits `answered` with `correct: false`
- [ ] Buttons are disabled after selection
- [ ] Component is stateless — re-renders cleanly when `question` prop changes

### EP24-ST05: `BatchResults.vue` — post-batch mastery table

**Scope**: Read-only results display — no engine calls
**Read List**: `packages/srs-engine-v2/src/types/word-state.ts`
**Tasks**:

- [ ] Create `src/components/BatchResults.vue`
- [ ] Accept prop `summary: BatchSummary[]`
- [ ] Accept prop `batchScore: { correct: number; total: number }`
- [ ] Render score header (e.g. "6 / 8 correct")
- [ ] Render table: word ID | seen | correct | mastery | streak
- [ ] Render "Next Batch" button; emit `next`

      **Acceptance Criteria**:
- [ ] Score header reflects `batchScore` values
- [ ] Table row count equals `summary.length`
- [ ] "Next Batch" emits `next`

### EP24-ST06: `App.vue` — screen controller + quiz loop

**Scope**: Wire all engine calls and screen transitions; call `saveSession` after each batch
**Read List**:
- `packages/srs-engine-v2/src/index.ts`
- `packages/srs-engine-v2/data/mock/mock-decks.ts`
- `packages/srs-engine-v2/data/mock/mock-words.ts`
- `packages/srs-engine-v2/data/mock/mock-consonants.ts`
- `packages/srs-engine-v2/data/mock/mock-word-pool.ts`
- `packages/srs-engine-v2/demo/config.ts`
- `src/composables/useSession.ts`
**Tasks**:

- [ ] Declare all `AppState` refs
- [ ] On `onMounted`: call `loadSession()`; if found, hydrate state and call `startBatch()`; else `screen = 'select'`
- [ ] Handle `DeckSelector` `select` event: init `activeItems`/`queue` via `nextActivePool`, call `startBatch()`
- [ ] Handle `DeckSelector` `resume` event: hydrate from saved session, call `startBatch()`
- [ ] Handle `DeckSelector` `clear` event: call `clearSession()`, reset state
- [ ] `startBatch()`: call `composeBatchMulti`, set `questions`, reset `currentIndex` and `answers`, set `screen = 'quiz'`
- [ ] Handle `QuizCard` `answered` event: push to `answers`, advance `currentIndex`; when batch complete call `finishBatch()`
- [ ] `finishBatch()`: call `updateMasteryState`, `nextActivePool`, `saveSession`, compute `summary`, set `screen = 'results'`
- [ ] Handle `BatchResults` `next` event: call `startBatch()`
- [ ] Render correct component per `screen` value

      **Acceptance Criteria**:
- [ ] Full loop works end-to-end (select → quiz 8 questions → results → next batch)
- [ ] Page reload resumes at start of next batch with correct mastery state
- [ ] Mastered words do not reappear in subsequent batches
- [ ] No TypeScript errors (`vue-tsc --noEmit`)

## 6. Success Criteria

1. `pnpm --filter srs-demo dev` serves a working quiz loop in the browser
2. Reload resumes session from localStorage with intact mastery state
3. `vue-tsc --noEmit` passes with zero errors
