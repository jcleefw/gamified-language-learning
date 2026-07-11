# EP38-DS02: Landing Dashboard, Nav & Review Session in `srs-demo` Specification

**Date**: 20260709T120212Z
**Status**: Impl-Complete (e2e deferred)
**Epic**: [EP38 - Review Mode in `srs-demo`](../../plans/epics/EP38-review-mode-srs-demo.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 2 UI/flow**. Consumes the two routes from [DS01](20260709T120211Z-EP38-DS01-server-review-endpoints.md) (`GET /api/reviews`, `POST /api/reviews/answer`). Behaviour governed by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (write-on-answer; partial-session resume, §10) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (**D5**: review looks like Learning — *no self-rating prompt*; the frontend never imports `ts-fsrs`).

---

## 1. Feature Overview

This DS covers **Phase 2 (EP38-PH02) + Phase 3 (EP38-PH03)** — the client half of Review mode, resting
on DS01's routes. Today `srs-demo` boots straight into deck selection (`screen = 'select'`). This DS
adds:

- **A `'home'` landing dashboard** (`HomeDashboard.vue`) — the new default screen — with two routes:
  **Learn** (→ the existing `'select'` deck flow, unchanged) and **Review**. Review is **locked until
  any word is mastered** (computed client-side from `globalRunState`, which already holds every
  `WordState`); when unlocked it shows a **due-count badge** from `GET /api/reviews`.
- **A `useReviewSession` composable** owning the review state machine, and a `'review'` screen driven
  by it — a **pool-global** flow that fetches due cards, resolves each `wordId` to its content +
  distractors from the already-preloaded `wordPool` (cross-deck, free — orphans skipped), builds
  questions via the **existing pipeline**, presents them in the **same `QuizCard` UI as Learning**,
  captures `shownAt`→answer latency, POSTs each answer to `/api/reviews/answer`, and advances the queue
  with the server's returned schedule.
- **A session summary + "caught up" state** (`ReviewSummary.vue`) — an end-of-session recap (reviewed
  count / next-due horizon) and, when nothing is due, a friendly caught-up screen; both return to the
  landing surface.
- **A persistent top nav menu** (`NavMenu.vue`) — Home / Learn / Review reachable from every screen
  (the app is a state-`ref` SPA, no `vue-router`), reusing the Review unlock gate + due badge.

**The invariant that shapes everything: the client is a dumb terminal for Review.** It renders the
same question UI, self-reports `{ wordId, correct, latencyMs, questionType }`, and **adopts whatever
schedule the server returns** — it never computes a rating, never computes a `due`, and **never
imports `ts-fsrs`**. This is D5 (no self-rating prompt) realised as UI: a review question is
indistinguishable from a Learning question.

**Review state lives in a composable, not `App.vue`.** `srs-demo` already keeps client logic in
composables (`useStore`, `useShelving`); the review state machine follows suit as `useReviewSession`,
instantiated by `App.vue` alongside the existing learning-session state. `App.vue` keeps only boot +
nav + template wiring.

**What is reused, not built**:

- **Question building**: the same pipeline Learning uses (`assembleBatch` → `initBatchState` →
  `nextQuestion`). Review feeds it the resolved due-word `QuizItem`s as the active set and the full
  `wordPool` for distractors — no new question generator.
- **Presentation**: [`QuizCard.vue`](../../../apps/srs-demo/src/components/QuizCard.vue) — it already
  emits `answered: [QuizResult]` and `exit`, and renders both `mcq` and `word-block` kinds. Reused
  verbatim (the MCQ **feedback moment** is added later, in EP39-DS02, behind a prop).
- **Fetch conventions**: new `useStore` helpers (`loadDueReviews`, `postReviewAnswer`) mirror
  `loadRunState`/`postAnswer` (typed throw on non-ok / `success:false`).
- **Mastery check**: `isMastered(ws, CONFIG.masteryThreshold)` — already used across the app — computes
  the unlock gate; no new policy.

**Not in this DS**: server routes (DS01); the review-anytime path, the mode hub, and the MCQ feedback
moment (all EP39). Learning's `'select'`/`'quiz'`/`'results'`/`'overview'` flow is untouched except for
the new landing in front of it.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| New screens | Extend `Screen` union with `'home'` and `'review'`; `screen` **defaults to `'home'`** (was `'select'`) | The dashboard is the new entry; Learn routes into the unchanged `'select'` flow |
| Home is the boot destination | After boot fetches (decks, config, state) complete, land on `'home'`; when unlocked, load the due badge | The unlock gate + badge need `globalRunState` + a `GET /api/reviews`, both boot-time data |
| Review state composable | Introduce `useReviewSession(deps)` owning `dueReviews`, `reviewBatchState`, `reviewQuestion`, `reviewShownAt`, `reviewSummary`, `reviewCaughtUp`, the `reviewUnlocked` gate, and the `onReview`/`onReviewAnswered` functions; `App.vue` instantiates it | Matches the existing `useStore`/`useShelving` composable pattern; `App.vue` stays boot + nav wiring |
| Review unlock gate | `reviewUnlocked = configReady && [...globalRunState.values()].some(ws => isMastered(ws, CONFIG.masteryThreshold))` | Epic: "locked until any word is mastered." `globalRunState` already holds every `WordState`; no server call for the gate. Fail-closed when `!configReady` (no threshold to test). *(EP39 broadens this to also unlock when the user has any review card — see EP39-DS02.)* |
| Due-count badge | When unlocked, `GET /api/reviews` populates `dueReviewCount`; badge shows the count; Review opens **even when 0** (caught-up state) | Badge from the route; entry opens on empty to show "caught up." The gate (any-mastered) is distinct from due-count (may be 0 while unlocked) |
| Badge fetch failure | On `loadDueReviews` failure, unlock stays (gate is local), `badgeError` shows a dash, and entering Review surfaces the error rather than a silent empty session | The gate is local truth; a failed fetch must not masquerade as "caught up" |
| Session data source | On entry, fetch due cards, resolve each `wordId` against the preloaded `wordPool`; **orphans skipped**, not errored | Pillar-3 tolerance through the UI: a due card whose word was deleted must not crash the session |
| Question building | `assembleBatch(items, wordPool, [], items.length, { excludeIds: ∅ })` → `initBatchState` → `nextQuestion`; present via `QuizCard` | Same pipeline/UI as Learning (D5: looks identical); distractors from the full cross-deck `wordPool`. Retries disabled (0) — each word asked once |
| `questionType` on the wire | Report the presented `QuizQuestion.kind` directly (`'mcq'`/`'word-block'`) | Straight pass-through of the engine kind; the server records what was shown (DS01 wire fact) |
| Latency capture | `reviewShownAt = performance.now()` when a review question renders; `latencyMs = now - shownAt` at answer | Same latency semantics as Learning; recorded server-side, never rated |
| Answer path | On `answered`, POST `{ wordId, correct, latencyMs, questionType }`; **adopt the returned `due`**; advance the queue | Server-authoritative advance (DS01); write-on-answer means each answer is durable before the next renders |
| Rating / scheduling in client | **None** — send facts, read back `due`; **no `ts-fsrs` import** | D5 + ADR boundary; AC includes a grep guard |
| Answer failure | On `postReviewAnswer` failure, surface a typed error and **do not** advance past the failed word | DS01 leaves the card unchanged on error; the client must not skip it or fake success |
| Early exit | Exiting mid-session returns to the landing; every already-answered card's advance is already persisted; re-entering reloads only still-due cards | ADR partial-session resume (§10); the client keeps no unsynced review state |
| Summary + caught-up | On queue exhaustion show a summary (reviewed count + next-due horizon from the adopted `due`s); when the due list is empty show "caught up"; both return to the landing | Epic ST07; horizon derived from the `due`s returned this session (no extra fetch) |
| Persistent nav | `NavMenu.vue` (Home / Learn / Review), always visible; navigating away from an **active Learning quiz** flushes the partial batch first (Learning persists on batch-finish); Review needs no flush (write-on-answer) | Fixes the deck-select dead-end (once in `'select'` there was no way back to Home/Review); no `vue-router` |

## 3. Data Structures / Signatures

### `Screen` (`apps/srs-demo/src/types.ts`)

```typescript
export type Screen = 'home' | 'select' | 'quiz' | 'results' | 'overview' | 'review';
// default: 'home'  (EP39 adds 'review-hub')
```

### New `useStore` helpers (client-local; consume DS01 DTOs)

```typescript
// apps/srs-demo/src/composables/useStore.ts

/** Pool-global due cards, most-overdue-first (server-ordered). Throws on failure so
 *  the caller can surface it rather than render a false "caught up" empty session. */
export async function loadDueReviews(): Promise<DueReviewItem[]> {
  const res = await fetch('/api/reviews');
  if (!res.ok) throw new Error(`GET /api/reviews failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
  if (!body.success) throw new Error(`GET /api/reviews error: ${body.error.message}`);
  return body.data.reviews;
}

