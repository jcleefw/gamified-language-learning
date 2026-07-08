# Current Focus — EP37 SRS Review in `srs-demo`

**Branch**: `EP37--srs-review-in-srs-demo`
**Last updated**: 20260708T020000Z

---

## Status

**Not started** — awaiting a design discussion + ADR. This epic was spun out of EP36-PH04
(Track B). EP36 (PH01–PH03: scheduler, store, CLI review loop) is Impl-Complete on branch
`EP36--srs-review`.

## Goal

Surface the Review phase in the interactive `srs-demo` (Vue) app — the DTOs, server route, and
Review UI that DS03 called Track B (stories ST10–ST12). **Do not implement against DS03's
server-authority wording as if settled** — see `recent-decisions.md`.

## First deliverable: an ADR (before any code)

The ADR must, in order:
1. **Ratify `srs-demo` Learning authority** — currently emergent/undocumented and contradicts EP15's
   server-authority ADR (see `recent-decisions.md`). No standing decision to be consistent with.
2. **Decide Review authority** — (A) server-authority vs. (B) client-authority parity. See the
   fork + refactor impact in `recent-decisions.md`.
3. **Settle cross-table integrity** — re-graduation overwrite, orphaned cards, split-brain. See
   `blocked-items.md`.

## Guardrails

- `cli-demo-db` is intentionally different (full local authority, direct-to-DB, server-free) and
  **stays as-is** — not a target of this epic.
- Integrity rules should land in the **store layer (`@gll/db`)**, not the Hono route, so the CLI
  (which bypasses the server) inherits them too.
- User has their own concerns for the design discussion — **ask, don't assume**; do not start code
  until that discussion happens.

## Next Steps

1. Design discussion with the user.
2. Draft the authority + integrity ADR.
3. Re-scope ST10–ST12 under the ADR outcome.
