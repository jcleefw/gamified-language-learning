---
name: create-skill
description: "Guides the creation of a new Claude Code skill. Use when setting up a new skill, slash command, or reusable agent prompt."
---

# Create a New Skill

When this skill is loaded, follow these steps in order. Do not skip or batch them.

## Step 1: Clarify the Skill

Ask the user the following questions one at a time, waiting for an answer before proceeding:

1. **What** — What should this skill do? What is the specific action or output it produces?
2. **Why** — Why is this skill needed? What problem or friction does it solve?
3. **When** — When should this skill be invoked? What triggers it — a user command, a recurring workflow, a specific project context?
4. **Category** — Which category does it belong to? Available categories:
   - `ba` — Business Analyst
   - `dev` — Developer
   - `qa` — Quality Assurance
   - `product` — Product Management
   - `architect` — Architecture
   - `scrum` — Scrum / Agile
   - `agentic` — Claude agentic infrastructure (skills, subagents, hooks, etc.)
   - `infrastructure` — DevOps, CI/CD, environment setup

Do not proceed to Step 2 until all four questions are answered.

## Step 2: Propose the Skill Design

Based on the answers, propose:

- **Name**: A short, lowercase, hyphenated slug (e.g., `review-pr`, `tdd-feature`)
- **Category**: The chosen category (e.g., `dev`)
- **Path**: `.agents/skills/<category>/<name>/SKILL.md`
- **Description**: A one-sentence description written for the `description` frontmatter field. Must include when to use it (the "When" from Step 1).
- **Invocation**: Whether it should be user-invoked only or auto-invocable by Claude (if sensitive, recommend `disable-model-invocation: true`)
- **Instructions outline**: A brief bullet list of what the skill will instruct Claude to do

Ask the user to approve or adjust before writing any files.

## Step 3: Write the Skill

Once approved:

1. Create the directory `.agents/skills/<category>/<name>/`
2. Write `SKILL.md` with the following structure:

```markdown
---
name: <name>
description: "<one-sentence description including when to use>"
---

# <Skill Title>

<Instructions for Claude to follow when this skill is loaded.>
```

3. Follow the conventions from @claude-code-playbook.md (Section 4: Skills) for structuring instructions.

## Rules

- Never write the skill file without user approval of the design in Step 2.
- The `description` field must answer both *what* and *when* — it's used by Claude to decide whether to auto-invoke.
- Keep skill instructions imperative and specific. Avoid vague language like "help the user" or "do the right thing".
- If the skill involves sensitive or irreversible actions, always include `disable-model-invocation: true` in the frontmatter.
