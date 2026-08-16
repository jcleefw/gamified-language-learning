---
name: ryoiki-from-summary
description: Write a verified epic-summary report's story->ryoiki mapping straight into the archive index, no draft/confirm loop.
---

Given a verified epic-summary report (`.agents/reports/epic-summary/EP##-*.md`, from `epic-summarizer`):

1. Read the report's table. For each row, build `{"id": "EP##-<Story>", "ryoiki": <Ryoiki>, "summary": <Summary>, "domain": <Domain>}`.
2. Every row goes in, regardless of id prefix (ST, DS, BUG, RV, ...) — no prefix is special-cased or skipped.
3. If a row's `Domain` lists more than one domain, split it into one entry per domain instead of one shared entry — each index entry belongs to exactly one domain.
4. Summarize how many entries, ask user for approval
5. Once approved, run once with the full array on stdin:
   `.agents/tools/write-ryoiki.sh --data -`
5. Report the created/patched counts back to the user.

Rules:
- Report must already be human-verified (e.g. "Verified by JC") — do not run against an unreviewed draft.
- No `draft`, `status`, or `confirm` step — unlike `ryoiki-mapping`, which is for when the mapping is *not yet* decided, this report already is.
- Don't invent a ryoiki — only write what the report says.
