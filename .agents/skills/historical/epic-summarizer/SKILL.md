---
name: epic-summarizer
description: Summarize each story in an epic's changelog folder with its ryoiki, for feeding the archive index.
---

Given an epic folder under `.agents/changelogs/`:

Read the docs and create a summary of
1. each ST, provide a summary of what they do, keep it concise
2. output the domain it belongs to

For each ST, find a suitable ryoiki out of `.agents/reference/ryoiki-aliases.json`.



Rules:
- Read every changelog including DS entries. No sampling — a missed one corrupts the index.
- Summaries in plain human language. No type names, file paths, or test counts.
- each entry specify domain `Domain: package/srs-engine, apps/srs-demo etc.`
- Note anything borderline or missing (e.g. no ST10) below the table
- Note why ryoiki was chosen, if can't find closes match, raise it
- Any entry whose ID starts with `DS` is always ryoiki `design-spec` — no content-based matching needed for these.
- A DS file's "## Stories" section may embed multiple STs with no separate changelog file of their own — extract and table each one individually instead of leaving it folded into the DS row.


Output:
- Output will be consumed by `.agents/changelogs/archive/index.json` — but you're not allowed to write to that file, or any file. Chat message only.
- write each summary into `.agents/reports/epic-summary`. 1 for each epic
