---
name: roadmap-slice
description: Carve a now/next/later roadmap snapshot from a backlog, feature list, or strategic context. Use when preparing for planning sessions, stakeholder reviews, or quarterly planning.
model: sonnet
---

Create a roadmap slice from: $ARGUMENTS

If no input is provided, stop and ask:
1. "Paste the feature list, backlog, or strategic priorities to work from."
2. "What is the planning horizon? (e.g., now = this sprint, next = next quarter, later = H2)"
3. "Are there any fixed constraints or committed items I should treat as locked?"

---

## Now / Next / Later Definitions

- **Now** — Actively in flight or committed for the current cycle. Scope is locked.
- **Next** — Planned for the next cycle. Requirements are known; sequencing may shift.
- **Later** — Directional intent. Not committed. Subject to change based on learning.

---

## Process

1. Review all input items
2. Apply now/next/later based on: strategic priority, dependency order, team capacity signals, and locked commitments
3. Flag items that don't fit any horizon — these may be candidates to drop or park
4. Surface dependencies between items (A must ship before B)
5. **Identify parallelism** — for each item in Now/Next, check whether items with the same dependency can be built concurrently. Draw the critical path.
6. **Check the human feedback loop** — identify the first epic/story where a human can observe output without extra wiring. If it is more than 3 epics away, flag it and propose injecting a thin playable checkpoint (e.g., a demo script that exercises the available API).

---

## Output Structure

### Roadmap Snapshot — [Date / Cycle]

**Now**
| Item | Owner (if known) | Why now |
|---|---|---|
| | | |

**Next**
| Item | Why next | Dependencies |
|---|---|---|
| | | |

**Later**
| Item | Signal to move it forward |
|---|---|
| | |

**Parked / Not on roadmap**
| Item | Reason |
|---|---|
| | |

### Key Dependencies
List items where sequencing matters — what must ship before what.

### Parallelism Map
Show which items share a dependency and can be built concurrently. Use a simple dependency tree:

```
EP01 → EP02 → [EP03 + EP04 + EP05] → EP06
```

State the **critical path** (longest sequential chain) explicitly.

### Human Feedback Checkpoints
Identify the earliest point a human can observe meaningful output without extra wiring. If a gap exists, note where a thin demo/smoke script should be injected and what it would show.

### Open Questions
What decisions or external factors could shift this roadmap? Who owns each question?

---

## Constraints

- Do not over-fill "Now" — it should reflect realistic capacity, not aspirations
- Every "Later" item needs a signal that would move it to "Next" — if there is none, it belongs in "Parked"
- Do not invent items not present in the input
- Parallelism is real only when dependencies allow it — do not force parallel items that share mutable state or require each other's output
- A thin demo script is not a new epic; it is a story added to an existing epic or a standalone script. Keep it minimal — the goal is observability, not polish.
- Stop after drafting and ask: "Does this reflect your current priorities? Any items to move or drop?"

## File Output

Save the document to: `product-documentation/roadmap/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-q2-roadmap-slice.md`

Use the current UTC timestamp and the cycle or quarter as the description.
