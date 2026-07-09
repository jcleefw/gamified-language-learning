# EP38-DS02: Landing Dashboard & Review Session in `srs-demo` Specification

**Date**: 20260709T120212Z
**Status**: Impl-Complete (e2e deferred)
**Epic**: [EP38 - Review Mode in `srs-demo`](../../plans/epics/EP38-review-mode-srs-demo.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 2 UI/flow**. Consumes the two routes from [DS01](20260709T120211Z-EP38-DS01-server-review-endpoints.md) (`GET /api/reviews`, `POST /api/reviews/answer`). Behaviour governed by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (write-on-answer; partial-session resume, §10) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (**D5**: review looks like Learning — *no self-rating prompt*; the frontend never imports `ts-fsrs`).

---

## 1. Feature Overview

This DS covers **Phase 2 (EP38-PH02)** — the client half of Review mode, resting on DS01's routes.
Today `srs-demo` boots straight into deck selection (`screen = 'select'`). PH02 adds:

- **A `'home'` landing dashboard** — the new default screen — with two routes: **Learn** (→ the
  existing `'select'` deck flow, unchanged) and **Review**. Review is **locked until any word is
  mastered** (computed client-side from `globalRunState`, which already holds every `WordState`);
  when unlocked it shows a **due-count badge** from `GET /api/reviews`.
- **A `'review'` session screen** — a **pool-global** flow that fetches due cards, resolves each
  `wordId` to its content + distractors from the already-preloaded `wordPool` (cross-deck, free —
  the app loads all decks at boot; orphans skipped), builds questions via the **existing pipeline**,
  presents them in the **same `QuizCard` UI as Learning**, captures `shownAt`→answer latency, POSTs
  each answer to `/api/reviews/answer`, and advances the queue with the server's returned schedule.
- **A session summary + "caught up" state** — an end-of-session recap (reviewed count / next-due
  horizon) and, when nothing is due, a friendly caught-up screen; both return to `'home'`. Re-entry
  naturally reloads the remaining due cards (partial-session resume).

**The invariant that shapes everything: the client is a dumb terminal for Review.** It renders the
same question UI, self-reports `{ wordId, correct, latencyMs, questionType }`, and **adopts whatever
schedule the server returns** — it never computes a rating, never computes a `due`, and **never
imports `ts-fsrs`**. This is D5 (no self-rating prompt) realised as UI: a review question is
indistinguishable from a Learning question.

**What is reused, not built** (keeps this DS small and parity-free):

- **Question building**: the same pipeline Learning uses (`assembleBatch` → `initBatchState` →
  `nextQuestion`, see [App.vue `startBatch`](../../../apps/srs-demo/src/App.vue#L206)). Review feeds it the resolved due-word `QuizItem`s as the active set and the full `wordPool` for distractors — no new question generator.
- **Presentation**: [`QuizCard.vue`](../../../apps/srs-demo/src/components/QuizCard.vue) unchanged — it already emits `answered: [QuizResult]` and `exit`, and already renders both `mcq` and `word-block` kinds. Review reuses it verbatim.
- **Fetch conventions**: new `useStore` helpers (`loadDueReviews`, `postReviewAnswer`) mirror
  `loadRunState`/`postAnswer` (typed throw on non-ok / `success:false`).
- **Mastery check**: `isMastered(ws, CONFIG.masteryThreshold)` — already imported and used across
  `App.vue` — computes the unlock gate; no new policy.

**Not in this DS**: server routes (DS01); deck-scoped review entry; a "review ahead" / due-bypass
surface; lapse→Learning re-entry. Learning's `'select'`/`'quiz'`/`'results'`/`'overview'` flow is
untouched except for the new default landing in front of it.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| New screens | Extend `Screen` union with `'home'` and `'review'`; `screen` **defaults to `'home'`** (was `'select'`) | The dashboard is the new entry; Learn routes into the unchanged `'select'` flow |
| Home is the boot destination | After the existing boot fetches (decks, config, state) complete, land on `'home'`; if boot fails closed (config unfetched), the existing `apiError` path still applies before any session | The unlock gate and due badge both need `globalRunState` + a `GET /api/reviews`, which are boot-time data; home renders after boot like `'select'` did |
| Review unlock gate | `reviewUnlocked = computed(() => [...globalRunState.values()].some((ws) => isMastered(ws, CONFIG.masteryThreshold)))` | Epic: "locked until any word is mastered." `globalRunState` already holds every `WordState`; no server call needed for the gate itself. Fail-closed: if `configReady` is false the gate reads locked (no threshold to test) |
| Due-count badge | When unlocked, `GET /api/reviews` populates `dueReviews`; badge shows `dueReviews.length`; Review opens **even when 0** (caught-up state) | Epic: badge from the route; entry opens on empty to show "caught up." The gate (any-mastered) is distinct from due-count (may be 0 while unlocked) |
| Badge fetch failure | On `loadDueReviews` failure, unlock stays (gate is local), badge shows no count (or a dash), and entering Review surfaces the error rather than a silent empty session | The gate is local truth; the badge/session need the route. A failed fetch must not masquerade as "caught up" |
| Session data source | `'review'` fetches due cards on entry, resolves each `wordId` against the preloaded `wordPool`; **orphans (no matching pool item) are skipped**, not errored | Epic pillar-3 tolerance carried through the UI: a due card whose word was deleted must not crash the session |
| Question building | Reuse `assembleBatch(resolvedDueItems, wordPool, [], resolvedDueItems.length, { excludeIds: emptySet })` → `initBatchState` → `nextQuestion`; present via `QuizCard` | Same pipeline/UI as Learning (D5: looks identical); distractors come from the full cross-deck `wordPool`. No new generator, no sentence-corpus scheduling for review words (MC by default; `word-block` still renders if the pipeline emits it) |
| `questionType` on the wire | Report the presented `QuizQuestion.kind` directly as `ReviewQuestionType` (`'mcq'`/`'word-block'` — the union mirrors the engine kind, so it's a straight pass-through) | The server records what was shown (DS01 wire fact); the client reports it truthfully, no renaming |
| Latency capture | Record `shownAt = performance.now()` (or `Date.now()`) when a review question renders; `latencyMs = now - shownAt` at answer | Same latency semantics as Learning's `postAnswer`; recorded server-side (DS01), never rated now |
| Answer path | On `QuizCard`'s `answered`, POST `{ wordId, correct, latencyMs, questionType }` to `/api/reviews/answer` via `postReviewAnswer`; **adopt the returned `due`**; advance the queue to the next due word | Server-authoritative advance (DS01); the client holds no schedule of its own. Write-on-answer means each answer is durable before the next renders |
| Rating / scheduling in client | **None** — the client sends facts and reads back `due`; it computes no rating and no interval; **no `ts-fsrs` import** | D5 + ADR boundary. AC includes a grep guard that the frontend bundle imports no `ts-fsrs` |
| Answer failure | On `postReviewAnswer` failure, surface a typed error and **do not** advance the queue past the failed word (do not silently drop it) | DS01 leaves the card unchanged on error; the client must not skip it or fake success (Epic edge/limit AC) |
| Write-on-answer / early exit | Exiting mid-session (QuizCard `exit`) returns to `'home'`; every already-answered card's advance is already persisted server-side; re-entering Review reloads only the still-due cards | ADR partial-session resume (§10); the client keeps no unsynced review state to lose |
| Summary + caught-up | On queue exhaustion show a summary (reviewed count + next-due horizon from the adopted `due`s); when the initial due list is empty show a "caught up — nothing due" state; both offer return to `'home'` | Epic ST07; next-due horizon is derived from the `due`s the server returned this session (no extra fetch required) |
| Learning flow untouched | `'select'`/`'quiz'`/`'results'`/`'overview'`, `initSession`, `startBatch`, `postAnswer` all unchanged; only a new landing sits in front and two new screens are added | Minimise blast radius; Review is additive |

## 3. Data Structures

### New `useStore` helpers (client-local; consume DS01 DTOs)

```typescript
// apps/srs-demo/src/composables/useStore.ts
import type {
  DueReviewsResponse, ReviewAnswerRequest, ReviewAnswerResponse, ApiResponse,
} from '@gll/api-contract';

/** Pool-global due cards, most-overdue-first (server-ordered). Throws on failure. */
export async function loadDueReviews(): Promise<DueReviewsResponse['reviews']> {
  const res = await fetch('/api/reviews');
  if (!res.ok) throw new Error(`GET /api/reviews failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<DueReviewsResponse>;
  if (!body.success) throw new Error(`GET /api/reviews error: ${body.error.message}`);
  return body.data.reviews; // [{ wordId, due(ISO) }]
}

/** Post a review answer; adopt the server's advanced schedule. Throws on failure so the
 *  caller can avoid advancing the queue past a lost answer. */
export async function postReviewAnswer(req: ReviewAnswerRequest): Promise<ReviewAnswerResponse> {
  const res = await fetch('/api/reviews/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`POST /api/reviews/answer failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<ReviewAnswerResponse>;
  if (!body.success) throw new Error(`POST /api/reviews/answer error: ${body.error.message}`);
  return body.data; // { wordId, due(ISO, advanced) }
}
```

### New `App.vue` state (review session, mirrors the batch/quiz refs)

```typescript
type Screen = 'home' | 'select' | 'quiz' | 'results' | 'overview' | 'review';
const screen = ref<Screen>('home'); // was 'select'

const dueReviews = ref<DueReviewItem[]>([]);          // from GET /api/reviews (badge + session queue)
const reviewBatchState = ref<BatchState | null>(null); // built via assembleBatch over resolved due items
const reviewQuestion = ref<QuizQuestion | null>(null);
const reviewShownAt = ref<number>(0);                  // latency start for the current review question
const reviewSummary = ref<{ reviewed: number; nextDue: string | null }>({ reviewed: 0, nextDue: null });

// Unlock gate — purely local; no server call. Fail-closed when config not ready.
const reviewUnlocked = computed(() =>
  configReady.value &&
  [...globalRunState.value.values()].some((ws) => isMastered(ws, CONFIG.value.masteryThreshold)),
);

// wordId → QuizItem resolution against the already-preloaded, cross-deck wordPool.
function resolveDueItems(reviews: DueReviewItem[]): QuizItem[] {
  const byId = new Map(wordPool.value.map((w) => [w.id, w]));
  return reviews.map((r) => byId.get(r.wordId)).filter((w): w is QuizItem => w != null); // orphans skipped
}
```

### `questionType` (wire fact — straight pass-through of the engine kind)

```typescript
// ReviewQuestionType ('mcq' | 'word-block') mirrors QuizQuestion.kind, so the
// client reports it directly — no mapping/renaming.
function toReviewQuestionType(q: QuizQuestion): ReviewQuestionType {
  return q.kind; // 'mcq' | 'word-block'
}
```

## 4. User Workflows

```
App boot (onMounted, existing fetches unchanged)
  → GET /api/decks, GET /api/config, GET /api/state  (as today)
  → if unlocked: loadDueReviews() → dueReviews         (badge; failure → error, gate stays)
  → screen = 'home'                                     (NEW default landing)

'home' dashboard
  ├─ Learn   → screen = 'select'  (existing deck flow, unchanged)
  └─ Review  → (locked until any word mastered)
        unlocked → badge = dueReviews.length; click → enterReview()

enterReview()
  → reviews = await loadDueReviews()            (refresh; failure → error, stay on home)
  → items = resolveDueItems(reviews)            (skip orphans)
  → items empty? → screen = 'review' (CAUGHT-UP state) → back to 'home'
  → questions = assembleBatch(items, wordPool, [], items.length, { excludeIds: ∅ })
  → reviewBatchState = initBatchState(questions, ...); { question } = nextQuestion(...)
  → reviewQuestion = question; reviewShownAt = now(); screen = 'review'

'review' screen — QuizCard (same UI as Learning)
  on answered(result):
    → latencyMs = now() - reviewShownAt
    → postReviewAnswer({ wordId, correct, latencyMs, questionType })   // server advances + persists
         ├─ ok  → adopt returned due; advance queue (nextQuestion) or → summary if exhausted
         └─ err → surface error; DO NOT advance past this word (retry/exit)
  on exit:
    → screen = 'home'  (already-answered advances are durable server-side; re-entry reloads remaining)

summary (queue exhausted)
  → { reviewed, nextDue }  → back to 'home'
```

## 5. Stories

### Phase 2: Landing + Review mode in `srs-demo` (EP38-PH02)

### EP38-ST05: `'home'` landing dashboard + Review unlock gating

**Scope**: New default `'home'` screen routing to Learn (existing `'select'`) or Review; local unlock gate from `globalRunState`; due-count badge from `GET /api/reviews`. No `ts-fsrs` import.
**Read List**: `apps/srs-demo/src/App.vue` (`Screen` union, `screen` ref, `onMounted`, `globalRunState`, `configReady`, `isMastered` usage, template screen blocks), `apps/srs-demo/src/composables/useStore.ts` (`loadConfig`/`loadRunState` pattern), `packages/api-contract/src/srs.ts` (DS01 `DueReviewsResponse`), `apps/srs-demo/src/components/DeckSelector.vue` (dashboard styling reference)
**Tasks**:

- [ ] Add `'home'` + `'review'` to `Screen`; change the initial `screen` ref to `'home'`; add a home template block with Learn / Review cards
- [ ] Add `loadDueReviews()` to `useStore.ts` (mirrors `loadRunState`); in `onMounted`, when unlocked, fetch `dueReviews` after the existing state load
- [ ] Add the `reviewUnlocked` computed (any-mastered from `globalRunState`, fail-closed on `!configReady`); Learn routes to `'select'`, Review (when unlocked) shows `dueReviews.length` and routes to review entry
- [ ] Ensure a `loadDueReviews` failure surfaces the error and does not falsely render "caught up" (gate stays on local truth)
      **Acceptance Criteria**:
- [ ] The app boots to `'home'`; Learn opens the unchanged deck-select flow
- [ ] Review is **locked** until at least one word is mastered (no mastered `WordState` → disabled/locked control); once any word is mastered it unlocks
- [ ] When unlocked, the Review control shows a due-count badge sourced from `GET /api/reviews`, and opens even when the count is 0
- [ ] `App.vue` imports no `ts-fsrs`; existing Learn flow behaviour is unchanged

### EP38-ST06: Review session — question presentation & write-on-answer

**Scope**: Pool-global session — fetch due cards, resolve to `wordPool` items (skip orphans), build questions via the existing pipeline, present in `QuizCard`, capture latency, POST each answer, adopt the returned schedule, advance the queue. Client-side orchestration only; no rating, no `ts-fsrs`.
**Read List**: `apps/srs-demo/src/App.vue` (`startBatch` pipeline: `assembleBatch`/`initBatchState`/`nextQuestion`; `postAnswer` call site; `wordPool`), `apps/srs-demo/src/components/QuizCard.vue` (`answered`/`exit` emits, `QuizResult`), `apps/srs-demo/src/composables/useStore.ts` (ST05 `loadDueReviews`; add `postReviewAnswer`), `packages/api-contract/src/srs.ts` (DS01 `ReviewAnswerRequest`/`Response`, `ReviewQuestionType`), `packages/srs-engine-v2` (`assembleBatch`, `QuizQuestion`, `QuizResult`)
**Tasks**:

- [ ] Add `postReviewAnswer()` to `useStore.ts`; add review session refs (`dueReviews`, `reviewBatchState`, `reviewQuestion`, `reviewShownAt`) and `resolveDueItems`/`toReviewQuestionType` helpers
- [ ] `enterReview()`: `loadDueReviews` → `resolveDueItems` (skip orphans) → `assembleBatch(items, wordPool, [], items.length, {excludeIds: ∅})` → `initBatchState` → `nextQuestion`; set `reviewShownAt`; `screen = 'review'`
- [ ] Render `QuizCard` for `reviewQuestion`; on `answered`, compute `latencyMs`, POST via `postReviewAnswer` with the mapped `questionType`, adopt the returned `due`, advance to the next due question
- [ ] On `postReviewAnswer` failure, surface the error and do **not** advance past the failed word; on `exit`, return to `'home'`
      **Acceptance Criteria**:
- [ ] A due word is shown as an ordinary quiz question in the **same `QuizCard` UI** as Learning — **no self-rating prompt** appears (D5)
- [ ] Answering posts `{ wordId, correct, latencyMs, questionType }`; the client adopts the server-returned `due` and never computes a rating or interval (`App.vue`/frontend import no `ts-fsrs`)
- [ ] A due card whose word is absent from `wordPool` (orphan) is skipped and the session does not crash
- [ ] Write-on-answer: exiting mid-session preserves every already-answered card's advanced schedule server-side; re-entering Review reloads only the remaining due cards
- [ ] A failed `/api/reviews/answer` surfaces an error and does not advance the queue past that word (the answer is not silently dropped)

### EP38-ST07: Review session summary, caught-up state & exit

**Scope**: End-of-session summary (reviewed count / next-due horizon), an empty-due "caught up" state, and return to `'home'`; re-entry reloads remaining due cards.
**Read List**: `apps/srs-demo/src/App.vue` (ST06 review flow, `screen` template blocks, results-screen pattern), `apps/srs-demo/src/components/BatchResults.vue` (summary styling reference)
**Tasks**:

- [ ] Track `reviewed` count and the horizon `nextDue` (min/next of the adopted `due`s) across the session; on queue exhaustion render the summary with a return-to-`'home'` control
- [ ] When `resolveDueItems` yields an empty list, render a "caught up — nothing due" state (no questions), also returning to `'home'`
- [ ] Confirm returning to `'home'` and re-entering Review re-runs `loadDueReviews` so only still-due cards appear (partial-session resume)
      **Acceptance Criteria**:
- [ ] Completing all due reviews shows a summary (reviewed count + next-due horizon) and returns to `'home'`
- [ ] Entering Review with nothing due shows the caught-up state (not an error, not an empty crash) and returns to `'home'`
- [ ] After a partial session, re-entering Review shows only the cards still due (already-advanced ones dropped off), proving resume via `GET /api/reviews`
- [ ] No `ts-fsrs` import in the frontend bundle; the Learn flow remains unchanged

### Phase 3: Cross-screen navigation (EP38-PH03)

> Added after the ST05–ST07 build. Verification surfaced a navigation dead-end:
> the app is a state-`ref` SPA (`screen` union, no `vue-router`), and once the
> user follows **Learn** into `'select'` (or `'overview'`) there is **no way back
> to `'home'` or into `'review'`** — `DeckSelector`'s only exits lead deeper into
> a quiz. Only `'home'` can reach Review, and nothing can reach `'home'`. This
> phase adds a persistent nav menu so the three top-level destinations are always
> reachable. Decision: a **web-style top nav menu** (not a router) — it sets the
> existing `screen` ref, keeping the SPA architecture and leaving `vue-router` a
> separate, out-of-scope decision (§1).

### EP38-ST08: Persistent top nav menu (Home / Learn / Review)

**Scope**: A persistent web-style top navigation menu with three items — **Home**
(→ `'home'`), **Learn** (→ `'select'`), **Review** (→ `enterReview`) — rendered
above the screen content. The Review item **reuses ST05's gate and badge**:
disabled/locked (🔒) until any word is mastered (`reviewUnlocked`), and showing
the due-count badge (`dueReviewCount`, dash on `badgeError`) when unlocked. The
menu is **always visible** (every screen, including `'quiz'` and `'review'`) —
the conventional webapp pattern. Because it can be clicked mid-flow, navigating
away from an **active Learning quiz** must not silently drop answers: Learning
persists on batch-finish (not per-answer), so a `navTo` helper **flushes a
partial batch** (via the existing `finishBatchAndTransition` path) before
navigating. Review is **write-on-answer** (each answered card is already durable),
so leaving a review session via the menu needs no flush. Home stays the boot
landing; the menu adds cross-navigation on top of it. No `ts-fsrs` import; no
`vue-router`.

**Read List**: `apps/srs-demo/src/App.vue` (`Screen` union, `screen` ref,
`reviewUnlocked`/`dueReviewCount`/`badgeError`, `onReview`/`onLearn` handlers,
template screen blocks), `apps/srs-demo/src/components/HomeDashboard.vue` (Learn/
Review card + gate/badge markup to mirror), `apps/srs-demo/src/components/DeckSelector.vue`
(header styling reference)

**Tasks**:

- [ ] Add `NavMenu.vue` — props `{ active: 'home' | 'learn' | 'review', reviewUnlocked, dueCount, badgeError }`, emits `home` / `learn` / `review`; Review item disabled + 🔒 when `!reviewUnlocked`, badge (or dash) when unlocked
- [ ] Add an `activeNav` computed in `App.vue` mapping `screen` → nav group (`'home'`→home; `'select'`/`'overview'`/`'results'`→learn; `'review'`→review)
- [ ] Render `<NavMenu>` unconditionally (always visible, all screens)
- [ ] Add a `navTo(target)` helper: if leaving an **active quiz** with answered results, `await finishBatchAndTransition()` (persist) first, then go to `target`; Review needs no flush (write-on-answer). Wire nav emits to `navTo('home' | 'select' | 'review')`

**Acceptance Criteria**:

- [ ] From the deck-select screen (`'select'`) the user can navigate to **Home** and to **Review** via the menu (the reported dead-end is gone)
- [ ] From `'overview'` and `'results'` the menu is present and reaches all three destinations
- [ ] The Review menu item is locked (disabled/🔒) until a word is mastered, then shows the due-count badge — identical gate/badge behaviour to the home dashboard (ST05), sourced from the same computeds
- [ ] The menu is **always visible**, including during an active quiz and an active review question
- [ ] **No silent data loss**: answering a question then navigating away mid-batch via the menu persists that answer (server `WordState` reflects it) — a partial Learning batch is flushed before navigating; leaving a review mid-session is safe by write-on-answer
- [ ] `'home'` remains the boot landing; the existing Learn flow (`initSession`/`startBatch`/`postAnswer`) is unchanged; no `ts-fsrs` and no `vue-router` imported

## 6. Success Criteria

1. `srs-demo` boots to a `'home'` dashboard routing to Learn (unchanged deck flow) or Review; Review is locked until any word is mastered, then shows a due-count badge and opens even when nothing is due.
2. A Review session fetches pool-global due cards, resolves them against the preloaded cross-deck `wordPool` (skipping orphans), and presents them in the same `QuizCard` UI as Learning — with **no self-rating prompt**.
3. Each answer posts `{ wordId, correct, latencyMs, questionType }`, and the client adopts the server-returned schedule; it computes no rating or interval and imports no `ts-fsrs`.
4. Write-on-answer holds through the UI: exiting mid-session preserves every advanced card, and re-entry reloads only the remaining due cards (partial-session resume).
5. A failed review answer surfaces a typed error without silently dropping the answer or advancing past it; an orphaned due card never crashes the session.
6. No type errors; the existing Learning flow (`'select'`/`'quiz'`/`'results'`/`'overview'`, `postAnswer`) is unchanged.
7. An always-visible top nav menu makes Home / Learn / Review reachable from every screen (fixing the deck-select dead-end) and reuses the Review gate + due badge; navigating away from an active Learning quiz flushes the partial batch so no answer is lost (Review is write-on-answer). No `vue-router` is introduced.

## 7. Implementation Notes (20260709)

**Status: ST05–ST08 built and verified.** New components:
[`HomeDashboard.vue`](../../../apps/srs-demo/src/components/HomeDashboard.vue),
[`ReviewSummary.vue`](../../../apps/srs-demo/src/components/ReviewSummary.vue),
[`NavMenu.vue`](../../../apps/srs-demo/src/components/NavMenu.vue); `useStore`
gained `loadDueReviews`/`postReviewAnswer`; [`App.vue`](../../../apps/srs-demo/src/App.vue)
holds the `Screen` union (`+ 'home' | 'review'`, default `'home'`), the
`reviewUnlocked` gate, the review session refs/handlers, and the `navTo` helper.

**Deviations / additions from the original draft:**
- **ST08 (nav) was added after the ST05–ST07 build** — verification surfaced a
  navigation dead-end (deck-select could not reach Home/Review). See Phase 3.
- **Nav is always-visible with flush-on-leave**, not hidden during immersive
  flows. Initial build hid it during quiz/review; changed on request to the
  conventional always-visible webapp pattern, adding the partial-batch flush so
  no Learning answer is silently dropped (§ST08).

**Verification** (this DS has no unit tests — `srs-demo` is Playwright-BDD only):
verified by `vue-tsc` typecheck + a `ts-fsrs`/`vue-router` grep guard + a manual
Playwright drive against a real server. Confirmed end-to-end: boot→home, Learn→
deck-select, Review lock→unlock + due badge, a review question in the identical
`QuizCard` (no self-rating prompt), `POST /api/reviews/answer` advance +
summary, caught-up state, answer-failure halt (no queue advance), and the full
nav flow incl. flush-on-leave persisting a mid-batch answer.

**⚠️ e2e deferred (BDD `review.feature`).** Two reasons: `srs-demo` e2e is flaky,
and — the blocker — there is **no first-class way to seed a due review card**
(DS01 §7): cards seed with a future `due` and `/api/test/seed` doesn't cover
review cards, so a UI-only test can't reach a due state without backdating the DB.
Picking up review e2e should follow the DS01 recommendation (a test-only
seed-due-review endpoint). Tracked as a follow-up, not part of this DS.
