# EP39-DS02: Client — MCQ Feedback Moment, Review-Tab Hub & Practice-Anytime Session Specification

**Date**: 20260710T011740Z
**Status**: Impl-Complete
**Epic**: [EP39 - Review Mode: Eager Practice & Feedback](../../plans/epics/EP39-review-mode-redesign.md)

**Architecture**:
[Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — **Accepted 20260710**. This DS delivers the `srs-demo` client half (EP39-PH02 + PH03) on top of the server contract from [EP39-DS01](20260710T011037Z-EP39-DS01-server-due-gate-and-anytime.md). The client stays a **dumb terminal**: it renders questions (via `@gll/srs-engine-v2`), self-reports answer facts, and adopts the schedule the server returns — it computes **no** rating, **no** due-ness, and imports **no** `ts-fsrs` (D5 + the governing ADRs). The due-gate is entirely server-side (DS01 ST02), so the client sends the **same** answer for due and eager words and merely reads `advanced` back. Requirements traced: FR-002/004/008/009/010/011/013/015/016, NFR-001/003/004.

---

## 1. Feature Overview

Three client changes, in two phases:

- **PH02 — MCQ feedback moment (`QuizCard.vue`).** Today an MCQ **emits `answered` on click**, so the
  next question replaces the card before the learner sees whether they were right. The sentence path
  already holds on a reveal (`✓ Correct` / `✗ Incorrect` + correct answer + a **Next** button). We
  bring the MCQ path in line: on answer, **hold** on a feedback state (the correct choice is already
  highlighted green, the wrong pick red, via existing CSS) and advance only on an explicit **Next**.
  Gated by a **prop** so Learning's behaviour is unchanged.
- **PH03 — Review-tab hub (`ReviewHub.vue`, new).** `navTo('review')` lands on a **mode-selection
  hub** listing **Due Review** and **Practice Anytime**, always reachable regardless of due-count —
  replacing EP38's direct due-session entry and its caught-up dead-end.
- **PH03 — Practice Anytime session.** A second entry into the *same* review screen/`QuizCard`,
  sourced from `GET /api/reviews/anytime` (all learned words, ≤50, server-ordered). Answers POST to the
  *same* `POST /api/reviews/answer` — the server due-gates — and the summary reports how many
  **advanced** vs how many were **practised (read-only)**, read from the response's `advanced` flag.
  Exitable at any time, non-destructively.

**Broadened unlock gate.** EP38 unlocked Review only when a word was mastered *this run*
(`globalRunState` mastery). A returning learner whose cards exist but aren't currently due would find
Review locked. EP39 adds `GET /api/reviews/anytime` (all learned words), which lets the client also
unlock on **"has any review card"** — so Practice Anytime is reachable whenever cards exist, even with
nothing due today. The gate becomes `mastered-this-run OR hasReviewCards`.

**What is reused, not built**:

- **Question rendering & assembly**: `QuizCard.vue`, `assembleBatch`/`nextQuestion`/`initBatchState`,
  and the whole `useReviewSession` queue machinery — the anytime path is a second *entry* into the
  existing session, not a new session engine (`startSessionFromItems` is shared by both).
- **The answer round-trip**: `postReviewAnswer` + the answer handler are reused; only the summary tally
  reads the new `advanced` field.
- **The unlock gate + due badge**: `reviewUnlocked`, `refreshDueBadge`, `dueReviewCount`, `badgeError`
  feed the hub's Due Review card.
- **The review screen**: the existing `screen === 'review'` block (QuizCard ↔ ReviewSummary) serves
  both session types; only entry and summary copy differ.

**Not in this DS**: the server due-gate + anytime endpoint (DS01); retry-until-correct; Difficult
Words; Speed Review; **Learning-path MCQ feedback** (the dwell prop defaults off for Learning); timed
auto-advance (explicit Next only, OI-004). No `ts-fsrs`, no rating, no due-ness on the client.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| MCQ dwell, not instant emit | `answerMCQ` sets `answered`/`selectedLabel`/`mcqCorrect` and **stops** when `feedbackDwell`; a **Next** button calls `confirmMCQ` which emits `answered` | FR-008/010 — the learner sees correctness before advancing; mirrors the sentence path's `submitSentence`→`confirmSentence` split |
| Correct-answer reveal | Reuse the existing highlight CSS (correct choice `.correct` green, wrong pick `.wrong` red) applied on `answered`; add a `✓/✗` banner reusing `.sentence-feedback` | FR-009 — the reveal is already rendered on answer; today it's just never *seen* because the card advances. The dwell is the fix |
| **Scope guard — Learning unchanged** | Prop `feedbackDwell?: boolean` (default `false`); MCQ emits immediately when `false`, dwells when `true`. App passes `true` **only** on the review screen | Learning-path feedback is *not committed*; the prop keeps Learning byte-identical while making a future opt-in one line |
| Hub is a screen, not a sub-state | Add `'review-hub'` to `Screen`; `navTo('review')` → `screen = 'review-hub'` (after refreshing badge + availability), **not** a direct session | FR-002 — the hub is the review landing; always reachable, so the caught-up dead-end is gone. State-`ref` SPA, no `vue-router` |
| Two entries, one screen | Hub emits `due` → `onReview()` (EP38 path); `anytime` → `onAnytimeReview()`. Both `startSessionFromItems` and set `screen = 'review'` | Reuse; the only divergence is source endpoint + summary copy |
| Anytime source | `loadAnytimeReviews()` → `GET /api/reviews/anytime` (DS01 ST03); resolve `wordId`→`QuizItem` via the preloaded `wordPool` (skip orphans), assemble via the existing pipeline | FR-004/011 — same rendering as Learning/due-review; orphan tolerance carried through |
| **No client due-gate** | The anytime path posts the identical `ReviewAnswerRequest`; it never inspects or sends due-ness. It only *reads* `res.advanced` | ADR §2 — due-ness is server truth; the client can't and shouldn't decide it |
| Session-type marker is UI-only | `reviewMode: 'due' \| 'anytime'` set on entry, used **only** for summary copy and exit target — never sent | Keeps the "one endpoint, server decides" invariant; the marker is presentational |
| Summary tally | Extend `reviewSummary` to `{ reviewed, advanced, nextDue }`; increment `advanced` when `res.advanced`, and fold `res.due` into `nextDue` **only** for advanced answers | FR-013 — an eager session reports "practised N (M advanced)"; a read-only answer's unchanged far-future `due` must not pollute the horizon |
| Broadened unlock | `reviewUnlocked = configReady && (mastered-this-run OR hasReviewCards)`; `hasReviewCards` fed by `refreshReviewAvailability()` (the anytime read) | Fixes a due card behind a locked tab for a returning learner; best-effort — on failure the mastery path still unlocks |
| Exit anytime, non-destructive | Reuse Exit/nav flush semantics: review is **write-on-answer**, each answered word already durable; unanswered words simply never served | FR-015 — nothing to flush; leaving mid-session loses nothing |
| Re-entry rotation is server-owned | On re-enter, the client just re-fetches `GET /api/reviews/anytime`; the not-due tail is already re-ranked server-side (DS01 FR-016) | The client holds no ordering logic |
| Post-session landing | Summary "Back" returns to the **hub** (`screen = 'review-hub'`), both modes | The hub is the review home; Home is one nav click away |
| `ts-fsrs` boundary | No FSRS import added; the anytime path adds only fetch + render + the `advanced` read | NFR-003 — grep guard holds |

## 3. Data Structures / Signatures

### `QuizCard.vue` — MCQ feedback state (additive)

```typescript
const props = defineProps<{
  question: QuizQuestion; index: number; total: number;
  activeItems: QuizItem[]; queue: QuizItem[]; masteredDeck: QuizItem[];
  shelvedItems?: QuizItem[];
  feedbackDwell?: boolean;        // true: hold on MCQ feedback + Next; false (default): emit on click
}>();

const mcqCorrect = ref<boolean | null>(null);   // chosen correctness, held for the reveal + deferred emit

function answerMCQ(choice: MCQQuestion['choices'][number]) {
  if (answered.value || props.question.kind !== 'mcq') return;
  answered.value = true;
  selectedLabel.value = choice.label;
  mcqCorrect.value = choice.isCorrect;
  if (!props.feedbackDwell) {                     // legacy immediate path (Learning)
    emit('answered', { wordId: props.question.wordId, correct: choice.isCorrect });
  }
}
function confirmMCQ() {                           // deferred emit behind the Next button
  if (!answered.value || props.question.kind !== 'mcq' || mcqCorrect.value === null) return;
  emit('answered', { wordId: (props.question as MCQQuestion).wordId, correct: mcqCorrect.value });
}
// the question watch also resets mcqCorrect.value = null
```

Template (MCQ block, after the `<ul class="choices">`, mirroring the sentence reveal):

```html
<template v-if="feedbackDwell && answered && mcqCorrect !== null">
  <div class="sentence-feedback" :class="{ correct: mcqCorrect, wrong: !mcqCorrect }">
    {{ mcqCorrect ? '✓ Correct!' : '✗ Incorrect' }}
  </div>
  <!-- correct choice already highlighted green in the list above (existing CSS) -->
  <button class="btn-submit" @click="confirmMCQ">Next</button>
</template>
```

### `Screen` (`apps/srs-demo/src/types.ts`)

```typescript
export type Screen = 'home' | 'select' | 'quiz' | 'results' | 'overview'
  | 'review-hub'   // the review mode picker
  | 'review';
```

### `useReviewSession` — anytime entry, availability, summary tally (additive)

```typescript
// Does the user have ANY review card (due or not)? Unlocks Review even when nothing is
// due yet (fresh graduation / returning learner) so Practice Anytime is reachable.
const hasReviewCards = ref(false);
const reviewMode = ref<'due' | 'anytime'>('due');           // UI marker only; never sent
const reviewSummary = ref<{ reviewed: number; advanced: number; nextDue: string | null }>(
  { reviewed: 0, advanced: 0, nextDue: null });

const reviewUnlocked = computed(() =>
  configReady.value &&
  ([...globalRunState.value.values()].some((ws) => isMastered(ws, CONFIG.value.masteryThreshold))
    || hasReviewCards.value));

async function refreshReviewAvailability() {
  try { const cards = await loadAnytimeReviews(); hasReviewCards.value = cards.length > 0; }
  catch { /* leave as-is; mastery still gates unlock */ }
}

async function onAnytimeReview(): Promise<'entered' | 'stayed'> {
  apiError.value = null;
  let reviews: DueReviewItem[];
  try { reviews = await loadAnytimeReviews(); }
  catch { apiError.value = 'Could not load words to practise…'; return 'stayed'; }
  reviewMode.value = 'anytime';
  reviewSummary.value = { reviewed: 0, advanced: 0, nextDue: null };
  startSessionFromItems(resolveDueItems(reviews));           // shared with onReview
  return 'entered';
}

// onReviewAnswered, after a successful postReviewAnswer(res):
//   reviewSummary.value.reviewed++;
//   if (res.advanced) {                          // server truth — only advanced answers moved the schedule
//     reviewSummary.value.advanced++;
//     if (nextDue === null || new Date(res.due) < new Date(nextDue)) nextDue = res.due;
//   }
```

### `loadAnytimeReviews` (`apps/srs-demo/src/composables/useStore.ts`)

```typescript
export async function loadAnytimeReviews(): Promise<DueReviewItem[]> {
  const res = await fetch('/api/reviews/anytime');
  if (!res.ok) throw new Error(`GET /api/reviews/anytime failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<AnytimeReviewsResponse>;
  if (!body.success) throw new Error(`GET /api/reviews/anytime error: ${body.error.message}`);
  return body.data.reviews;
}
```

### `ReviewHub.vue` (new) — props/emits

```typescript
defineProps<{ reviewUnlocked: boolean; dueCount: number | null; badgeError: boolean }>();
const emit = defineEmits<{ due: []; anytime: [] }>();
// Due Review card: shows the due badge (mirrors HomeDashboard); enabled when reviewUnlocked.
// Practice Anytime card: enabled when reviewUnlocked; no badge (it's "all learned words").
```

### `App.vue` wiring (hub + feedback prop)

```typescript
// navTo('review') → refresh both badge and availability, then land on the hub.
async function navTo(target: 'home' | 'select' | 'review') {
  if (screen.value === 'quiz' && batchState.value?.results.length) await finishBatchAndTransition();
  if (target === 'review') {
    await Promise.all([refreshDueBadge(), refreshReviewAvailability()]);
    screen.value = 'review-hub';
    return;
  }
  screen.value = target;
}
async function onReview()  { if (await enterReview()  === 'entered') screen.value = 'review'; }
async function onAnytime() { if (await enterAnytime() === 'entered') screen.value = 'review'; }
function onReviewExit()    { screen.value = 'review-hub'; }
// <ReviewHub v-else-if="screen==='review-hub'" ... @due="onReview" @anytime="onAnytime" />
// <QuizCard  ... :feedbackDwell="true" @answered="onReviewAnswered" @exit="onReviewExit" />
```

## 4. User Workflows

```
NAV "Review" → navTo('review')
  → Promise.all([refreshDueBadge(), refreshReviewAvailability()])   // due count + "has any card"
  → screen = 'review-hub'         // ALWAYS lands here (no caught-up dead-end)

