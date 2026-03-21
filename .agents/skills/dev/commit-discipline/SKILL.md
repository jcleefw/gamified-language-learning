---
name: commit-discipline
description: 'Enforces project-standardized Git commit practices. Ensures every commit represents a single testable unit of work.'
tools: Read, Exec
---

# Commit Discipline

This skill defines the mandatory standards for version control in the project.

## Standard Procedure

1.  **Timing**: One commit per story, performed only at the end of the REVIEW phase after the full package suite passes.
2.  **Atomicity**: Include both implementation work and corresponding tests in the same commit. Never split code and tests.
3.  **Validation**: Before committing, verify that all staged changes align with the documented work in the story's changelog.
4.  **Formatting**:
    - **Header**: `type(SCOPE-ID): <short descriptive summary>`
    - **Body**: Explain the "why" and any non-obvious implementation details.
5.  **Conventional Types**:
    - `feat`: New feature or significant addition
    - `fix`: Bug fix
    - `chore`: Maintenance, config changes, boilerplate
    - `docs`: Documentation-only changes
    - `refactor`: Code restructuring without functional changes
    - `agentic`: Changes to AI governance, skills, or workflows

## Compliance Rules

- **No Multi-Story Commits**: Never combine work from multiple stories into one commit.
- **Prefix Consistency**: Valid prefixes are mandatory (e.g., `feat(EP01-ST01)`).
- **Test Mandate**: Commits for features/fixes must include passing test evidence in the staging area.
