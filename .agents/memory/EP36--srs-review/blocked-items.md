# Blocked Items — EP36 SRS Review Phase

---

## Current blockers

### PH04 (`srs-demo` Review mode) — blocked on an architectural decision

- **Story**: ST10–ST12 (moved to a new epic).
- **Root cause**: DS03 assumed *server-authority* Review, but `srs-demo` is *client-authority* for
  Learning (runs the engine in the browser; server is a thin persistence bridge). Crucially, that
  Learning client-authority was **never a decision — it's emergent and contradicts EP15's
  server-authority ADR** (see `recent-decisions.md`). So there is no ratified baseline to make
  Review consistent with.
- **What the new epic's ADR must cover** (in order):
  1. **Ratify Learning authority for `srs-demo`** (currently undocumented; EP15 says server-authority,
     code is client-authority). cli-demo-db is intentionally different (full local authority) and stays.
  2. **Decide Review authority**: (A) server-authority — server gains `@gll/srs-review` + scheduler +
     rating inference; graduation seeding needs the mastery threshold moved into the contract/server
     (it currently lives client-side). (B) client-authority parity — `srs-demo` runs `FsrsScheduler`
     (ships `ts-fsrs` in the browser, violates the "frontend never imports ts-fsrs" ADR goal).
  3. **Cross-table integrity** (user's Q1–Q3; no FKs / no PRAGMA foreign_keys today):
     - Re-graduation policy: `upsert` currently **overwrites** a live review card (resets FSRS
       progress). Recommend **ignore-if-exists**.
     - Orphan policy on word deletion: `getDueReviewCards` doesn't join `words`, so orphaned cards
       stay "due" forever; the CLI runner silently skips them. Readers must tolerate orphans until a
       cleanup story lands.
     - Split-brain: nothing prevents a word being in Learning (`user_word_states`) and Review
       (`review_cards`) simultaneously if the Learning table is corrupted/reset.
     - Integrity rules should live in the **store layer (`@gll/db`)**, not the Hono route — else the
       CLI (direct-to-DB, server-bypassing) won't get them.
- **Also blocked on**: a deeper design discussion the user wants first. Do not start Track B until
  it happens.

---

## Unblocking history

- _(none yet)_
