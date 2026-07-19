# CODEMAP.md — `docs/`

Humanized explanations of the engine at three depths, plus a PRD-gap
analysis. Start here before diving into `src/`.

---

## Files

| File | Audience | Content |
| --- | --- | --- |
| `README.md` | — | Index/table-of-contents for the four docs below |
| `01-stakeholder.md` | Product owners, non-technical | Word lifecycle (Learn → Shelve → Review), sliding window, streak-based mastery, wrong-answer handling, foundational items, question types, long-term review |
| `02-concepts.md` | Developers, architects | Active pool/queue containers, foundational vs vocabulary split, `RunState` shape, streak→mastery rules, recheck loop, question composition, full session lifecycle diagram, shelving + review/FSRS modules, engine-vs-host boundary |
| `03-walkthrough.md` | Builders, debuggers | Worked example: 3-word deck through 6+ batches with exact state transitions, foundational items, sentence questions, shelving + FSRS review |
| `04-deferred-features.md` | Planners | Gap analysis vs PRD — deferred features (stuck-word shelving semantics, batch composition priority, continuous-wrong-rule, question-type distribution, peek button, ANKI/FSRS usage) + what IS implemented |

**Note:** `README.md`'s "Related files" section referenced `src/index.ts` and
`src/types/`/`src/engine/` paths that no longer exist post-`learn/` layer
split — corrected to `src/learn/index.ts` and `src/learn/{types,engine}/`.
