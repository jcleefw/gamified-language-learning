# Current Focus — EP36 SRS Review Phase

**Branch**: `EP36--srs-review`
**Last updated**: 20260708T014500Z

---

## Status

**EP36 — Impl-Complete (PH01–PH03)** · **PH04 spun out to a new epic** (pending an authority ADR)

---

## Completed (ST01–ST09)

| Phase | Stories | Summary |
| --- | --- | --- |
| PH01 (DS01) | ST01–ST03 | `@gll/srs-review` pure package — `ReviewScheduler` + `FsrsScheduler` (only `ts-fsrs` import; removed from `srs-engine-v2`). |
| PH02 (DS02) | ST04–ST05 | `ReviewStore` + `SqliteReviewStore` in `@gll/db`; `review_cards(user_id, word_id, due, scheduler_data)` PK `(user_id, word_id)` — one card per word per user, global across decks; deck scope is a JOIN via `deck_words`. |
| PH03 (DS03 Track A) | ST06–ST09 | CLI review loop in `apps/cli-demo-db`: graduation seeding (`seedGraduatedReviewCards`), `review-runner-db.ts` (`engine:review`, deck/pool, write-on-answer), `inferReviewRating` (ST08), mock seeder (`engine:review:seed`). |

**Commit**: `6dd6e04` (PH03 code), `207febc` (EP36 doc wrap-up). cli-demo-db suite 59/59 green; typecheck clean; end-to-end loop verified.

---

## Key Technical Notes

- The engine's `GraduationHook` already passes `runState` as its 2nd arg — the CLI runner seeds review cards in `onGraduation` with **no engine change** (`learning-runner-db.ts`).
- `@gll/db` and `@gll/srs-review` are consumed as built `dist/` — **rebuild them after any source change** or consumers get stale exports (DS02's dist was stale, missing `SqliteReviewStore`).
- Rating inference (`inferReviewRating`) lives in the app layer (`cli-demo-db`), never in the scheduler (ADR D5). Generous defaults: ≤4s easy, ≤12s good, else hard; wrong → again.

---

## Next Steps

- **New epic for PH04** (`srs-demo` Review mode) — first deliverable is an ADR that must (1) ratify
  `srs-demo` Learning authority (currently emergent/undocumented, contradicts EP15), then (2) decide
  Review authority, then (3) settle cross-table integrity (re-graduation, orphans, split-brain).
  See `recent-decisions.md` (the authority finding) and `blocked-items.md` (full ADR checklist).
- cli-demo-db is intentionally different (full local authority) and **stays as-is** — not a target
  for the demo's authority decision.
- User has flagged **their own concerns for a deeper design discussion** before Track B starts —
  do not begin implementation until that happens.
