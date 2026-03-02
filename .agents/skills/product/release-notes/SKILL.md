---
name: release-notes
description: Draft user-facing release notes from a git diff, commit log, or feature list. Use when preparing a release or sprint summary for users or stakeholders.
model: haiku
---

Draft release notes from: $ARGUMENTS

If no input is provided, stop and ask: "Provide a git diff, commit log, or list of features/fixes included in this release."

---

## Rules

- Write for the user, not the developer — no implementation details, no internal jargon
- Lead with user benefit, not technical change ("You can now export reports as CSV" not "Added CSV serializer to ReportController")
- Group by type: new features, improvements, bug fixes
- Omit internal refactors, dependency upgrades, and test changes unless they have a user-visible effect
- Keep each entry to one sentence where possible

---

## Output Structure

### Version / Release [name or date if provided]

**New**
- [User-facing description of new capability]

**Improved**
- [User-facing description of enhancement to existing behavior]

**Fixed**
- [User-facing description of bug that was resolved]

---

## Tone

- Clear and direct — no marketing language
- Past tense for fixes ("Fixed an issue where..."), present tense for features ("You can now...")
- If a change is significant, lead with the user impact in bold

---

## Constraints

- If input is a raw git diff or commit log, extract only user-visible changes
- If a change is ambiguous (could be user-visible or not), include it with a "[Review]" flag
- Do not invent changes that are not in the input

## File Output

Save the document to: `product-documentation/release-notes/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-v2-3-release-notes.md`

Use the current UTC timestamp and the version or release name as the description.

## File Output

Save the completed document to:
```
product-documentation/release-notes/YYYYMMDDTHHMMSSZ-<short-description>.md
```
Example: `product-documentation/release-notes/20260226T143000Z-v2-3-release.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the release (version or theme).
