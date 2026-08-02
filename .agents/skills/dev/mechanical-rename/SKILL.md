---
name: mechanical-rename
description: 'Bulk find-and-replace an identifier across many files using sed, then verify with grep — use when renaming a type/field/symbol repo-wide instead of editing file-by-file.'
---

# Mechanical Rename

## Step 0 — Scope and choose

Before touching anything, check whether bulk sed is even the right tool:

- **Scope it**: `grep -rl` the old name to see how many files/occurrences are involved. If it's only a handful, just edit them directly — the pattern-then-verify ceremony below only earns its keep on real repetition.
- **Prefer a semantic rename tool when one applies**: if the rename is confined to code (not also touching markdown/JSON/comments) and an AST-aware rename is available (IDE "rename symbol," `ts-morph`, language-server rename), use that instead — it can't over-match a substring inside an unrelated identifier the way plain text substitution can. Reach for sed for the parts such a tool doesn't cover.
- **Abort to manual if too heterogeneous**: if the name appears in so many distinct semantic roles that safely disambiguating would need nearly as many patterns as there are files, the mechanical approach isn't saving anything — do individual edits instead.

If bulk sed is still the right call, continue below.

## Step 1 — Bulk pass

Write one `sed -i ''` pattern (macOS/BSD syntax) per distinct legitimate context of the old name. Never write one blanket pattern for the whole rename if the old name is overloaded — e.g. it also appears as part of another identifier, a CLI flag, a file path, or in prose describing something unrelated to the rename. One pattern per context, not one pattern for the whole codebase.

## Step 2 — Verify both directions

Run two greps after the pass:

- Grep for the **old name still remaining** — this catches a pattern that silently failed to match (commonly from shell-escaping swallowing backticks or asterisks in the pattern).
- Grep for the **new name in unexpected contexts** — this catches over-matches the pattern was too broad to avoid.

## Step 3 — Hand-fix what sed can't safely do

Route anything needing reordering or context-dependent logic straight to an individual edit — recognize this upfront as out of scope for a string swap, not a fallback attempted only after sed fails on it. The clearest example: an alphabetically-sorted list or array whose correct order shifts once the name changes (e.g. `['adr', 'domain', 'ryoiki']` sorts differently once `adr` becomes `kettei`) — a pure text substitution produces syntactically valid but wrongly-ordered output, and no pattern fixes that; the fix is positional, not textual.
