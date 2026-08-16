# AGN08: Ryoiki Mapper From Epic Summary — Implementation Plan

**Date**: 20260816T141848Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Tool | Skill
**Status**: **Draft**
**Track**: agentic

---

## 1. Overview

`archive-epic.sh confirm` (`.agents/tools/lib/archive-epic.mjs`, `cmdConfirm`) already knows how to write `{id, ryoiki}` pairs into `index.json` and clear the draft `state`. But it's wired into a two-step draft/confirm flow: `draft` must first seed `state: "draft"` entries into `index.json` before `confirm` has anything to act on.

The `epic-summarizer` skill (`.agents/skills/historical/epic-summarizer/`) already produces a human-reviewed story→ryoiki mapping as a standalone report file (e.g. `.agents/reports/epic-summary/EP21-srs-engine-v2-revision-build.md`) — read from the epic's changelog folder directly, with no dependency on `index.json` draft state at all. Once that report exists and is "Verified by JC", re-deriving the same mapping through `draft`/`status`/`confirm` is redundant: the mapping is already sitting in a file.

This plan extracts the id→ryoiki **write** step out of `cmdConfirm` into a standalone, reusable function and a thin CLI wrapper — independent of `archive-epic.sh`, since writing a ryoiki value into `index.json` from an already-produced mapping isn't an archive step (no commit-range resolution, no draft-state lifecycle). A new skill then closes the loop: given an epic-summary report, map its table straight to `{id, ryoiki}` pairs and call the new tool once — no `draft`, no `status`, no `confirm`.

## 2. Core Requirements

| Requirement | Decision |
| --- | --- |
| Ownership | New tool lives outside `archive-epic.sh` / `archive-epic.mjs` — it is not an archive step |
| Reuse | The id→ryoiki write logic used by `cmdConfirm` is extracted into one shared function; `cmdConfirm` calls it instead of duplicating it |
| Input shape | Same `{id, ryoiki}[]` shape `cmdConfirm --data` already accepts — no new data format |
| Entry lifecycle | Works on entries in any state (confirmed or draft) — a `state` field is cleared if present, but its absence is not an error. This tool does not require the draft/confirm lifecycle at all |
| Invocation | New skill reads an epic-summary report (`.agents/reports/epic-summary/EP##-*.md`), extracts the `Story`/`Ryoiki` columns, and calls the new tool directly in one pass |
| Golden Rule 3 unchanged | The tool still never invents a ryoiki itself — it only writes values the report/human already decided |

## 3. Data Structures

Unchanged wire format — reuses what `confirm --data` already accepts:

```jsonc
// stdin / file: JSON array of {id, ryoiki} pairs, e.g. extracted from an
// epic-summary report's Story/Ryoiki columns
[
  { "id": "EP21-DS01", "ryoiki": "design-spec" },
  { "id": "EP21-ST02", "ryoiki": "learning-session-lifecycle" },
  { "id": "EP21-ST03", "ryoiki": "demo-harness" }
]
```

No change to `index.json`'s story shape or `ryoiki-aliases.json`.

## 4. Design

### 4.1 Extraction

`cmdConfirm` (`archive-epic.mjs:474-503`) currently:
1. builds a `renames: Map<id, ryoiki>` from `overrides` (+ `mapOpts`)
2. reads `index.json`
3. filters out `deletes`, maps matching stories: applies `renames`, deletes `state`
4. writes `index.json` back
5. returns a confirm-count summary string

Split out step 3-4's core (apply renames + clear `state` on matching stories, write back) into a shared function, e.g. `applyRyoikiWrites(index, epFilter, renames, { deletes, onlyIds })`, importable by both `cmdConfirm` and the new tool. `cmdConfirm` keeps its epic-scoping, `--map` shorthand, and draft-count messaging; it calls the shared function instead of inlining the filter/map logic.

The new tool does NOT filter by epic or by `state` presence — it looks up stories by `id` directly across the whole index, since the epic-summary report already scopes which ids are in play.

### 4.2 New standalone tool

`.agents/tools/write-ryoiki.sh` → `.agents/tools/lib/write-ryoiki.mjs` (mirrors the existing `.sh` → `.mjs` pattern).

```
write-ryoiki.sh --data -   # JSON array of {id, ryoiki} on stdin (or a path instead of -)
```

- Reads `index.json`, applies the shared write function by `id` (no epic filter), writes back.
- Reports how many ids were found/written vs. not found in the index (so a typo'd id in the summary report doesn't fail silently).
- Does not touch `ryoiki-blacklist.json` or `ryoiki-aliases.json` — those stay human-curated, untouched by any tool (Golden Rule 3 carries over unchanged).

### 4.3 New skill

`.agents/skills/agentic/ryoiki-from-summary/SKILL.md` (name TBC with user), sibling to `epic-summarizer` and `ryoiki-mapping`:

