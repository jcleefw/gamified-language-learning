# EP39-DS02: Client — MCQ Feedback Moment, Review-Tab Hub & Practice-Anytime Session Specification

**Date**: 20260710T011740Z
**Status**: Draft
**Epic**: [EP39 - Review Mode Redesign](../../plans/epics/EP39-review-mode-redesign.md)

**Architecture**:
[Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — **Accepted 20260710**. This DS delivers the `srs-demo` client half (EP39-PH02 + PH03) on top of the server contract from [EP39-DS01](20260710T011037Z-EP39-DS01-server-due-gate-and-anytime.md). The client stays a **dumb terminal**: it renders questions (via `@gll/srs-engine-v2`), self-reports answer facts, and adopts the schedule the server returns — it computes **no** rating, **no** due-ness, and imports **no** `ts-fsrs` (D5 + the governing ADRs). The due-gate is entirely server-side (DS01 ST02), so the client sends the **same** answer for due and eager words and merely reads `advanced` back. Requirements traced: FR-002/004/008/009/010/011/013/015/016, NFR-001/003/004.

---

## 1. Feature Overview

Three client changes, in two phases:

- **PH02 — MCQ feedback moment (`QuizCard.vue`).** Today an MCQ **emits `answered` on click**
  ([QuizCard.vue:39-47](../../../apps/srs-demo/src/components/QuizCard.vue#L39)), so the next question
  replaces the card before the learner sees whether they were right. The sentence path already does
  the right thing — it holds on a reveal (`✓ Correct` / `✗ Incorrect` + correct-answer + a **Next**
  button, [QuizCard.vue:277-299](../../../apps/srs-demo/src/components/QuizCard.vue#L277)). We bring
  the MCQ path in line: on answer, **hold** on a feedback state (the correct choice is already
  highlighted green, the wrong pick red, via existing CSS) and advance only on an explicit **Next**.
  Gated by a **prop** so Learning's behaviour is unchanged (see §2 — scope guard).
- **PH03 — Review-tab hub (`ReviewHub.vue`, new).** `navTo('review')` currently drops straight into a
  due session (and a dead-end "caught up" when nothing's due). It instead lands on a **mode-selection
  hub** listing **Due Review** and **Practice Anytime**, always reachable regardless of due-count.
- **PH03 — Practice Anytime session.** A second entry into the *same* review screen/`QuizCard`,
  sourced from `GET /api/reviews/anytime` (all learned words, ≤50, server-ordered). Answers POST to the
  *same* `POST /api/reviews/answer` — the server due-gates — and the summary reports how many
  **advanced** vs how many were **practised (read-only)**, read from the response's `advanced` flag.
  Exitable at any time, non-destructively.

**What is reused, not built** (keeps this DS small):

- **Question rendering & assembly**: `QuizCard.vue`, `assembleBatch`/`nextQuestion`/`initBatchState`
  from `@gll/srs-engine-v2`, and the whole `useReviewSession` queue machinery — the anytime path is a
  second *entry* into the existing session, not a new session engine.
- **The answer round-trip**: `postReviewAnswer` + `onReviewAnswered` are reused verbatim; only the
  summary tally reads the new `advanced` field.
- **The unlock gate + due badge**: `reviewUnlocked`, `refreshDueBadge`, `dueReviewCount`, `badgeError`
  already exist and feed the hub's Due Review card unchanged.
- **The review screen**: the existing `screen === 'review'` block (QuizCard ↔ ReviewSummary) serves
  both session types; only entry and summary copy differ.

**Not in this DS**: the server due-gate + anytime endpoint (DS01); retry-until-correct; Difficult
Words; Speed Review; **Learning-path MCQ feedback** (the dwell prop defaults off for Learning);
timed auto-advance (explicit Next only, OI-004). No `ts-fsrs`, no rating, no due-ness on the client.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| MCQ dwell, not instant emit | `answerMCQ` sets `answered`/`selectedLabel`/`mcqCorrect` and **stops**; a new **Next** button calls `confirmMCQ` which emits `answered` | FR-008/010 — the learner sees correctness before advancing; mirrors the sentence path's `submitSentence`→`confirmSentence` split |
| Correct-answer reveal | Reuse the existing highlight CSS (correct choice `.correct` green, wrong pick `.wrong` red) already applied on `answered`; add a `✓/✗` banner mirroring `.sentence-feedback` | FR-009 — the reveal is already rendered on answer; today it's just never *seen* because the card advances. The dwell is the fix |
| **Scope guard — Learning unchanged** | Add a prop `feedbackDwell?: boolean` (default `false`); MCQ emits immediately when `false`, dwells when `true`. App passes `true` **only** on the review screen | Epic Out-of-scope: Learning-path feedback is *not committed*. The prop keeps Learning byte-identical while making a future opt-in a one-line change |
| Hub is a screen, not a sub-state | Add `'review-hub'` to `Screen`; `navTo('review')` → `screen = 'review-hub'` (after `refreshDueBadge`), **not** `onReview()` | FR-002 — the hub is the review landing; always reachable, so the caught-up dead-end is gone. State-`ref` SPA, no `vue-router` |
| Two entries, one screen | Hub emits `due` → `enterReview()` (EP38 path); `anytime` → new `enterAnytime()`. Both set `screen = 'review'` and drive the same `QuizCard`/`ReviewSummary` | Reuse; the only divergence is source endpoint + summary copy |
| Anytime source | New `loadAnytimeReviews()` → `GET /api/reviews/anytime` → `AnytimeReviewsResponse` (DS01 ST03); resolve `wordId`→`QuizItem` via the preloaded `wordPool` (skip orphans), assemble via the existing pipeline | FR-004/011 — same rendering as Learning/due-review; orphan tolerance carried through (pillar 3) |
| **No client due-gate** | The anytime path posts the identical `ReviewAnswerRequest`; it never inspects or sends due-ness. It only *reads* `res.advanced` | ADR §2 — due-ness is server truth; the client can't and shouldn't decide it |
| Session-type marker is UI-only | A ref `reviewMode: 'due' \| 'anytime'` set on entry, used **only** for summary copy and the exit target — never sent to the server | Keeps the "one endpoint, server decides" invariant; the marker is presentational |
| Summary tally | Extend `reviewSummary` to `{ reviewed, advanced, nextDue }`; `onReviewAnswered` increments `advanced` when `res.advanced`, and folds `res.due` into `nextDue` **only** for advanced answers | FR-013 — an eager session reports "practised N (M advanced)"; a read-only answer's unchanged far-future `due` must not pollute the next-due horizon |
| Exit anytime, non-destructive | Reuse the existing `Exit`/nav flush semantics: review is **write-on-answer**, so each answered word is already durable (advanced or recorded); unanswered words are simply never served | FR-015 — nothing to flush; leaving mid-session loses nothing |
| Re-entry rotation is server-owned | On re-enter, the client just re-fetches `GET /api/reviews/anytime`; the not-due tail is already re-ranked server-side (DS01 FR-016) | The client holds no ordering logic — it renders whatever order the server returns |
| Post-session landing | Review summary "Back" returns to the **hub** (`screen = 'review-hub'`), for both session types | The hub is now the review home; supersedes EP38's "back to home" for review (Home is still one nav click away) |
| `ts-fsrs` boundary | No FSRS import added; the anytime path adds only fetch + render + the `advanced` read | NFR-003 — the grep guard holds; all scheduling stays server-side |

## 3. Data Structures / Signatures

### `QuizCard.vue` — MCQ feedback state (additive)

```typescript
const props = defineProps<{
  question: QuizQuestion; index: number; total: number;
  activeItems: QuizItem[]; queue: QuizItem[]; masteredDeck: QuizItem[];
  shelvedItems?: QuizItem[];
  feedbackDwell?: boolean;        // NEW — true: hold on MCQ feedback + Next; false (default): emit on click
}>();

const mcqCorrect = ref<boolean | null>(null);   // NEW — chosen correctness, held for the reveal + deferred emit

function answerMCQ(choice: MCQQuestion['choices'][number]) {
  if (answered.value || props.question.kind !== 'mcq') return;
  answered.value = true;
  selectedLabel.value = choice.label;
  mcqCorrect.value = choice.isCorrect;
  if (!props.feedbackDwell) {
    emit('answered', { wordId: props.question.wordId, correct: choice.isCorrect }); // legacy immediate path (Learning)
  }
}
function confirmMCQ() {                          // NEW — the deferred emit behind the Next button
  if (!answered.value || props.question.kind !== 'mcq' || mcqCorrect.value === null) return;
  emit('answered', { wordId: (props.question as MCQQuestion).wordId, correct: mcqCorrect.value });
}
// watch(question) also resets mcqCorrect.value = null
```

Template (MCQ block, after the `<ul class="choices">`), mirroring the sentence reveal:

```html
<template v-if="feedbackDwell && answered && mcqCorrect !== null">
  <div class="sentence-feedback" :class="{ correct: mcqCorrect, wrong: !mcqCorrect }">
    {{ mcqCorrect ? '✓ Correct!' : '✗ Incorrect' }}
  </div>
  <!-- correct choice is already highlighted green in the list above (existing CSS) -->
  <button class="btn-submit" @click="confirmMCQ">Next</button>
</template>
```

### `Screen` (`apps/srs-demo/src/types.ts`)

```typescript
export type Screen = 'home' | 'select' | 'quiz' | 'results' | 'overview'
  | 'review-hub'   // NEW — the review mode picker
  | 'review';
```

### `useReviewSession` — anytime entry + summary tally (additive)

```typescript
const reviewMode = ref<'due' | 'anytime'>('due');           // UI marker only; never sent
const reviewSummary = ref<{ reviewed: number; advanced: number; nextDue: string | null }>(
  { reviewed: 0, advanced: 0, nextDue: null },
);

async function onAnytimeReview(): Promise<'entered' | 'stayed'> {
  apiError.value = null;
  let items: DueReviewItem[];
  try { items = await loadAnytimeReviews(); }         // GET /api/reviews/anytime
  catch { apiError.value = '…could not load…'; return 'stayed'; }
  reviewMode.value = 'anytime';
  reviewSummary.value = { reviewed: 0, advanced: 0, nextDue: null };
  const resolved = resolveDueItems(items);            // reuse: wordId→QuizItem, skip orphans
  if (resolved.length === 0) { reviewCaughtUp.value = true; return 'entered'; }
  reviewCaughtUp.value = false;
  const questions = assembleBatch(resolved, wordPool.value, [], resolved.length, { excludeIds: new Set() });
  reviewBatchState.value = initBatchState(questions, 0, new Map(), 0);
  /* nextQuestion → reviewQuestion, reviewShownAt, reviewQuestionKey++ (same as onReview) */
  return 'entered';
}
// onReviewAnswered: after a successful postReviewAnswer(res):
//   reviewSummary.value.reviewed++;
//   if (res.advanced) { reviewSummary.value.advanced++;
//     if (nextDue === null || new Date(res.due) < new Date(nextDue)) nextDue = res.due; }
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
const emit = defineEmits<{ due: []; anytime: []; }>();
// Due Review card: shows the due badge (reuse HomeDashboard's badge logic); enabled when reviewUnlocked.
// Practice Anytime card: enabled when reviewUnlocked; no badge (it's "all learned words").
```

## 4. User Workflows

```
NAV "Review"  → navTo('review')
  → refreshDueBadge()            // keep the due count honest
  → screen = 'review-hub'        // ALWAYS lands here (no more caught-up dead-end)

REVIEW HUB
  ├─ "Due Review"      → enterReview()  → 'entered' → screen='review'   (EP38 due path, unchanged)
  └─ "Practice Anytime"→ enterAnytime() → 'entered' → screen='review'   (reviewMode='anytime')

REVIEW SCREEN (shared)   QuizCard(feedbackDwell=true)
  answer MCQ → highlight correct/wrong + ✓/✗ banner → [Next] → onReviewAnswered
     → postReviewAnswer({wordId, correct, latencyMs, questionType})   // server due-gates
     → res = { wordId, due, advanced }
         reviewed++;  if (res.advanced) { advanced++; fold due into nextDue }
     → advanceReviewQueue → next question | done → ReviewSummary
  Exit / nav away at any time → nothing to flush (write-on-answer) → screen per nav

REVIEW SUMMARY
  due:     "Reviewed N words. Next review due …"
  anytime: "Practised N words (M advanced their schedule)."   // advanced from the tally
  [Back]  → screen = 'review-hub'
```

## 5. Stories

### Phase 2: MCQ feedback moment (EP39-PH02)

### EP39-ST04: MCQ feedback moment in `QuizCard`

**Scope**: Add the dwell-then-Next reveal to the MCQ path, gated by a `feedbackDwell` prop so Learning is unchanged. Mirrors the sentence path.
**Read List**: `apps/srs-demo/src/components/QuizCard.vue` (MCQ block + `answerMCQ` + the sentence `submitSentence`/`confirmSentence`/`.sentence-feedback` reveal as the template)
**Tasks**:

- [ ] Add `feedbackDwell?: boolean` prop and `mcqCorrect` ref; reset `mcqCorrect` in the `question` watch
- [ ] Split `answerMCQ`: always set `answered`/`selectedLabel`/`mcqCorrect`; emit immediately **only** when `!feedbackDwell`
- [ ] Add `confirmMCQ()` (deferred emit) and the feedback banner + **Next** button, shown only when `feedbackDwell && answered`
      **Acceptance Criteria**:
- [ ] With `feedbackDwell` true: answering an MCQ does **not** advance; the chosen answer's correctness shows (correct choice green, wrong pick red) plus a ✓/✗ banner; the correct answer is visible on a miss; **Next** advances
- [ ] With `feedbackDwell` false/absent: MCQ behaviour is byte-identical to today (emits on click) — Learning unaffected
- [ ] No self-rating prompt appears (D5); the reveal shows correctness only, never asks "how well did you know this?"

### Phase 3: Review-tab hub + Practice Anytime session (EP39-PH03)

### EP39-ST05: Review-tab mode-selection hub

**Scope**: New `ReviewHub.vue` (Due Review + Practice Anytime cards); `navTo('review')` lands on it regardless of due-count. Wire `activeNav` and the review screen's feedback prop.
**Read List**: `apps/srs-demo/src/App.vue` (`navTo`, `activeNav`, review screen block, `screen` state), `apps/srs-demo/src/types.ts` (`Screen`), `apps/srs-demo/src/components/HomeDashboard.vue` (mode-card + badge markup to mirror), `apps/srs-demo/src/components/NavMenu.vue`
**Tasks**:

- [ ] Add `'review-hub'` to `Screen`; in `navTo('review')` call `refreshDueBadge()` then set `screen = 'review-hub'` (drop the direct `onReview()` call)
- [ ] Create `ReviewHub.vue` (props: `reviewUnlocked`, `dueCount`, `badgeError`; emits: `due`, `anytime`), reusing HomeDashboard's badge logic on the Due Review card
- [ ] Render the hub for `screen === 'review-hub'`; map `due`→`onReview()`, `anytime`→`onAnytimeReview()` (ST06); include `'review-hub'` in `activeNav`'s `'review'` branch
- [ ] Pass `:feedbackDwell="true"` to the review-screen `QuizCard`
      **Acceptance Criteria**:
- [ ] Clicking **Review** in the nav (or Home's Review card) lands on the hub, even when nothing is due — the caught-up dead-end no longer blocks entry
- [ ] The hub shows Due Review (with the due badge) and Practice Anytime; both are gated by `reviewUnlocked`
- [ ] The nav highlights "Review" while on the hub
- [ ] Selecting Due Review reproduces the exact EP38 due session (regression check)

### EP39-ST06: Practice Anytime session

**Scope**: `loadAnytimeReviews()` + `onAnytimeReview()` entry; reuse `QuizCard`/queue/`onReviewAnswered`; read `advanced` from the response into the summary tally; exit-anytime is free (write-on-answer).
**Read List**: `apps/srs-demo/src/composables/useReviewSession.ts` (`onReview`, `onReviewAnswered`, `resolveDueItems`, `reviewSummary`), `apps/srs-demo/src/composables/useStore.ts` (`loadDueReviews`/`postReviewAnswer` as the pattern), `packages/api-contract/src/srs.ts` (`AnytimeReviewsResponse`, `ReviewAnswerResponse.advanced` — DS01 ST01)
**Tasks**:

- [ ] Add `loadAnytimeReviews()` to `useStore.ts` (GET `/api/reviews/anytime` → `AnytimeReviewsResponse`)
- [ ] Add `reviewMode` ref + `onAnytimeReview()` to `useReviewSession` (fetch → resolve/skip orphans → assemble → first question), reusing the `onReview` body
- [ ] Extend `reviewSummary` to `{ reviewed, advanced, nextDue }`; in `onReviewAnswered`, increment `advanced` and fold `due` into `nextDue` **only** when `res.advanced`
- [ ] Expose `onAnytimeReview`/`reviewMode` from the composable; wire `enterAnytime()` in App to set `screen = 'review'`
      **Acceptance Criteria**:
- [ ] Practice Anytime serves learned words **including not-due ones** (a graduated word with a future due appears), rendered in the same `QuizCard` as due review
- [ ] Each answer POSTs the identical `ReviewAnswerRequest`; the client sends **no** due/practice flag; it reads `advanced` from the response
- [ ] Answering a **not-due** word returns `advanced:false` and does not change the next-due horizon in the summary; answering a **due** word returns `advanced:true` and advances (server-verified via DS01)
- [ ] Exiting mid-session (Exit or nav) loses nothing — answered words are already persisted/recorded; re-entering re-fetches a freshly-ordered batch (server rotates the not-due tail)
- [ ] An orphan (deleted word) is skipped without failing the session; the frontend imports no `ts-fsrs`

### EP39-ST07: Anytime session summary

**Scope**: Summary copy for the anytime path — "practised N (M advanced)"; return to the hub. Due-review summary copy unchanged except the Back target.
**Read List**: `apps/srs-demo/src/components/ReviewSummary.vue`, `apps/srs-demo/src/App.vue` (`onReviewExit`)
**Tasks**:

- [ ] Extend `ReviewSummary` props to accept `mode: 'due' | 'anytime'` and `advanced: number`; render the anytime line ("Practised N words (M advanced their schedule).") vs the due line
- [ ] Route the summary/exit "Back" to `screen = 'review-hub'` for both modes
      **Acceptance Criteria**:
- [ ] After an anytime session the summary reports the practised count and how many advanced; `nextDue` shows only when ≥1 advanced
- [ ] After a due session the summary is unchanged in content; "Back" now returns to the hub (Home remains reachable via nav)
- [ ] A zero-advance eager session (nothing was due) still shows a coherent summary (no next-due line), not an error

## 6. Success Criteria

1. The review tab lands on a **hub** (Due Review · Practice Anytime), reachable regardless of due-count; the EP38 caught-up dead-end no longer gates entry (FR-002).
2. MCQ answers **hold on a correct/wrong reveal** with the correct answer shown, advancing only on **Next**, in review — while Learning's MCQ behaviour is unchanged (prop-gated) (FR-008/009/010).
3. Practice Anytime serves **all learned words** (due + not-due) in the same UI, posting the **identical** answer request; the client sends no due-ness and reads `advanced` back (FR-004; ADR §2).
4. A not-due eager answer is visibly read-only (summary: practised, not advanced; horizon unchanged); a due answer advances — matching the server due-gate (FR-005/006 via DS01).
5. Sessions are exitable at any time with no lost answers (write-on-answer), and re-entry shows a re-ordered batch so the same not-due words don't recur in the same order (FR-015/016 — ordering server-owned).
6. No `ts-fsrs` import; no rating/due-ness computed client-side; no self-rating prompt (NFR-003/004, D5). No type errors.

## 7. Open / Deferred

- **Test seeding** — exercising Practice Anytime end-to-end needs at least one **not-due** learned card
  in the fixture; confirm the `reviewCards` seed (`db3bd20`) can produce a future-due card, else extend
  it (carried from DS01 §7).
- **Learning-path feedback** — the `feedbackDwell` prop makes enabling the dwell for Learning a
  one-line change; intentionally left off here (epic Out-of-scope).
- **OI-004** (timed auto-advance vs explicit Next) — built as explicit Next; revisit only if UX asks.
