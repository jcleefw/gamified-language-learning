---
name: mechanical-rename
description: 'Bulk find-and-replace an identifier across many files using sed, then verify with grep — use when renaming a type/field/symbol repo-wide instead of editing file-by-file.'
---

# Mechanical Rename

## Step 0 — Scope and choose

- `grep -rl '<oldName>' .` — count files/hits. A handful → just edit them directly, skip this skill.
- Semantic rename available (IDE "rename symbol", `ts-morph`, language server) and the rename is code-only (no markdown/JSON/prose)? Use that instead. Fall back to sed only for what it doesn't cover.
- Old name shows up in many unrelated semantic roles (needs near-one-pattern-per-file to disambiguate)? Abort to manual edits — bulk sed isn't saving anything here.

Otherwise, continue.

## Step 1 — Bulk pass

One `sed -i ''` pattern per distinct legitimate context of the old name. Never one blanket pattern if the name is overloaded (also part of another identifier, a CLI flag, a file path, unrelated prose).

Example: renaming field `role` where `roleConfig` must NOT change:
```
sed -i '' 's/\brole\b/newRole/g' file.ts      # word-boundary anchored, skips roleConfig
```

## Step 2 — Verify both directions

```
grep -rn '<oldName>' .    # anything left = a pattern silently failed to match
grep -rn '<newName>' .    # eyeball for over-matches the pattern was too broad to avoid
```

## Step 3 — Hand-fix what sed can't safely do

Anything needing reordering or context-dependent logic goes straight to a manual edit — this is out of scope for a string swap, not a fallback to try after sed fails.

Example: an alphabetically-sorted array whose order shifts once a name changes (`['adr', 'domain', 'ryoiki']` → `kettei` sorts differently). Text substitution produces syntactically valid but wrongly-ordered output — fix is positional, not textual.
