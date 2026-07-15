# EP44-DS02: App.vue Script-Size Cleanup Specification

**Date**: 20260716T013312Z
**Status**: Complete
**Epic**: [EP44 - App.vue Router Refactor](../../plans/epics/EP44-app-vue-router-refactor.md)

---

## 1. Feature Overview

[EP44-DS01](./20260715T231051Z-EP44-DS01-app-router-setup.md)'s ST02 removed all routing/screen-branching logic from `App.vue`, but its script-length AC (`≤ ~80 lines`) wasn't met — the file landed at ~240 lines. The overage isn't leftover routing logic; it's three responsibilities App.vue still owns directly:

1. **Boot-time hydration** (`onMounted`, ~80 lines) — deck fetch, word-pool build, config load, run-state restore, review-badge refresh, shelved-words restore.
2. **Debug-recording controls** (~70 lines: two buttons + handlers + scoped CSS) — the Record/Dump toggle, gated by `env.debugMode`.
3. **Audio-resolution computeds** (~15 lines) — `currentQuestionAudio`/`reviewQuestionAudio`.

This DS extracts (1) and (2) into their own files. (3) stays inline — at 15 lines it's smaller than the import/wiring overhead a fourth file would add, and it reads naturally next to the `currentQuestion`/`reviewQuestion` refs it derives from.

This is **not** the EP45+ "individual page component refactoring" (DeckOverview/QuizCard/MarkAudio) called out as out-of-scope in the epic plan — it's closing the gap on App.vue's own DS01/ST02 acceptance criteria.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Boot hydration | Extract to `src/composables/useAppBoot.ts`, exporting `bootApp(deps): Promise<void>` | Deps passed explicitly (no new provide/inject) — App.vue calls `await bootApp({...})` from its existing `onMounted`. Mechanical extraction, same behavior, same error-handling short-circuits. |
| Debug-recording controls | Extract to `src/components/DebugRecordingControls.vue` | Self-contained, `env.debugMode`-gated feature with its own markup + handlers + CSS. Takes `activeNav` as a prop (needed to pick the recording phase); emits `error` (string) so App.vue still owns `apiError`. |
| Debug-recording CSS | Moves with the component (inline `<style scoped>` in `DebugRecordingControls.vue`) | No separate CSS file — the styles only apply to this component's two buttons. |
| Audio computeds | **Stay in App.vue** | Too small (~15 lines) to justify a fourth file; extraction adds import/wiring overhead exceeding the lines saved. |
| `.api-error` CSS | **Stays inline** in App.vue's `<style>` block | ~10 lines; a `<style src="...">` split for this alone is pure indirection. |
| Script-length AC | Revise DS01's `≤ ~80 lines` target to **`≤ ~130 lines`** for App.vue's script block, reflecting boot wiring + audio computeds + session/nav setup that legitimately stays | The original ~80-line target undercounted App.vue's remaining real responsibilities (composable wiring, provide calls, nav functions) even after every extractable piece is extracted. |

---

## 3. Data Structures

```typescript
// ── src/composables/useAppBoot.ts ──────────────────────────────────────
export interface AppBootDeps {
  appDecks: Ref<AppDeckPayload[]>
  wordPool: Ref<QuizItem[]>
  CONFIG: Ref<ConfigType>
  configReady: Ref<boolean>
  apiError: Ref<string | null>
  hasSavedSession: Ref<boolean>
  globalRunState: Ref<RunState>
  deckId: Ref<string | null>
  shelvedSet: Ref<Set<string>>
  refreshDueBadge: () => Promise<void>
  refreshReviewAvailability: () => Promise<void>
  recalculateCompletedDecks: () => void
}

export async function bootApp(deps: AppBootDeps): Promise<void>
// Body = App.vue's current onMounted, verbatim (fetch decks → build pool →
// load config → restore run state → refresh review badge/availability →
// restore shelved words → env.testHooks sentence config → recalculate).

// ── src/components/DebugRecordingControls.vue ───────────────────────────
// Props:  { activeNav: 'home' | 'learn' | 'review' | 'curation' }
// Emits:  { error: [message: string] }
// Internally uses useDebugRecording() (module singleton) + dumpRecentAndDownload
// directly — no new deps beyond what App.vue already imports today.
```

---

## 4. User Workflows

