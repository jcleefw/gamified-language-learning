# Memory System

Persistent cross-session context, per epic. Survives across branches and sessions working on the same epic.

**Location**: `.agents/memory/EP##--slug/`

---

## Files

| File                        | Required? | Contents                                                          |
| ---------------------------- | --------- | ------------------------------------------------------------------ |
| `current-focus.md`           | Always    | Active story, status, last session outcome, immediate next steps |
| `<topic>-decisions.md` (freeform name) | As needed | One resolved decision or design tradeoff, with why + alternatives considered |

A blocker is just a next-step in `current-focus.md` ("blocked on X"). Session summaries belong in the story's changelog (`change-log-updater` skill).

## The one rule that matters

**`current-focus.md` stays short — status and next steps only.** Target ~15 lines.

The moment you're writing a "why we chose X over Y" or "here's the decision and alternatives considered" — stop, that's not status, that's a decision. Put it in its own file named for the topic (e.g. `wavesurfer-vs-howler.md`, `schema-design-decisions.md`), right then, not in a later cleanup pass. If `current-focus.md` is growing past a screen, decisions have leaked into it — pull them out.

## When to write

| Trigger         | Action                                            |
| --------------- | -------------------------------------------------- |
| Story completed | Update `current-focus.md`                          |
| Decision made   | New or updated topic file, immediately             |
| Session end     | Update `current-focus.md`'s "last session outcome" |

Full trigger table and update protocol: **RULES.md §Memory Protocol**. Bootstrap read order: **AGENTS.md §Bootstrap Reading Order**.

## When an epic archives

Memory folder persists indefinitely — no automatic cleanup or consolidation on archive.
