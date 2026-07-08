# Blocked Items — EP36 SRS Review Phase

---

## Current blockers

### PH04 (`srs-demo` Review mode) — blocked on an architectural decision

- **Story**: ST10–ST12 (moved to a new epic).
- **Root cause**: DS03 assumed *server-authority* Review, but the app is *client-authority* for
  Learning (`srs-demo` runs the engine; server is persistence-only). The two must be reconciled.
  See `recent-decisions.md` for the full finding and the A/B fork.
- **What's needed**: an ADR resolving server-authority vs. client-authority parity (and whether
  `ts-fsrs` may enter the browser bundle). **Plus** a deeper design discussion the user wants to
  have first — the user has additional concerns ("a few pointers") not yet captured. Do not start
  Track B until that discussion happens.

---

## Unblocking history

- _(none yet)_
