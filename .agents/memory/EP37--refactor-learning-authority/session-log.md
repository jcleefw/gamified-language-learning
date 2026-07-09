# Session Log — EP37 SRS Review in `srs-demo`

---

## 20260708 — Epic spun out; pre-ADR investigation

**Goal**: Interrogate how the Review phase fits `srs-demo` before starting Track B.

**Findings**:
- `srs-demo` is client-authority for Learning (runs the engine in the browser); the Hono server is a
  thin persistence bridge (`/api/state/word` stores a client-computed `WordState`). DS03's
  server-authority premise for Review conflicts with this.
- **Doc archaeology**: that client-authority was never decided — it's emergent drift from EP24 +
  EP31 and contradicts EP15's server-authority ADR (still Impl-Complete on paper). See
  `recent-decisions.md`.
- Cross-table integrity gaps surfaced (no FKs): re-graduation overwrite, orphaned review cards,
  Learning/Review split-brain. See `blocked-items.md`.

**Outcome**: EP36 closed at PH01–PH03; Track B moved here (EP37). This epic starts with an ADR that
ratifies Learning authority, decides Review authority, and settles integrity — pending a design
discussion with the user.

**Blockers**: whole epic blocked on that discussion + ADR (see `blocked-items.md`).

**Next session**: run the design discussion, then draft the ADR.
