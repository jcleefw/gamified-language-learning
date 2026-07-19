# ADR: Package-Scoped Knowledge Filtering

**Status:** Accepted

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->

**Date:** 2026-07-18

**Revised:** 2026-07-19 — rewritten to reflect the `ryoiki` rename (was `facet`), a **curated-seeded** alias map (was empty/lazy), and the removal of the speculative read-side/automation tooling. Prior deliberation history lives in git.

**Deciders:** JC Lee / PO

**Epic:** N/A — surfaced while reviewing the original AGN06 draft (rejected; see Context)

**Relates / Amends:** [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md) — **refines its D1**. D1 named the within-unit sub-structure `concern` and left it free-form. This ADR renames that axis `ryoiki`, keeps it free-form (no controlled vocabulary), and gives it a concrete model: path notation, a curated alias map, surfaced as `KNOWLEDGE.md` section headings, filtered include-by-default via a per-unit blacklist.

---

## Context

The originating problem is narrow and sits at **write time**: `KNOWLEDGE.md` compaction (AGN05's `archive-epic`) should be able to **not record** incidental aspects of a unit. Concretely — `apps/srs-demo`, a demo app, shouldn't have its `KNOWLEDGE.md` cluttered with build-tooling/packaging plumbing every time a compaction runs. That is noise, not domain state worth keeping current.

The original AGN06 draft answered this by designing the *read* side first: a central registry of allowed topics, a `package.json` field declaring which a package owns, and a lookup tool returning inclusion/exclusion sets. It was rejected before implementation. With no retrieval consumer actually querying this data, there was no way to tell whether the generated categorization was correct — the registry, config field, and lookup tool were scaffolding built ahead of any consumer that could validate them. It also overloaded `domain`, a word the Two-Axis ADR already fixed to mean *workspace unit*.

This ADR keeps the problem write-time-shaped and builds only what the one live consumer (`archive-epic` compaction) needs. The data it authors — path-notated aspect tags, a curated alias map, a per-unit blacklist — is graph-ready, so a future read-time consumer (Graph RAG, its own ADR) adds a *reader* without reshaping anything built here.

## Decision

A workspace unit's knowledge is scoped by **ryoiki** — free-form, path-notated aspect tags — with **include-by-default** filtering driven by a small per-unit **blacklist**. Built write-time-first; read-time is deferred.

- **D1 — `ryoiki` is the within-unit axis.** A ryoiki is "a distinct aspect of one unit." It is the axis Two-Axis D1 called `concern`, renamed to a word with no prior meaning in the repo (avoiding the `domain`/`concern` overloading that sank the original draft) and given the model below. Distinct from `domain` (= workspace unit). The archive schema now carries `domain` + `ryoiki` per story; `concern` is gone.
- **D2 — Free-form strings + a curated alias map.** No controlled vocabulary, no rejection gate. A global alias/canonicalization table (`.agents/reference/ryoiki-aliases.json`) heals naming drift. It **ships curated-seeded** with the aspects that already recur across the repo's packages and apps — the `archive-epic` naming step consults it *first*, so a match means the canonical name is already decided. It grows only by human ratification at the review gate; no tool writes it.
- **D3 — Hierarchy via path notation (materialized path).** `spaced-repetition/fsrs/parameters`. A ryoiki stays a plain string; prefix-matching does all hierarchy work; losslessly convertible to graph edges later. Single-parent tree only — genuine cross-linking (DAG) is the signal to graduate to an edge registry (future).
- **D4 — A ryoiki tag IS a `KNOWLEDGE.md` section heading.** No separate tag store; hierarchy = heading-path depth. Consistent with Two-Axis D5 (doc organized by area).
- **D5 — Include-by-default; a cascading blacklist is the only maintained control.** An unconfigured unit is fully included. The blacklist names coarse ryoiki nodes; exclusion cascades to descendants. The "what's *in*" view is **read off the headings minus the blacklist**, never hand-maintained. Rationale: for a knowledge-*preservation* system, a false-include (kept some noise) is far cheaper than a false-exclude (silently lost real knowledge); whitelists go stale and drop knowledge nobody re-listed.
- **D6 — Include/exclude are cascading carve-outs, longest-prefix-wins.** Exclude is not a complement set; a deep path appears in the list only to carve one branch out of (or into) a coarser declaration. Most-specific declaration wins.
- **D7 — Blacklist lives in `KNOWLEDGE.md` frontmatter; alias map is global.** Node-local control co-located with the content it shapes; cross-unit drift table centralized. Not `package.json` (an npm build/publish contract is the wrong home), not a per-unit sidecar (splits tags from control).
- **D8 — Populate forward, during `archive-epic` compaction, behind a human review gate.** No upfront per-unit seed, no wizard, no backfill. The skill *proposes* ryoiki (from the unit's headings + `CODEMAP.md` separations, normalized through the seeded alias map) and *stops for human confirm/correct* before writing. Allocation is judgment, not mechanics.
- **D9 — Exclusion is a lossy write-time projection; the blacklist is the single source of truth.** Blacklisted ryoiki are never written, so they live only in git; un-blacklisting affects future work only. Tolerable because the blacklist self-selects for code-self-documenting noise (build config lives in `vite.config.ts`/`package.json`) and git backstops recovery. **No tombstone** — no `excluded_ryoiki` list anywhere.
- **D10 — No filtering or maintenance tooling is built.** The originating need is met by the frontmatter blacklist + the review gate alone. Explicitly **not built** (all speculative ahead of a read consumer): a derive-the-in-set helper, a cross-unit drift/orphan check, an alias-candidate scanner over the archive, and a dedicated alias-mapping skill. The curated seed (D2) plus the review gate (D8) cover naming without any of them.
- **D11 — Build write-time only; one mechanism spans apps and packages.** The same per-unit declaration serves write-time suppression (live consumer: compaction) and, later, read-time filtering (latent consumer: Graph RAG — graph edges from paths, the alias map as query-synonym resolver, ryoiki-scoped queries), which is deferred to Graph RAG's own ADR. No read-side lookup, filter, or registry now. No app-vs-package structural difference: every unit gets ryoiki-as-headings + a frontmatter blacklist + include-by-default.

**Amends Two-Axis D1.** D1 kept the within-unit axis free-form pending retrieval-layer query patterns. This ADR keeps that stance (still free-form, still no controlled vocabulary) and fills in *how* within-unit structure is expressed and filtered at write time, renaming the axis `concern` → `ryoiki`.

## What is built vs. deferred vs. rejected

**Built now (write-time slice, live consumer = `archive-epic`):**

1. Optional `blacklist: [ryoiki-path, …]` in `KNOWLEDGE.md` frontmatter — cascading, longest-prefix-wins, absent = fully included (D5). Documented in `KNOWLEDGE-TEMPLATE.md`.
2. Curated global alias map at `.agents/reference/ryoiki-aliases.json` (D2).
3. `archive-epic`'s RECORD step: propose ryoiki (headings + `CODEMAP.md`, normalized through the alias map) → **stop and confirm** → apply the blacklist so compaction skips blacklisted sections (D8).

**Deferred (read-time slice — Graph RAG's own ADR):** ingestion expanding paths into graph edges; the alias map as query-synonym resolver; read-time filtering by ryoiki. Phase-1 artifacts need no reshape for this.

**Rejected / not built (D10):** any registry of allowed ryoiki; any read-side lookup/filter tool; a derive-view helper; a cross-unit drift/orphan check; an archive alias-candidate scanner; a dedicated alias-mapping skill; a `package.json` field; any inclusion-set materialization; any tombstone.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| Original AGN06 (central registry + `package.json` field + read-side lookup) | Builds read machinery ahead of any consumer; overloads `domain`. Split write-time (build) from read-time (defer) instead (D11). |
| Controlled vocabulary (allowed-list + reject unknowns) | Upfront maintenance, blocks writes, unfalsifiable with no consumer. Free-form + alias map instead (D2). |
| Reuse `concern` / a second meaning for `domain` | Blurs existing axes. A unique word, `ryoiki` (D1). |
| Empty alias map + drift-detection tooling to grow it | Machinery to manage a handful of names; premature ahead of a read consumer. Curated seed + review gate instead (D2, D10). |
| Derive-view helper / cross-unit check scripts | No consumer; the in-set is the headings minus a short blacklist, read by eye. Not built (D5, D10). |
| Parent/edge registry for hierarchy | Rebuilds rejected registry machinery. Path notation, convertible later (D3). |
| Whitelist per unit | Goes stale; silently drops new knowledge. Include-by-default + blacklist (D5). |
| Read-time filter (record all, filter on query) | Betrays the "keep the doc clean" goal; carries noise into doc + graph. Write-time exclusion (D9/D11). |
| `excluded_ryoiki` tombstone | Duplicates the blacklist; overhead for a reversal no consumer needs. Git backstops it (D9). |
| Blacklist in `package.json` | npm build/publish contract is the wrong home. Frontmatter (D7). |

## Consequences

**Positive:**
- The originating need (keep a demo app's `KNOWLEDGE.md` free of build-tooling noise) is fully met by the write-time slice alone, with a live consumer and no speculative scaffolding.
- `domain` keeps one meaning (workspace unit) across the repo; `ryoiki` is a clean, collision-free within-unit axis.
- Graph-ready without the graph: path tags + the curated alias map are authored as a byproduct of compaction; a future reader adds no reshape.

**Negative / Risks:**
- Write-time exclusion is lossy — recovering a blacklisted ryoiki means a deliberate re-projection from git. Mitigated by self-documenting noise + git backstop.
- Ryoiki quality depends on the review gate — a rubber-stamped bad proposal writes miscategorized knowledge. The gate makes it correctable, not foolproof.
- The alias seed is a curated guess — expected to be restructured as real usage accumulates. Cheap: nothing reads the file programmatically, so a restructure is a text edit.

**Neutral:**
- Ryoiki surface as `KNOWLEDGE.md` headings, so the doc's structure and its ryoiki taxonomy are the same artifact — they cannot drift apart, but the doc's organization is now also a machine-consumable contract.

## Related

- ADR: [Two-Axis Knowledge Architecture](20260718T094101Z-agentic-two-axis-knowledge-architecture.md) — D1 (domain/ryoiki axis), D5/D7 (KNOWLEDGE.md contract this feeds)
- Reference: `.agents/reference/ryoiki-aliases.json` + `.agents/reference/README.md` — the curated alias map and its policy
- The original rejected AGN06 draft and this ADR's prior deliberation-heavy revision are recoverable via `git log`.
