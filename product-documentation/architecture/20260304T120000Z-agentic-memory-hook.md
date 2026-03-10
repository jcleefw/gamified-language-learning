# ADR: Automated Memory Pointer via PostToolUse Hook

**Status:** Proposed

**Date:** 2026-03-04

**Deciders:** Solo founder

---

## Context

The project memory protocol (RULES.md §Memory Protocol) requires manual writes to `.agents/memory/{branch}/` at four trigger points: story completed, decision made, blocker hit, session end.

In practice, the write trigger gets forgotten in two recurring scenarios:

1. **Freeform ADR sessions** — a conversation starts without invoking a skill, organically produces an ADR, but no pointer is written to `recent-decisions.md`.
2. **Long-context agent amnesia** — the skill footer instructs the agent to update memory, but by the end of a long session the instruction has drifted out of active attention.

The result is `recent-decisions.md` lagging behind the actual ADR state in `product-documentation/architecture/`.

### Alternatives Considered

**claude-mem (github.com/thedotmack/claude-mem)**
Auto-captures all tool use via lifecycle hooks into SQLite + Chroma. Enables semantic search via MCP tools and a running HTTP worker.

- Rejected: Claude Code-specific hooks + MCP tools violate Golden Rule #1 (platform agnostic)
- Rejected: auto-captures everything — high noise, low signal
- Rejected: requires external services (Bun worker, Chroma, SQLite daemon)

**`stop` hook (fires after every agent turn)**
Could prompt a memory write at session end.

- Rejected: fires on every turn, not just turns where something worth remembering happened; requires the hook to infer what happened — messy and fragile

**`/wrap` skill (manual session-close)**
A lightweight skill prompting "any decisions this session?" before closing.

- Rejected: still manual trigger — same forgetting problem in a different wrapper

**`_index.md` compact memory index**
A CODEMAP-style one-liner index for memory files.

- Rejected: duplicates the CODEMAP pattern, adds a new file to maintain, doesn't fix the capture trigger

---

## Decision

Add a Claude Code **`PostToolUse` hook** that fires when a Write or Edit tool call targets `product-documentation/architecture/*.md`.

The hook appends a one-liner pointer to `.agents/memory/{branch}/recent-decisions.md`:

```
### {YYYY-MM-DD}: {filename} — see ADR for full decision
```

No AI summarisation. No inference. Just a filename + date + pointer.

The agent still writes the full decision entry manually when it has the context to do so (e.g. at the end of a skill-guided session). The hook is a **safety net for the cases it doesn't** — not a replacement for intentional writes.

---

## Consequences

**Accepted trade-off:** The hook mechanism is Claude Code-specific. If the project moves to a different agent tool, the automation disappears and the trigger reverts to manual. The storage (`.agents/memory/{branch}/`) remains platform-agnostic regardless.

**Signal quality:** Pointer-only entries are low noise — one line, no detail. The agent or human can enrich them later if needed.

**Duplicate entries:** If both the hook and the agent write to `recent-decisions.md` in the same session, the file will have a hook-generated pointer alongside a richer manual entry. This is acceptable — the manual entry supersedes the pointer.

---

## Revisit When

- The hook produces too many pointer entries that never get enriched (noise accumulates)
- A non-Claude Code agent is adopted and the manual trigger problem resurfaces — consider whether a lightweight `/wrap` skill is worth adding at that point
- `recent-decisions.md` grows unwieldy — evaluate splitting into an index + archive at that point
