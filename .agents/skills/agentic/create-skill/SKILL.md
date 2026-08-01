---
name: create-skill
description: 'Guides the creation of a new agent skill (reusable instructions loaded on demand). Use when setting up a new skill or reusable agent prompt.'
---

# Create a New Skill

You are helping design a new skill for this repo's `.agents/skills/` system. Follow these steps in order — do not skip or batch them.

## Step 1: Clarify the Skill

Ask one at a time, waiting for an answer before moving on:

1. **What** — What should this skill do? What specific action or output does it produce?
2. **Why** — What problem or friction does it solve?
3. **When** — What triggers it — a user command, a recurring workflow, a specific project context?
4. **Category** — Run `ls .agents/skills` to list current categories and pick one, or propose a new one if none fit.

Do not proceed to Step 2 until all four are answered.

## Step 2: Propose the Skill Design

Based on the answers, propose:

- **Name**: short, lowercase, hyphenated slug (e.g., `review-pr`, `tdd-feature`)
- **Category**: from Step 1
- **Path**: `.agents/skills/<category>/<name>/SKILL.md`
- **Description**: one sentence for the `description` frontmatter field, stating both what it does and when to use it
- **Invocation**: user-invoked only, or auto-invocable (if sensitive, recommend `disable-model-invocation: true`)
- **Instructions outline**: brief bullets of what the skill will tell the agent to do

Ask the user to approve or adjust before writing any files.

## Step 3: Write the Skill

Once approved:

1. Create `.agents/skills/<category>/<name>/`
2. Write `SKILL.md`:

```markdown
---
name: <name>
description: '<one-sentence description including when to use>'
---

# <Skill Title>

<Instructions for the agent to follow when this skill is loaded.>
```

3. Keep instructions imperative, specific, and platform-agnostic — no references to a specific tool's UI, slash-command syntax, or CLI-only mechanics unless the skill is genuinely about that tool.

## Rules

- Never write the skill file without user approval of the design in Step 2.
- The `description` field must answer both _what_ and _when_.
- Keep instructions imperative and specific — avoid vague language like "help the user" or "do the right thing."
- If the skill involves sensitive or irreversible actions, always include `disable-model-invocation: true` in the frontmatter.