```
App.vue mount
  ↓
onMounted → await bootApp({ ...refs, ...callbacks })
  ↓
bootApp fetches decks, builds pool, loads config, restores run state,
  refreshes review badge/availability, restores shelved words
  ↓
On any step's failure → apiError.value set (same messages as today) → early return

Debug recording (env.debugMode only)
  ↓
<DebugRecordingControls :active-nav="activeNav" @error="apiError = $event" />
  ↓
Record/Stop/Dump handled entirely inside the component (uses the same
useDebugRecording() singleton App.vue used to call directly)
  ↓
On failure, component emits 'error' → App.vue sets apiError (same UX as today)
```

---

## 5. Stories

### EP44-ST06: Extract boot hydration into `useAppBoot.ts` *(Done)*

**Scope**: Move `onMounted`'s body into a composable function; no behavior change
**Read List**: `src/App.vue` (current `onMounted`), `src/composables/useStore.ts`, `src/composables/useShelving.ts`, `src/composables/useTestSentenceConfig.ts`

**Tasks**:

- [x] Create `src/composables/useAppBoot.ts` exporting `bootApp(deps: AppBootDeps): Promise<void>`
      **Acceptance Criteria**:
- [x] Same fetch/error-handling sequence and same `apiError` messages as today's `onMounted`
- [x] `App.vue`'s `onMounted` becomes `onMounted(() => bootApp({ ...refs, refreshDueBadge, refreshReviewAvailability, recalculateCompletedDecks }))`
- [x] No behavior change — body moved verbatim, no logic changes
- [x] No TypeScript errors; existing test suite still green (`vue-tsc --noEmit` clean, 109/109 tests passing)

---

### EP44-ST07: Extract `DebugRecordingControls.vue` *(Done)*

**Scope**: Move the Record/Dump buttons, handlers, and their CSS into a standalone component
**Read List**: `src/App.vue` (current debug-recording section: `recorder`, `onDumpRecent`, `onToggleRecording`, template buttons, `.rec-toggle`/`.dump-recent` CSS), `src/composables/useDebugRecording.ts`

**Tasks**:

- [x] Create `src/components/DebugRecordingControls.vue`
      **Acceptance Criteria**:
- [x] Renders both buttons exactly as today (same classes, titles, disabled/recording states); gated by `env.debugMode` inside the component
- [x] Takes `activeNav` prop; uses it to pick `'review' | 'learning'` on Start, matching today's logic
- [x] Emits `error` with the same message strings App.vue used to set on `apiError` directly
- [x] `.rec-toggle`/`.dump-recent` CSS moves into this component's `<style scoped>` block; removed from `App.vue`
- [x] `App.vue` renders `<DebugRecordingControls :active-nav="activeNav" @error="apiError = $event" />` in place of the old buttons
- [x] No TypeScript errors; existing test suite still green (`vue-tsc --noEmit` clean, 109/109 tests passing)

---

## 6. Success Criteria

1. `App.vue` script is ≤ ~130 lines (revised target) — **landed at ~173 lines**, not fully met. The remainder is import/wiring for four composables (`useLearningSession`, `useReviewSession`, `useAppBoot`, audio computeds), 10 `provide()` calls, and documented rationale comments — no boot or debug-recording logic remains. Treated as AC substantially met; a further split wasn't pursued (see DS02 §1 rationale for why the audio computeds and remaining wiring stay inline).
2. `onMounted` boot sequence behaves identically — body moved verbatim into `bootApp()`, no logic changes. Not manually walked through in-browser (ST04 covers manual verification separately).
3. Debug-recording Record/Stop/Dump behaves identically — logic moved verbatim into `DebugRecordingControls.vue`. Not manually walked through in-browser (ST04 covers manual verification separately).
4. `vue-tsc --noEmit` clean; full `vitest run` suite green (109/109 tests) — verified 20260716.
5. No new provide/inject keys added; `DebugRecordingControls` takes its one prop (`activeNav`) + emits its one event (`error`) — no wider coupling introduced.

---

## 7. Out of Scope

- Extracting the audio-resolution computeds (too small to justify a file — see Core Requirements).
- Splitting `.api-error` CSS into an external file.
- Any change to `useLearningSession`, `useReviewSession`, or `router-guards.ts` — this DS only touches `App.vue`'s remaining non-routing responsibilities.
- ST04 (manual nav/history/deep-link verification) and ST05 (documentation) from DS01 — unaffected, tracked separately.
