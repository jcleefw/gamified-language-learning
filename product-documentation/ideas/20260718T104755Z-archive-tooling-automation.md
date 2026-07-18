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

4. **Reviewable deletion via manifest + GitHub Action.** *(Spec kept, not built — AGN05 decision, 2026-07-18.)* The day-one compaction mechanism is simpler: `archive-epic` lands the folder `git rm` as a **self-contained commit**, separate from the additive record commit, so the destructive step can be reviewed and reverted on its own (Two-Axis D10 as amended). A heavier future variant: the rollup PR carries only the additive writes plus a **deletion manifest**, and a GitHub Action performs the `git rm` from that manifest after merge. Rejected for day-one because it *hides* the deletion from the review diff (the reviewer approves a manifest, not the removal) — but retained here as the spec to reach for if deletions ever need to execute in an environment the author can't touch directly.

### Status

Exploration only. Not scheduled. Revisit after the manual `archive-epic` skill and `archive-check` script are built and proven. As of AGN05 (2026-07-18) the manual script exists; CI/pre-commit enforcement (ideas 1–2) and the manifest+Action deletion (idea 4) remain deferred — there is no live CI wired, and a declarative `guardrails.yml` entry would be a no-op until an adapter (git hook / CI) runs `archive-check`.

### Related

- ADR: `product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md` (Tooling section)
- ADR: `product-documentation/architecture/20260718T021231Z-agentic-ds-lifecycle-compaction.md`
