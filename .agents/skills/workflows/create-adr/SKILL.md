---
name: create-adr
description: Create an Architecture Decision Record (ADR) to document significant technical decisions with context, rationale, and consequences.
---

# Create ADR

1. Identify the decision needing documentation
2. Gather context: current behavior, problem statement, constraints
3. Document alternatives considered (pros/cons/tradeoffs)
4. Generate ADR using `.agents/plans/templates/ADR-TEMPLATE.md` in `product-documentation/architecture/`
5. Call `.agents/tools/generate-filename.sh ADR## <slug>` to get the consistent filename
6. Review with user

## Writing Rules

The reader has none of the context that was live when the decision was made. Write it to stand alone.

- **Decision, not process.** No branch names, PR numbers, "iteration 2," "after X failed" — state what was decided, not how the room got there. Alternatives still belong in Alternatives Considered; it's the _when/how_ of the discussion that gets cut, not the _what_.
- **No ephemeral references.** Don't cite a file/branch/ticket that won't outlive the ADR — state its substance directly instead.
- **Compact on supersede.** When a decision moves to a new ADR, shrink the old one to "superseded by X, see there" — never keep the same detail live in two places.
- **Declarative, not tentative.** "We use X," not "we could probably use X." Real uncertainty goes in Consequences as an open question, not hedged phrasing in the decision itself.
- **Tense**: Decision section = present tense (what's true now). Context section = past tense (what led here).
- **Decision before justification.** Lead each Decision/D# entry with what was decided; save the why for Rationale.
