# Idea Brief — Archive Tooling Automation

**Created**: 20260718T104755Z
**Source**: spun out of the Two-Axis Knowledge Architecture ADR (`product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md`) — these are *exploration ideas for future automation*, deliberately kept out of the ADR (which records firm decisions only).

---

### Core Idea

Once the `archive-epic` skill + `archive-check` script exist (per the ADR), automation could enforce and run them so the two-axis integrity is guaranteed rather than relied on by discipline. All ideas must stay LLM-agnostic and live under `.agents/` — the only provider-specific seam is a headless LLM call.

### Ideas

1. **CI enforcement of `archive-check`.** Run the consistency guard as a required GitHub Actions check on every PR (blocking merge on a broken invariant: an unresolved `sources` id, a completed epic that still has a live changelog folder, a `_loose/` item left undrained after its referenced epic was archived). It is a pure script → fully portable, no LLM. *Leaning yes.*

2. **Git-hook enforcement.** Also run `archive-check` as a local `pre-commit`/`pre-push` hook for fast feedback before CI. Open sub-question: how to install it agnostically — a tracked installer in `.agents/tools/` vs documented manual setup — without binding to a specific tool.

3. **Automated post-merge rollup.** The manual `archive-epic` run is the day-one default (it doubles as the human "this is done-done" gesture). If automated rollup is ever wanted, a merge-to-main trigger could invoke the judgment step headlessly and open a bookkeeping change. The headless LLM invocation is the single provider-specific seam — keep it behind one configurable command so swapping CLIs is a one-line change.

### Status

Exploration only. Not scheduled. Revisit after the manual `archive-epic` skill and `archive-check` script are built and proven.

### Related

- ADR: `product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md` (Tooling section)
- ADR: `product-documentation/architecture/20260718T021231Z-agentic-ds-lifecycle-compaction.md`