/** Post a review answer; adopt the server's advanced schedule. Throws on failure so the
 *  caller can avoid advancing the queue past a lost answer. */
export async function postReviewAnswer(req: ReviewAnswerRequest): Promise<ReviewAnswerResponse> {
  const res = await fetch('/api/reviews/answer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /api/reviews/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
  if (!body.success) throw new Error(`POST /api/reviews/answer error: ${body.error.message}`);
  return body.data;
}
```

### `useReviewSession` — the review state machine (EP38 shape)

```typescript
// apps/srs-demo/src/composables/useReviewSession.ts
export function useReviewSession(deps: {
  wordPool: Ref<QuizItem[]>;
  globalRunState: Ref<RunState>;   // from the learning session — for the mastery gate
  configReady: Ref<boolean>;
  CONFIG: Ref<ConfigType>;
  apiError: Ref<string | null>;
}) {
  const dueReviews = ref<DueReviewItem[]>([]);
  const dueReviewCount = ref<number | null>(null);      // badge; null until fetched
  const badgeError = ref(false);                         // never masquerade as "caught up"
  const reviewBatchState = ref<BatchState | null>(null);
  const reviewQuestion = ref<QuizQuestion | null>(null);
  const reviewShownAt = ref<number>(0);
  const reviewQuestionKey = ref(0);
  const reviewCaughtUp = ref(false);
  const reviewSummary = ref<{ reviewed: number; nextDue: string | null }>({ reviewed: 0, nextDue: null });

  // Unlock gate — mastery-only, local, fail-closed. (EP39 also unlocks on "has any card".)
  const reviewUnlocked = computed(() =>
    configReady.value &&
    [...globalRunState.value.values()].some((ws) => isMastered(ws, CONFIG.value.masteryThreshold)),
  );

  // wordId → QuizItem against the preloaded cross-deck wordPool; orphans skipped (pillar 3).
  function resolveDueItems(reviews: DueReviewItem[]): QuizItem[] {
    const byId = new Map(wordPool.value.map((w) => [w.id, w]));
    return reviews.map((r) => byId.get(r.wordId)).filter((w): w is QuizItem => w != null);
  }
  function toReviewQuestionType(q: QuizQuestion): ReviewQuestionType { return q.kind; }

  async function refreshDueBadge() {
    try {
      const reviews = await loadDueReviews();
      dueReviews.value = reviews; dueReviewCount.value = reviews.length; badgeError.value = false;
    } catch { badgeError.value = true; }
  }

  // Build the queue from resolved items and ask the first question. Empty → caught-up.
  function startSessionFromItems(items: QuizItem[]) {
    reviewBatchState.value = null; reviewQuestion.value = null;
    if (items.length === 0) { reviewCaughtUp.value = true; return; }
    reviewCaughtUp.value = false;
    const questions = assembleBatch(items, wordPool.value, [], items.length, { excludeIds: new Set() });
    reviewBatchState.value = initBatchState(questions, 0, new Map(), 0);
    const { question, state } = nextQuestion(reviewBatchState.value);
    reviewBatchState.value = state; reviewQuestion.value = question;
    reviewShownAt.value = performance.now(); reviewQuestionKey.value++;
  }

  async function onReview(): Promise<'entered' | 'stayed'> {
    apiError.value = null;
    let reviews: DueReviewItem[];
    try { reviews = await loadDueReviews(); }
    catch { badgeError.value = true; apiError.value = 'Could not load your reviews…'; return 'stayed'; }
    dueReviews.value = reviews; dueReviewCount.value = reviews.length; badgeError.value = false;
    reviewSummary.value = { reviewed: 0, nextDue: null };
    startSessionFromItems(resolveDueItems(reviews));
    return 'entered';
  }

  function advanceReviewQueue(result: QuizResult) { /* submitBatchResult → next or → summary */ }

  async function onReviewAnswered(result: QuizResult) {
    if (!reviewBatchState.value || !reviewQuestion.value || !('wordId' in result)) { /* guard */ return; }
    const questionType = toReviewQuestionType(reviewQuestion.value);
    const latencyMs = Math.max(0, Math.round(performance.now() - reviewShownAt.value));
    let res;
    try { res = await postReviewAnswer({ wordId: result.wordId, correct: result.correct, latencyMs, questionType }); }
    catch { apiError.value = 'Could not save your review answer…'; return; } // do not advance past it
    reviewSummary.value.reviewed++;
    const prev = reviewSummary.value.nextDue;
    if (prev === null || new Date(res.due).getTime() < new Date(prev).getTime()) reviewSummary.value.nextDue = res.due;
    advanceReviewQueue(result);
  }

  return { dueReviews, dueReviewCount, badgeError, reviewBatchState, reviewQuestion, reviewQuestionKey,
    reviewCaughtUp, reviewSummary, reviewUnlocked, resolveDueItems, refreshDueBadge, onReview, onReviewAnswered };
}
```

### `App.vue` wiring (boot + nav only)

```typescript
const screen = ref<Screen>('home');
const { reviewUnlocked, dueReviewCount, badgeError, reviewQuestion, reviewSummary,
        reviewCaughtUp, refreshDueBadge, onReview: enterReview, onReviewAnswered }
  = useReviewSession({ wordPool, globalRunState, configReady, CONFIG, apiError });

const activeNav = computed<'home' | 'learn' | 'review'>(() =>
  screen.value === 'home' ? 'home' : screen.value === 'review' ? 'review' : 'learn');

// Nav is always visible; leaving an active Learning quiz mid-batch flushes the partial
// batch first (Learning persists on batch-finish). Review is write-on-answer — no flush.
async function navTo(target: 'home' | 'select' | 'review') {
  if (screen.value === 'quiz' && batchState.value && batchState.value.results.length > 0)
    await finishBatchAndTransition();
  if (target === 'review') { await refreshDueBadge(); const o = await enterReview();
    if (o === 'entered') screen.value = 'review'; return; }
  screen.value = target;
}
```

## 4. User Workflows

```
App boot (onMounted)
  → GET /api/decks, GET /api/config, GET /api/state  (as today)
  → if unlocked: refreshDueBadge()   → dueReviewCount     (failure → badgeError, gate stays)
  → screen = 'home'                                        (NEW default landing)

'home' dashboard (HomeDashboard.vue)
  ├─ Learn   → navTo('select')  (existing deck flow, unchanged)
  └─ Review  → navTo('review')  (locked until any word mastered; badge = dueReviewCount)

navTo('review') → refreshDueBadge → enterReview()
  → reviews = loadDueReviews()                 (failure → apiError, stay)
  → items = resolveDueItems(reviews)           (skip orphans)
  → startSessionFromItems(items):
        empty? → reviewCaughtUp = true (screen='review' shows caught-up)
        else   → assembleBatch → initBatchState → nextQuestion → screen = 'review'

'review' screen — QuizCard (same UI as Learning)
  answered(result):
    → latencyMs = now - reviewShownAt
    → postReviewAnswer({...})   ├─ ok  → adopt due; fold into nextDue; advance queue | → summary
                                └─ err → apiError; DO NOT advance past this word
  exit / nav away → durable (write-on-answer); re-entry reloads remaining due cards

NavMenu (always visible): Home / Learn / Review reachable from every screen.
```

## 5. Stories

### EP38-ST05: `'home'` landing dashboard + Review unlock gating

**Scope**: New default `'home'` screen (`HomeDashboard.vue`) routing to Learn or Review; local mastery unlock gate; due-count badge from `GET /api/reviews`. No `ts-fsrs` import.
**Acceptance Criteria**:
- [x] The app boots to `'home'`; Learn opens the unchanged deck-select flow
- [x] Review is **locked** until at least one word is mastered, then unlocks
- [x] When unlocked, Review shows a due-count badge from `GET /api/reviews`, and opens even when the count is 0
- [x] `App.vue`/frontend import no `ts-fsrs`; the Learn flow is unchanged

### EP38-ST06: Review session — question presentation & write-on-answer

**Scope**: `useReviewSession` composable: fetch due cards, resolve to `wordPool` items (skip orphans), build questions via the existing pipeline, present in `QuizCard`, capture latency, POST each answer, adopt the returned schedule, advance the queue. Client-side orchestration only; no rating, no `ts-fsrs`.
**Acceptance Criteria**:
- [x] A due word is shown as an ordinary quiz question in the **same `QuizCard` UI** as Learning — **no self-rating prompt** (D5)
- [x] Answering posts `{ wordId, correct, latencyMs, questionType }`; the client adopts the server-returned `due` and computes no rating or interval (imports no `ts-fsrs`)
- [x] A due card whose word is absent from `wordPool` (orphan) is skipped; the session does not crash
- [x] Write-on-answer: exiting mid-session preserves every advanced card server-side; re-entry reloads only remaining due cards
- [x] A failed `/api/reviews/answer` surfaces an error and does not advance past that word

### EP38-ST07: Review session summary, caught-up state & exit

**Scope**: `ReviewSummary.vue` — end-of-session summary (reviewed count / next-due horizon), an empty-due "caught up" state, and return to the landing; re-entry reloads remaining due cards.
**Acceptance Criteria**:
- [x] Completing all due reviews shows a summary (reviewed count + next-due horizon) and returns to the landing
- [x] Entering Review with nothing due shows the caught-up state (not an error, not a crash)
- [x] After a partial session, re-entering shows only the cards still due (already-advanced ones dropped off)
- [x] No `ts-fsrs` import in the frontend bundle; the Learn flow remains unchanged

### EP38-ST08: Persistent top nav menu (Home / Learn / Review)

**Scope**: `NavMenu.vue` (Home / Learn / Review), always visible, reusing the Review gate + due badge; `navTo` flushes a partial Learning batch before navigating (Review is write-on-answer). State-`ref` SPA; no `vue-router`.
**Acceptance Criteria**:
- [x] From `'select'`/`'overview'`/`'results'` the menu reaches all three destinations (the deck-select dead-end is gone)
- [x] The Review menu item is locked (🔒) until a word is mastered, then shows the due badge — identical gate/badge to the home dashboard
- [x] The menu is always visible, including during an active quiz/review
- [x] Answering then navigating away mid-batch persists that answer (partial Learning batch flushed); leaving a review mid-session is safe by write-on-answer
- [x] `'home'` remains the boot landing; the Learn flow is unchanged; no `ts-fsrs`/`vue-router` imported

## 6. Success Criteria

1. `srs-demo` boots to a `'home'` dashboard routing to Learn (unchanged deck flow) or Review; Review is locked until any word is mastered, then shows a due-count badge and opens even when nothing is due.
2. The review state machine lives in `useReviewSession`; `App.vue` keeps boot + nav wiring.
3. A Review session fetches pool-global due cards, resolves them against the preloaded cross-deck `wordPool` (skipping orphans), and presents them in the same `QuizCard` UI as Learning — with **no self-rating prompt**.
4. Each answer posts the raw facts and the client adopts the server-returned schedule; it computes no rating or interval and imports no `ts-fsrs`.
5. Write-on-answer holds through the UI: exiting mid-session preserves every advanced card, and re-entry reloads only remaining due cards.
6. A failed review answer surfaces a typed error without silently dropping it; an orphaned due card never crashes the session.
7. An always-visible top nav makes Home / Learn / Review reachable from every screen and reuses the Review gate + due badge; navigating away from an active Learning quiz flushes the partial batch. No `vue-router`.

## 7. Implementation Notes

Built as specified. Components: [`HomeDashboard.vue`](../../../apps/srs-demo/src/components/HomeDashboard.vue),
[`ReviewSummary.vue`](../../../apps/srs-demo/src/components/ReviewSummary.vue),
[`NavMenu.vue`](../../../apps/srs-demo/src/components/NavMenu.vue); the review state machine lives in
[`useReviewSession.ts`](../../../apps/srs-demo/src/composables/useReviewSession.ts), with
`loadDueReviews`/`postReviewAnswer` in `useStore.ts`. `App.vue` holds the `Screen` union (default
`'home'`), the composable instantiation, and the `navTo` helper.

Verified by `vue-tsc` + a `ts-fsrs`/`vue-router` grep guard + a manual Playwright drive against a real
server (boot→home, Learn→deck-select, Review lock→unlock + due badge, a review question in the
identical `QuizCard` with no self-rating prompt, `POST /api/reviews/answer` advance + summary,
caught-up state, answer-failure halt, and the full nav flow incl. flush-on-leave). Composable logic is
covered by `apps/srs-demo/src/composables/__tests__/useReviewSession.test.ts`.

**e2e (BDD `review.feature`) deferred**: there was no first-class way to seed a due review card
(DS01 §7) — cards seed with a future `due` and the base `/api/test/seed` didn't cover review cards, so
a UI-only test couldn't reach a due state without backdating the DB. **EP39-DS03's seeding
infrastructure resolves this** (`pnpm seed` + snapshot builder).
