# EP33-DS01: Playwright BDD Setup + Sentence/Word Question Fixes

**Date**: 20260625T120000Z
**Status**: Impl-Complete
**Epic**: [EP33 — Playwright BDD Setup + Mastered-Words Regression Fix](../../plans/epics/EP33-playwright-bdd-setup.md)

---

## 1. Feature Overview

Two concerns bundled in EP33:

1. **BDD test infrastructure** — Install Playwright + `playwright-bdd` in `apps/srs-demo`; configure two `webServer` entries (Hono API + Vite with `VITE_CHEAT_MODE=true`); write Gherkin scenarios for the mastered-words regression.

2. **Sentence question regressions** (discovered during E2E authoring) — Two bugs made sentence questions unplayable after a wrong answer; fixed and covered with BDD scenarios. Word question scenarios also added for parity.

---

## 2. Bug Analysis

### Bug A — Sentence tiles/submit locked after wrong answer

**Symptom**: After submitting a wrong sentence answer, all tile chips and the Submit button become unresponsive. The user cannot retry.

**Root cause**: `QuizCard.vue` uses a shallow `watch(() => props.question, ...)` to reset `answered`. When the engine re-queues the wrong sentence, `nextQuestion` returns the **same object reference**. Vue's watcher sees no change and does not fire; `answered` stays `true`, blocking all tile clicks and Submit.

**Fix**: Add a `questionKey` counter (`ref(0)`) to `App.vue`. Pass `:key="questionKey"` on `<QuizCard>`. Increment in both `startBatch` and `onAnswered` every time a new question is loaded. Vue destroys and remounts the component on key change, fully resetting `answered`, `selectedTiles`, `remainingTiles`, and drag state.

---

### Bug B — Sentence answer advances without showing feedback

**Symptom**: Clicking Submit on a sentence question immediately shows the next question. The user never sees whether they were correct or wrong, and never sees the correct answer.

**Root cause**: `submitSentence()` computed the result and immediately emitted `answered`. `App.vue`'s `onAnswered` advanced to the next question before Vue rendered any feedback.

**Fix**: Split into two phases:

| Phase | Function | Effect |
|---|---|---|
| 1 | `submitSentence()` | Computes result → `sentenceCorrect` ref; sets `answered = true`; does **not** emit |
| 2 | `confirmSentence()` | Emits `answered` with stored result; called by "Next" button |

Between phases, the template shows:
- `✓ Correct!` or `✗ Incorrect` feedback strip
- When wrong: correct-answer tiles rendered in `.correct-answer` using the same `tile-chip` style
- A "Next" button that calls `confirmSentence()`

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Component reset mechanism | `:key="questionKey"` on `<QuizCard>` | Standard Vue pattern; forces full remount; eliminates watch–reference identity issues |
| Sentence feedback gating | Two-phase `submitSentence` / `confirmSentence` | User must acknowledge result before advancing; correct answer visible for wrong attempts |
| Correct answer display | `.correct-answer` div with `tile-chip--correct` chips | Reuses existing tile-chip styles; visually consistent with answer area |
| Wrong-order strategy in E2E | Reverse the correct wordId order from cheat hint | Deterministic wrong answer for any sentence; avoids fragile DOM-position assumptions |
| Word re-presentation detection | Match cheat hint `— value` field | Survives direction changes between first presentation and retry |
| Sentence scheduling wiring | Added to `App.vue` in ST04 | Prerequisite for sentence questions to appear; was originally scoped out of EP31 |

---

## 4. Scope vs. Original EP33 Plan

Original EP33 plan scoped ST01–ST03 (Playwright setup, mastered-words regression feature + fix, gitignore). During E2E authoring the sentence regressions were discovered, extending scope:

| Story | Original | Added in |
|---|---|---|
| EP33-ST01 Playwright install + config | ✓ planned | — |
| EP33-ST02 Mastered-words feature + fix | ✓ planned | — |
| EP33-ST03 gitignore Playwright artefacts | ✓ planned | — |
| EP33-ST04 Sentence question bug fixes | — | discovered during ST02 authoring |
| EP33-ST05 Extended sentence BDD scenarios | — | follows ST04 |
| EP33-ST06 Word question BDD scenarios | — | follows ST05 for parity |

---

## 5. Stories

### EP33-ST01: Install and configure Playwright + playwright-bdd

**Scope**: Add deps and config only — no test files.

**Files**:
- `apps/srs-demo/package.json` — add `@playwright/test`, `playwright-bdd`; add `e2e` script
- `apps/srs-demo/playwright.config.ts` — two `webServer` entries, BDD plugin config

**Acceptance Criteria**:
- [x] `pnpm e2e` command exists and launches Playwright
- [x] `playwright.config.ts` starts Hono (port 6060) and Vite (`VITE_CHEAT_MODE=true`) automatically

