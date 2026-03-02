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

### Open Questions
What decisions or external factors could shift this roadmap? Who owns each question?

---

## Constraints

- Do not over-fill "Now" — it should reflect realistic capacity, not aspirations
- Every "Later" item needs a signal that would move it to "Next" — if there is none, it belongs in "Parked"
- Do not invent items not present in the input
- Stop after drafting and ask: "Does this reflect your current priorities? Any items to move or drop?"

## File Output

Save the document to: `product-documentation/roadmap/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-q2-roadmap-slice.md`

Use the current UTC timestamp and the cycle or quarter as the description.
