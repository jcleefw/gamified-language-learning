# Blocked Items — EP37 SRS Review in `srs-demo`

---

## Current blockers

### The whole epic — blocked on a design discussion + ADR

- **Story**: ST10–ST12 (Track B, inherited from EP36-PH04).
- **Root cause**: DS03 assumed *server-authority* Review, but `srs-demo` Learning is
  *client-authority* — and that Learning authority was **never a decision; it's emergent and
  contradicts EP15's server-authority ADR** (see `recent-decisions.md`). No ratified baseline exists
  to make Review consistent with.
- **What the ADR must cover** (in order):
  1. **Ratify Learning authority for `srs-demo`** (currently undocumented; EP15 says server, code is
     client). `cli-demo-db` is intentionally different (full local authority) and stays.
  2. **Decide Review authority** — (A) server-authority (move the mastery threshold into the
     contract/server; server gains scheduler + inference) vs. (B) client-authority parity (ships
     `ts-fsrs` in the browser, breaks the "frontend never imports ts-fsrs" goal).
  3. **Cross-table integrity** (no FKs / no `PRAGMA foreign_keys` today):
     - Re-graduation: `upsert` currently **overwrites** a live review card (resets FSRS progress).
       Recommend **ignore-if-exists**.
     - Orphans: `getDueReviewCards` doesn't join `words`; deleted-word cards stay "due" forever; the
       CLI runner silently skips them. Readers must tolerate orphans until a cleanup story lands.
     - Split-brain: nothing stops a word being in Learning (`user_word_states`) and Review
       (`review_cards`) at once if the Learning table is corrupted/reset.
     - Put integrity rules in the **store layer (`@gll/db`)**, not the Hono route — else the CLI
       (direct-to-DB) won't get them.
- **Also blocked on**: a design discussion the user wants first (they have their own concerns not yet
  captured — ask, don't assume). Do not start implementation until it happens.

---

## Unblocking history

- _(none yet)_
