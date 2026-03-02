---
name: user-story
description: Write a well-structured user story with acceptance criteria and edge cases. Use when translating a feature idea or requirement into a development-ready story.
model: haiku
---

Write a user story for: $ARGUMENTS

If no input is provided, stop and ask: "What feature or requirement should this user story cover?"

---

## Output Structure

### Story
```
As a [specific user type],
I want to [action or capability],
So that [outcome or benefit].
```

Use a specific user type — not "user". If multiple user types are relevant, write a story for each.

### Acceptance Criteria
Write as a numbered checklist using "Given / When / Then" format:

```
1. Given [context], when [action], then [expected result].
2. Given [context], when [action], then [expected result].
```

Include at minimum:
- The happy path
- One error/failure state
- One boundary condition

### Edge Cases
List scenarios that are not covered by the acceptance criteria above but could cause issues:
- Input edge cases (empty, very long, special characters)
- State edge cases (first-time user, no data, concurrent use)
- Permission edge cases (unauthorized, expired session)

### Out of Scope
List what this story explicitly does not cover, to avoid misinterpretation.

---

## Constraints

- Keep the story to one deliverable unit — if it requires more than one sprint, it is too large; split it
- Acceptance criteria must be testable by QA without ambiguity
- Flag any requirement that needs a design decision with "[Design decision needed]"
- Do not gold-plate — write the minimum story that delivers value

## File Output

Save the document to: `product-documentation/user-stories/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-export-csv-story.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the story.

## File Output

Save the completed document to:
```
product-documentation/user-stories/YYYYMMDDTHHMMSSZ-<short-description>.md
```
Example: `product-documentation/user-stories/20260226T143000Z-export-csv-report.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the story.
