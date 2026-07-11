# Current Focus — Review Mode Fresh Redo (EP38 + EP39 docs)

**Branch**: `docs/EP38-EP39-review-reorg` (worktree at `../gll-EP38-EP39-reorg`)
**Base**: `main` @ b2487dd (EP37) — fresh, NOT stacked on the reference branch
**Reference branch (read-only)**: `EP39--review-mode-redesign` (holds the delivered code + original messy docs; untouched)
**Last updated**: 20260711

---

## Goal

Redo the **documentation** for review mode as if designed fresh. EP38 and EP39 were authored
back-to-back on one unmerged stack (EP38→39→40→41, none on main), and EP39 had reversed several of
EP38's own interim decisions. The user wants clean docs, not the archaeology.

## Decisions that shaped this (from the user, in order)

1. **Docs only** — no code changes. Code stays on the reference branch.
2. **Two epics, not one** — keep EP38 (foundation) + EP39 (delta) as separate epics. (User picked this
   over "one consolidated epic" even under the fresh framing.)
3. **Fresh lens** — strip ALL "this is a redesign / reverses / amends / EP38-shipped-then-fixed"
   narrative. Write every doc as a first-time design.
4. **Base off `main`**, drop EP40/EP41 entirely. Focus only on 38 & 39.
5. **Commit the ADR by itself first**, then the rest.
6. Record the **deferred review modes** (Difficult Words, Speed Review, retry loop, typing/listening)
   in the ADR — the mode hub is designed to host them.

## Key framing trick (avoids the "reversal" story with two epics)

EP38's due-review session **only ever fetches due cards**, so "advance FSRS on every answer" is correct
*within EP38's scope*. EP39 introduces **not-due (eager) answers** for the first time and the
**due-gate** (`advance iff due at answer time`, server-derived) that distinguishes them. So EP39
**extends** EP38's endpoint — it does not reverse it. Use this framing consistently.

## What's committed (3 commits on this branch)

- `1cfdc6f` — **ADR** alone: `…/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md`
  (review-ahead + due-gate + **Deferred Review Modes** section). Reframed from "Amends" the due-only
  ADR to "Relates to" it (FSRS mechanics only).
- `7463a1d` — **product inputs**: idea brief (`…/ideas/20260709T142309Z-review-mode-redesign.md`),
  gap analysis + requirements spec (`…/research/20260709T143330Z…` and `…143156Z…`). All fresh voice;
  gap analysis "Current" column reframed to the pre-review **baseline**, not shipped EP38.
- `0726164` — **two epics**: `.agents/plans/epics/EP38-review-mode-srs-demo.md` (fresh foundation) +
  `EP39-review-mode-redesign.md` (fresh eager-practice/feedback/hub/seeding delta).

## DS specs — DONE (5 fresh specs + seeding ADR)

Written fresh, matching the **actual shipped implementation** (code read from the reference branch at
the **EP39 tip `9b56cda`**, before EP40/EP41 touched config/identity — so snippets are EP38/EP39
as-shipped, real code not sketches). User directive: "the writing should match [the implementation],
just copy the code from the reference branch." Status on all five: **Impl-Complete**.

- `a95a6d2` — **seeding ADR** brought in fresh (alone): `…/architecture/20260710T090706Z-…fsrs-seeding-snapshot-builder.md`.
- DS commit (below) — 5 specs:
  - EP38-DS01 (server read/advance/record — **EP38 form**, no due-gate; due-gate is EP39)
  - EP38-DS02 (landing + `useReviewSession` + nav + summary — composable from the start, folds the
    reference's separate DS03 composable-refactor away; unlock gate = mastery-only, EP39 broadens it)
  - EP39-DS01 (due-gate + anytime endpoint + `orderAnytimeBatch` + migration 0009 nullable rating)
  - EP39-DS02 (MCQ feedbackDwell + ReviewHub + Practice Anytime + `hasReviewCards` broadened gate
    [folds EP39-BUG01 in as the final gate form] + advanced tally)
  - EP39-DS03 (snapshot builder + `pnpm seed` CLI; ties to the seeding ADR)
- EP39 epic bumped **Accepted → Impl-Complete**, ACs checked, Next-Steps DS links added.

Key faithful-split decisions:
- Reference `reviews.ts` merges EP38 base + EP39 due-gate. DS01(EP38) shows the pre-gate form;
  EP39-DS01 shows the due-gate branch. Truthful because EP38's due session only serves due cards.
- Dropped the reference's EP38-DS03 (App.vue composable refactor) and EP39-BUG01 as standalone docs —
  fresh lens describes their END STATE inside DS02s (useReviewSession from day one; card-based unlock).

## Next steps (optional)

1. Decide whether to update global auto-memory `MEMORY.md` pointer.
2. Optional: rename product-doc/DS filename slugs to drop "-redesign-" (kept stable for clean replace).

## Open items / caveats

- **Seeding ADR**: now brought in fresh (`a95a6d2`); EP39-DS03 links it.
- **On-main due-only wording**: `20260321T145300Z-…review-phase.md` (on main) still says review is
  due-only. New ADR "Relates to" it rather than amending. Left main-owned doc alone; light touch needed
  if full self-consistency wanted.
- **Filenames still contain `-review-mode-redesign-`**: kept stable for clean replacement vs the
  reference branch. User may want slugs renamed to drop "redesign".
- Reference DS bodies (endpoint shapes, store methods) live on `EP39--review-mode-redesign` — read via
  `git show EP39--review-mode-redesign:<path>` when writing the fresh DS specs.