1. Take a given `.agents/reports/epic-summary/EP##-*.md` report (must already be human-verified, per `epic-summarizer`'s "Verified by JC" convention).
2. Parse the `Story` / `Ryoiki` table columns into `{id: "EP##-<Story>", ryoiki}` pairs.
3. Call `write-ryoiki.sh --data -` once with the full array.
4. Report the written/not-found counts back to the user.

No `draft`, `status`, or `confirm` step — this path assumes the mapping is already decided (in the report), unlike `ryoiki-mapping`'s live table-and-respond flow which is for when the mapping is *not yet* decided.

## 5. Stories

### AGN08-ST01: extract shared ryoiki-write function

**Scope**: Refactor `cmdConfirm` in `archive-epic.mjs` to delegate its rename/clear-state/write logic to a new exported function reusable outside the epic-scoped confirm flow.
**Read List**: `archive-epic.mjs` `cmdConfirm` (~474-503), `readJson`/`writeJson`

**Tasks**:
- [ ] Extract the filter/rename/clear-`state`/write logic into an exported function taking an already-loaded index, a `renames` map, and optional epic/id-scoping.
- [ ] `cmdConfirm` calls the shared function; behavior and existing CLI output unchanged.
- [ ] Existing `confirm --data` / `confirm --map` behavior verified unchanged (no regression on epic-scoped confirm).

**Acceptance**:
- [ ] `archive-epic.sh confirm EP## --data -` output is byte-identical to before the refactor for the same input.
- [ ] The shared function has no epic-scoping baked in — an epic filter is a caller-supplied option, not hardcoded.

### AGN08-ST02: standalone `write-ryoiki` tool

**Scope**: New `.sh`/`.mjs` pair, outside `archive-epic.sh`, that applies `{id, ryoiki}[]` writes directly to `index.json` by id, independent of draft/confirm state.
**Read List**: ST01's shared function; `archive-epic.sh`'s `.sh`→`.mjs` exec pattern

**Tasks**:
- [ ] `write-ryoiki.sh --data -` (or a path) reads the JSON array, calls the shared function scoped by id (not epic), writes `index.json`.
- [ ] Clears `state` on any matched entry that has one; does not require `state` to be present.
- [ ] Reports counts: written vs. id-not-found (printed, not silently dropped).

**Acceptance**:
- [ ] Running against a fully-confirmed (no `state` anywhere) `index.json` still updates matching ids' `ryoiki` values.
- [ ] An id not present in `index.json` is reported, not silently ignored, and does not abort the rest of the batch.
- [ ] Tool has no dependency on `archive-epic.sh` or any archive-step (commit-range, discover, draft).

### AGN08-ST03: `ryoiki-from-summary` skill

**Scope**: New skill that takes a verified epic-summary report and writes its mapping in one pass via ST02's tool. `SKILL.md` itself should be as brief as `.agents/skills/historical/epic-summarizer/SKILL.md` — a short instruction list, not a verbose spec.
**Read List**: `.agents/skills/historical/epic-summarizer/SKILL.md` (both content and brevity as the format model), `.agents/skills/historical/ryoiki-mapping/SKILL.md` (contrast: this skips its draft/confirm loop), a sample report (`EP21-srs-engine-v2-revision-build.md`)

**Tasks**:
- [ ] Parse the report's `Story` / `Ryoiki` table columns into `{id, ryoiki}` pairs (id = `EP##-<Story>`).
- [ ] If a story's `Domain` column lists more than one domain (multi-domain story), split it into one `{id, ryoiki}` entry per domain instead of one shared entry — each `index.json` entry belongs to exactly one domain, matching the existing one-domain-per-entry invariant.
- [ ] Call `write-ryoiki.sh --data -` once with the full (post-split) set.
- [ ] Surface the written/not-found summary to the user; do not silently proceed past not-found ids.

**Acceptance**:
- [ ] Running against `EP21-srs-engine-v2-revision-build.md` writes `EP21-DS01`, `EP21-DS02`, `EP21-ST02`, `EP21-ST03`'s ryoiki values into `index.json` in a single command.
- [ ] A story listing multiple domains produces one entry per domain, each with a single domain value — never one entry with multiple domains.
- [ ] No `draft`/`status`/`confirm` step is invoked anywhere in the skill.
- [ ] A malformed or missing report is rejected with a clear message, not partially applied.

## 6. Not built

- No changes to `ryoiki-aliases.json` or `ryoiki-blacklist.json` semantics — still human-curated only.
- No change to `archive-epic.sh`'s `draft`/`status`/`confirm` flow's own behavior beyond the internal refactor (ST01) — `ryoiki-mapping` skill stays as-is for the not-yet-decided case.
- No table-parsing generality beyond the `epic-summary` report's existing `Story | Summary | Domain | Ryoiki | Why` shape.

## 7. Success Criteria

1. A verified epic-summary report can be applied to `index.json` in one command, with no draft/confirm round-trip.
2. The id→ryoiki write logic exists in exactly one place, shared by both `archive-epic.sh confirm` and the new standalone tool.
3. The new tool has no coupling to `archive-epic.sh` or the archive commit-range/discover machinery.