REVIEW HUB
  ├─ "Due Review"       → onReview()   → 'entered' → screen='review'   (EP38 due path)
  └─ "Practice Anytime" → onAnytime()  → 'entered' → screen='review'   (reviewMode='anytime')

REVIEW SCREEN (shared)   QuizCard(feedbackDwell=true)
  answer MCQ → highlight correct/wrong + ✓/✗ banner → [Next] → onReviewAnswered
     → postReviewAnswer({wordId, correct, latencyMs, questionType})   // server due-gates
     → res = { wordId, due, advanced }
         reviewed++;  if (res.advanced) { advanced++; fold due into nextDue }
     → advance queue → next | done → ReviewSummary
  Exit / nav away at any time → nothing to flush (write-on-answer)

REVIEW SUMMARY
  due:     "Review complete — reviewed N words. Next review due …"
  anytime: "Practice complete — practised N words (M advanced their schedule)."
  [Back to review] → screen = 'review-hub'
```

## 5. Stories

### EP39-ST04: MCQ feedback moment in `QuizCard`

**Scope**: Add the dwell-then-Next reveal to the MCQ path, gated by `feedbackDwell` so Learning is unchanged. Mirrors the sentence path.
**Acceptance Criteria**:
- [x] With `feedbackDwell` true: answering an MCQ does **not** advance; the chosen answer's correctness shows (correct choice green, wrong pick red) + a ✓/✗ banner; the correct answer is visible on a miss; **Next** advances
- [x] With `feedbackDwell` false/absent: MCQ behaviour is byte-identical to today (emits on click) — Learning unaffected
- [x] No self-rating prompt appears (D5); the reveal shows correctness only

### EP39-ST05: Review-tab mode-selection hub

**Scope**: New `ReviewHub.vue` (Due Review + Practice Anytime cards); `navTo('review')` lands on it regardless of due-count. Broaden the unlock gate with `hasReviewCards` via `refreshReviewAvailability`. Wire `activeNav`, the review screen's `feedbackDwell` prop, and the summary "Back" to the hub.
**Acceptance Criteria**:
- [x] Clicking **Review** (nav or Home card) lands on the hub, even when nothing is due — the caught-up dead-end no longer blocks entry
- [x] The hub shows Due Review (with the due badge) and Practice Anytime; both gated by `reviewUnlocked`
- [x] The nav highlights "Review" while on the hub
- [x] Selecting Due Review reproduces the EP38 due session (regression check)
- [x] A returning learner with cards but nothing due still sees Review unlocked (via `hasReviewCards`)

### EP39-ST06: Practice Anytime session

**Scope**: `loadAnytimeReviews()` + `onAnytimeReview()` entry; reuse `startSessionFromItems`/`QuizCard`/answer handler; read `advanced` from the response into the summary tally; exit-anytime is free (write-on-answer).
**Acceptance Criteria**:
- [x] Practice Anytime serves learned words **including not-due ones** (a graduated word with a future due appears), rendered in the same `QuizCard` as due review
- [x] Each answer POSTs the identical `ReviewAnswerRequest`; the client sends **no** due/practice flag; it reads `advanced` from the response
- [x] Answering a **not-due** word returns `advanced:false` and does not change the next-due horizon; answering a **due** word returns `advanced:true` and advances (server-verified via DS01)
- [x] Exiting mid-session loses nothing; re-entering re-fetches a freshly-ordered batch (server rotates the not-due tail)
- [x] An orphan is skipped without failing the session; the frontend imports no `ts-fsrs`

### EP39-ST07: Anytime session summary

**Scope**: `ReviewSummary.vue` gains `mode: 'due' | 'anytime'` + `advanced: number`; the anytime line reads "practised N (M advanced)"; "Back" routes to the hub for both modes.
**Acceptance Criteria**:
- [x] After an anytime session the summary reports the practised count and how many advanced; `nextDue` shows only when ≥1 advanced
- [x] After a due session the summary content is unchanged; "Back" now returns to the hub
- [x] A zero-advance eager session (nothing was due) still shows a coherent summary (no next-due line), not an error

## 6. Success Criteria

1. The review tab lands on a **hub** (Due Review · Practice Anytime), reachable regardless of due-count; the EP38 caught-up dead-end no longer gates entry (FR-002).
2. MCQ answers **hold on a correct/wrong reveal** with the correct answer shown, advancing only on **Next**, in review — while Learning's MCQ behaviour is unchanged (prop-gated) (FR-008/009/010).
3. Practice Anytime serves **all learned words** (due + not-due) in the same UI, posting the **identical** answer request; the client sends no due-ness and reads `advanced` back (FR-004; ADR §2).
4. A not-due eager answer is visibly read-only (summary: practised, not advanced; horizon unchanged); a due answer advances — matching the server due-gate (FR-005/006 via DS01).
5. Sessions are exitable at any time with no lost answers (write-on-answer), and re-entry shows a re-ordered batch so the same not-due words don't recur in the same order (FR-015/016 — ordering server-owned).
6. Review is unlocked whenever the learner has any review card, not only after mastering a word this run.
7. No `ts-fsrs` import; no rating/due-ness computed client-side; no self-rating prompt (NFR-003/004, D5). No type errors.

## 7. Implementation Notes

Built as specified. `QuizCard.vue` gains `feedbackDwell` + `mcqCorrect` + `confirmMCQ` and the MCQ
reveal banner; [`ReviewHub.vue`](../../../apps/srs-demo/src/components/ReviewHub.vue) is new;
[`useReviewSession.ts`](../../../apps/srs-demo/src/composables/useReviewSession.ts) gains
`onAnytimeReview`, `reviewMode`, `hasReviewCards`/`refreshReviewAvailability`, the shared
`startSessionFromItems`, and the `advanced` tally; `loadAnytimeReviews` is in `useStore.ts`;
`ReviewSummary.vue` gains `mode`/`advanced`. `App.vue` adds `'review-hub'`, `navTo` (refresh both badge
+ availability → hub), `onReview`/`onAnytime`/`onReviewExit`, and `:feedbackDwell="true"` on the review
`QuizCard`. Covered by `useReviewSession.test.ts` (anytime entry, `advanced` tally, unlock gate incl.
`hasReviewCards`) and verified live via Playwright (hub, MCQ dwell + Next, a not-due eager answer
returning `advanced:false` with an unchanged horizon).

**Deferred**: Learning-path feedback (the `feedbackDwell` prop makes it a one-line opt-in);
timed auto-advance (OI-004, built as explicit Next); retry-until-correct, Difficult Words, Speed
Review (ADR Deferred Review Modes).