---

### EP33-ST02: Mastered-words regression feature + fix

**Scope**: Write failing scenario, implement steps, fix `App.vue:initSession()`.

**Root cause of regression**: `initSession()` passed mastered words as `recheckIds` to `initAdaptiveSession()`. The engine fills the active pool with recheck items first; with `wordsPerBatch=3` and 3 mastered words all 3 slots were consumed — no room for new words.

**Fix**: Filter mastered words out of the `words` array passed to `initAdaptiveSession()` rather than re-entering them as recheck items.

**Files**:
- `apps/srs-demo/e2e/features/session-mastery.feature`
- `apps/srs-demo/e2e/steps/session-mastery.steps.ts`
- `apps/srs-demo/src/App.vue` — `initSession()` mastered-word filter

**Acceptance Criteria**:
- [x] `session-mastery.feature` scenario passes
- [x] Mastered words do not appear in the active pool on deck re-entry

---

### EP33-ST03: gitignore Playwright artefacts

**Scope**: One-line additions to root `.gitignore`.

**Files**: `.gitignore` — `test-results/`, `playwright-report/`

**Acceptance Criteria**:
- [x] `test-results/` and `playwright-report/` are gitignored

---

### EP33-ST04: Fix sentence question bugs (Bug A + Bug B)

**Files changed**:

| File | Change |
|---|---|
| `apps/srs-demo/src/App.vue` | `questionKey` counter; `:key="questionKey"` on `<QuizCard>`; sentence scheduling (`sentenceRunState`, `batchNum`, `sentenceCorpus`, `resolveEligibleContexts`, `updateSentenceRunState`, `composeSentenceBatch`) |
| `apps/srs-demo/src/components/QuizCard.vue` | Full word-block UI (answer area, tile bank, drag handlers); `sentenceCorrect` ref; two-phase `submitSentence`/`confirmSentence`; feedback + correct-answer display; `tile-chip--correct` style |
| `apps/srs-demo/src/data/transformer.ts` | `linesToSentenceCorpus(deck)` helper |

**Acceptance Criteria**:
- [x] After a wrong sentence answer, tiles remain interactive and Submit re-enables
- [x] After submitting a sentence, feedback is displayed before advancing
- [x] Wrong sentence shows correct answer tiles before the Next button
- [x] Correct sentence shows `✓ Correct!` before advancing

---

### EP33-ST05: Extended sentence question BDD scenarios

**Files**:
- `apps/srs-demo/e2e/features/sentence-question.feature` — 3 new scenarios (5 total)
- `apps/srs-demo/e2e/steps/sentence-question.steps.ts` — full rewrite with fixed cheat-hint parsing

**Cheat-hint parsing fix**: Previous `parseSentenceCheatHint` split on `→` without stripping the `✓ ` prefix, contaminating the first wordId. Fixed with `.replace(/^✓\s*/, '')` before splitting.

**New scenarios**:
1. Submitting a correct sentence shows `✓ Correct!` feedback and a Next button
2. Submitting a wrong sentence shows `✗ Incorrect`, correct answer tiles, and a Next button
3. A wrong sentence is re-queued and the same prompt reappears before the batch ends

**Acceptance Criteria**:
- [x] All 5 sentence scenarios defined; step definitions implement without undefined-step warnings
- [x] `answerSentenceCorrectly` helper clicks Next after Submit (updated for Bug B fix)

---

### EP33-ST06: Word question BDD scenarios

**Files**:
- `apps/srs-demo/e2e/features/word-question.feature` — 3 scenarios
- `apps/srs-demo/e2e/steps/word-question.steps.ts`

**Scenarios**:
1. A word question displays a prompt and exactly 4 choices
2. Answering correctly advances to the next question or batch results
3. A wrong word answer is re-queued and the same word value reappears before the batch ends

**Re-presentation matching strategy**: Store `value` from `"✓ label — value"` cheat hint (e.g. `ขาว`). When looping through subsequent questions, match on cheat hint value rather than prompt text — robust to direction changes between first and retry presentation.

**Acceptance Criteria**:
- [x] All 3 word scenarios defined; step definitions implement without undefined-step warnings

---

## 6. Success Criteria

1. `pnpm e2e` from `apps/srs-demo` runs all BDD scenarios green
2. `session-mastery.feature` — mastered words excluded from active pool on deck re-entry
3. `sentence-question.feature` — feedback shown on submit; wrong shows correct tiles; wrong sentence re-queued
4. `word-question.feature` — MCQ structure verified; correct advances; wrong word re-queued
5. Bug A fixed — tiles interactive after wrong sentence answer
6. Bug B fixed — user sees feedback before advancing from sentence question
