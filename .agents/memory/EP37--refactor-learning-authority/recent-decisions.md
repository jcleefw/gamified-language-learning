# Recent Decisions — EP37 SRS Review in `srs-demo`

> Keep the last 3 entries; archive older ones per `.agents/memory/README.md`.

---

## FINDING: `srs-demo` Learning authority is emergent, not decided — 20260708T020000Z

Doc archaeology (prompted by the user asking whether "Learning is client-authority" is a decision or
an assumption). **It is an assumption / emergent drift, not a recorded decision — and it contradicts
the last written authority decision.** The server was *originally designed for server-authority* and
the implementation drifted to a thin persistence role without overturning that on paper.

Paper trail:
- **Headless Hono ADR (2026-03-03)**: server "calls the extracted engines and maps output to JSON" → server-authority intent.
- **Quiz Contract & Answer Authority ADR (2026-03-13, EP15, Impl-Complete)**: explicit decision — "the server owns the quiz from question generation through answer verification" (client sends `selectedKey`; server runs `processAnswers`). **server-authority, shipped.**
- **srs-engine-v2 Learning ADR (2026-03-19)**: new *pure library*; "persistence is the calling layer's concern," "RunState ephemeral — persistence deferred," "Hono server remains untouched until engine is solid." → **deferred** authority; did NOT decide client-authority.
- **EP24 (2026-05-11)**: Vue demo to make the engine "observable in a browser"; backend explicitly OUT OF SCOPE; engine ran client-side w/ localStorage — a demo choice, not an authority decision.
- **EP32**: v1 cleanup deleted the old `/api/srs/*` server-authority endpoints.
- **EP31 (2026-06-23, Impl-Complete)**: replaced localStorage by "retrofitting `apps/server` as an HTTP bridge" *because `better-sqlite3` can't run in a Vite browser bundle*. Server became a **thin persistence bridge**; engine stayed client-side.

**So**: today's `srs-demo` Learning = client-authority is a *consequence of a persistence constraint*
(better-sqlite3 not browser-safe) + a demo precedent, never a ratified architecture. EP15's
server-authority ADR is still Impl-Complete on paper, silently superseded. The v2 ADR's "calling
layer's concern" line **sanctions** cli-demo-db and srs-demo behaving differently — they are different
consumers, not replicas (user's point).

**Consequence for this epic's ADR**: FIRST ratify Learning authority for `srs-demo` (currently
undocumented + contradicting EP15), THEN decide Review authority on that baseline. The real gap is
not "Learning client vs Review server" — it's that Learning's authority has no standing decision to
be consistent with. See [[blocked-items]].

---

## Spin Track B out of EP36 into this epic (EP37) — 20260708T014500Z

DS03 §2 framed Track B as *server-authority* (server owns `FsrsScheduler` + store + rating inference;
frontend never imports `ts-fsrs`), but that conflicts with the app's actual (emergent)
client-authority Learning. Track A (CLI, ST06–ST09) shipped as a complete vertical, so EP36 closed at
PH01–PH03 and Track B (ST10–ST12) moved here — first step an ADR, not implementation.

**Authority fork the ADR must resolve**:
- (A) Review = server-authority: server gains `@gll/srs-review` + scheduler + inference; graduation
  seeding needs the mastery threshold moved into the contract/server (it lives client-side today).
  Clean `ts-fsrs` isolation; asymmetric with Learning; injects domain logic into the persistence route.
- (B) Review = client-authority parity: `srs-demo` runs `FsrsScheduler` (ships `ts-fsrs` in the
  browser, violates the "frontend never imports ts-fsrs" ADR goal); server stays thin; symmetric.
