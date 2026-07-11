# EP39-BUG01: Review tab locked despite due cards; due count reflects scheduling, not mastery

**Date**: 20260710T081044Z
**Status**: Symptom 1 Fixed · Symptom 2 Explained (no defect)
**Epic**: [EP39 — Review Mode Redesign](../../plans/epics/EP39-review-mode-redesign.md)
**Type**: Bug Fix

---

## 1. Problem Statement

Two related symptoms, both surfaced while seeding review state through
[`/api/test/seed`](../../../apps/server/src/routes/test-seed.ts):

### Symptom 1 — Review tab is **locked** in the UI even though a card is due

Running the seed resets the DB and reports a due card on the server, yet the review tab
stays locked in the app:

```bash
curl -s http://localhost:6060/api/reviews
{"success":true,"data":{"reviews":[{"wordId":"0a0c5ef3-…","due":"2026-07-08T22:03:08.936Z"}]}}
# → /api/reviews has a due card, but the UI Review card shows 🔒 (locked)
```

### Symptom 2 — Due review shows only **1 word** even with more than one word mastered

The due list surfaces a single word regardless of how many words have been mastered.

---

## 2. Root Cause

### Symptom 1 — the unlock gate is decoupled from review-card state

The client's `reviewUnlocked` gate is derived **solely from Learning mastery state**, with no
reference to whether any review card exists or is due:

[`apps/srs-demo/src/composables/useReviewSession.ts:49`](../../../apps/srs-demo/src/composables/useReviewSession.ts#L49)
```typescript
const reviewUnlocked = computed(
  () =>
    configReady.value &&
    [...globalRunState.value.values()].some((ws) =>
      isMastered(ws, CONFIG.value.masteryThreshold),   // masteryThreshold = 2
    ),
);
```

`globalRunState` is the Learning `user_word_states` snapshot. The `review_cards` table is a
**separate** persistence surface. The seed route populates the two from **independent** fixture
fields (`wordStates` vs `reviewCards`) and can set them inconsistently — and the
documented recipe for exercising Review mode does exactly that:

[`apps/srs-demo/README.md:112`](../../../apps/srs-demo/README.md#L112)
```jsonc
{ …, "wordStates": [], …, "reviewCards": [{ "wordId": "$WORD" }] }
//        ^^ empty — no mastered word state is seeded
```

So after seeding: `/api/reviews` returns a due card (from `review_cards`), but `globalRunState`
has **no** word with `mastery >= 2`, so `reviewUnlocked` is `false` and the tab is locked.

Compounding it: the due-count badge is only fetched **when already unlocked** —
[`useReviewSession.ts:77`](../../../apps/srs-demo/src/composables/useReviewSession.ts#L77)
(`if (!reviewUnlocked.value) return;`) — so a locked-but-due state also never loads its count.

**The invariant that's missing:** if the user has *any* review card, Review should be reachable.
Graduation is the only door into `review_cards` ([answer.ts:119](../../../apps/server/src/routes/answer.ts#L119)),
so in real play mastery and cards co-exist and the gate *happens* to work — but the gate is
testing the wrong fact (past mastery), not the fact that matters (does a card exist / is one due).

### Symptom 2 — "due" reflects FSRS scheduling, not mastery count

Graduation seeds a review card whose `due` is the FSRS **initial interval** — a *future* date, not
"now":

[`packages/srs-review/src/FsrsScheduler.ts:43`](../../../packages/srs-review/src/FsrsScheduler.ts#L43)
```typescript
seed(wordId, performance, now): ReviewCard {
  const fresh = createEmptyCard(now);
  const { card } = this.engine.next(fresh, now, /* good */ grade); // due = now + first interval (days)
  …
}
```

`GET /api/reviews` filters `due <= now` ([sqlite-review-store.ts:74](../../../packages/db/src/sqlite-review-store.ts#L74)),
uncapped and ordered by `due` asc.

**Measured** (FsrsScheduler.seed, verified in
[sqlite-review-store.test.ts](../../../packages/db/src/__tests__/sqlite-review-store.test.ts) —
"3 words graduated today are 0 due now but all 3 due by 8 days later"):

| Graduation | First `due` |
| --- | --- |
| "good" (`correctStreak: 2`) | **+3 days** |
| "easy" (`correctStreak: 5`) | **+8 days** |

So mastering *N* words creates *N* cards all scheduled **in the future** — **0 due today, 0
tomorrow**, and (for identical performance) **all N due together** once the interval elapses. The due
list is **not capped**, so there is no code path that yields "only 1 of 3". The mismatch is
conceptual — **"mastered" ≠ "due today"** — and expected FSRS behaviour, not a logic defect.

**Correction to the original report:** the observed "only 1 due" is therefore **not** produced by
mastering 3 words today (that gives 0 today, then 3 together on day 3/8). The lone due card was
almost certainly an **older card that had reached its own due date** — i.e. the words were mastered
on different days, so only one had crossed its horizon. EP39's **Practice Anytime** mode is the
intended remedy for wanting to review learned words before they are due.

### Impact

- A due review card is unreachable from the UI whenever mastery state doesn't independently satisfy
  the gate — including the project's own documented seed recipe (`wordStates: []`).
- The due badge/count silently never loads in that state (gated behind the same flag).
- Users perceive "I mastered several words but only 1 is due" as data loss, when the others are
  simply scheduled ahead.

---

## 3. Proposed Fix (plan — not yet applied)

### Fix 1 (primary) — unlock Review when a review card exists, not only on live mastery

Make `reviewUnlocked` reflect review-card reality. Two options:

- **3a (recommended):** unlock when `configReady && (anyMasteredLocally || (dueReviewCount ?? 0) > 0
  || hasAnyReviewCard)`. Requires a cheap "has any card" signal — either reuse the anytime/`due`
  fetch or add a lightweight count. Keep the mastery path as a fast local pre-unlock so a
  freshly-graduated session unlocks without a round-trip.
- **3b (minimal):** decouple the **badge fetch** from the gate — always `refreshDueBadge()` at boot
  (it already tolerates errors), and treat `dueReviewCount > 0` as an unlock condition. This fixes
  the seed/locked-tab case with the least surface area.

Either way, `refreshDueBadge()` must no longer early-return purely on `!reviewUnlocked`, or the
count can't participate in the unlock decision (chicken-and-egg). Sequence the boot fetch so the
count is known before the gate is evaluated.

> Note: EP39 already lands a **review hub** that is always reachable via `navTo('review')`
> regardless of due-count; the remaining defect is the **lock gate on the entry cards** (Home's
> Review card + the hub's mode cards), which still keys on mastery alone.

### Fix 2 (secondary / UX) — make the mastered-vs-due distinction legible

- **Practice Anytime (already built in EP39-DS02)** is the primary remedy: it serves *all* learned
  words regardless of due-ness. Ensure its entry card is unlocked under the same corrected gate
  (Fix 1), so a user with future-due-only cards can still practise.
- Optionally surface "N learned · M due" so "only 1 due" reads as scheduling, not loss.

### Fix 3 (tooling/docs) — stop the seed from producing an inconsistent, locked state

- Update the README seed recipe to also seed a mastered `wordState` for the same `wordId` (so the
  gate is satisfied the way real graduation satisfies it), **or**
- Have the `reviewCards` seed branch upsert a companion mastered `user_word_states` row by default
  (a review card implies a graduated/mastered word), keeping the two surfaces consistent.

---

## 3b. Fix Applied (Symptom 1)

`reviewUnlocked` now unlocks on **`mastered-locally || hasReviewCards`**
([useReviewSession.ts](../../../apps/srs-demo/src/composables/useReviewSession.ts)). `hasReviewCards`
is sourced from `/api/reviews/anytime` via a new `refreshReviewAvailability()`, and `refreshDueBadge()`
is no longer gated on the unlock flag (so the count loads and can feed availability). Both are fetched
at boot and on entering the review tab ([App.vue](../../../apps/srs-demo/src/App.vue)). Tests:
useReviewSession "unlocks when the user has review cards even if no word is mastered locally" /
"stays locked when there are neither".

Symptom 2 needs **no code change** — it is expected FSRS scheduling (§2, measured). The remedy is
already shipped (Practice Anytime) and now reachable under the corrected gate.

### Tooling (Fix 3) — named review scenarios

`POST /api/test/seed/scenario` ([test-seed.ts](../../../apps/server/src/routes/test-seed.ts)) builds
the exact discussed states from real deck words in one call: **`mastered-fresh`** (0 due today, N in
anytime), **`mastered-due`** (N due now), **`review-only`** (cards but no mastery — the Symptom-1
repro; must unlock). Returns `{ wordIds, expected }` for manual/e2e assertions. Documented in the
[srs-demo README](../../../apps/srs-demo/README.md).

## 4. Acceptance Criteria (for the fix)

- [x] With a DB that has a review card but no locally-mastered word state, the Review entry is
      **unlocked** and the due badge shows the correct count (`review-only` scenario; unit test).
- [x] `refreshDueBadge()` loads the count at boot without depending on a mastery-only gate.
- [x] Practice Anytime is reachable whenever any review card exists, even if none is due today
      (`hasReviewCards` unlock).
- [x] Real graduation flow still unlocks Review — the local mastery path is retained (no regression).
- [x] A one-call scenario (`mastered-fresh` / `mastered-due` / `review-only`) reproduces each state
      without hand-authoring a fixture; the old README recipe is superseded.
- [x] The "only 1 due" case is explained (measured FSRS scheduling) and made actionable via Practice
      Anytime — mastering more words never reads as lost data.

---

## 5. Related

- **EP39-DS02** (client hub + Practice Anytime) — the always-reachable hub and the anytime path are
  the structural half of this fix; this bug is the remaining lock-gate correction on the entry cards.
- **`db3bd20`** — the `reviewCards` seed fixture whose documented usage (`wordStates: []`) reproduces
  Symptom 1.
- Governing ADR: [Review-Ahead & Due-Gated Advance](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md).
