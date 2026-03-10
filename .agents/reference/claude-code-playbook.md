# The Claude Code Playbook

**An opinionated guide to getting the best code out of Claude Code.**

This isn't documentation — it's a workflow discipline. It assumes you're already set up and want to know _how to think_ about using Claude Code, not just what buttons to press. For official docs, start at [docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview).

---

## The Mental Model

Claude Code is not an autocomplete engine. It's an agent with tools: it reads files, runs commands, edits code, searches the web, and delegates to subagents. The quality of its output is directly proportional to three things:

1. **The clarity of your intent** (prompting)
2. **The context it has access to** (memory, CLAUDE.md, skills)
3. **The guardrails you've set** (hooks, permissions, subagents)

Your job isn't to type code faster. It's to become a _technical director_ — setting intent, reviewing output, and building the infrastructure that makes every future session better.

---

## 1. Foundation: Set Up Your Memory Stack

Before you write a single prompt, invest in context infrastructure. This is the highest-leverage work you'll do with Claude Code.

### 1.1 CLAUDE.md — Your Project's Constitution

CLAUDE.md is not a README. It's the set of instructions Claude reads at the start of every session. Treat it like onboarding documentation for a new senior developer joining your team.

**Where they live (in priority order):**

- `~/.claude/CLAUDE.md` — Your personal defaults across all projects
- `.claude/CLAUDE.md` or `CLAUDE.md` at project root — Shared team context (commit this)
- `.claude/CLAUDE.md.local` — Your local overrides (gitignored)

**What belongs in CLAUDE.md:**

- The tech stack and key architectural decisions ("This is a Rails 7.2 modular monolith deployed on ECS Fargate")
- How to run tests, lint, and build (`bin/rails test`, `bundle exec rubocop`)
- Naming conventions and code style mandates ("Use 2-space indentation, prefer `frozen_string_literal: true`")
- What NOT to do ("Never use `skip` in migrations, never bypass strong_migrations")
- Key file paths Claude will need repeatedly

**What does NOT belong in CLAUDE.md:**

- Vague aspirations ("Write good code")
- Anything that changes per-task (use prompts for that)
- Massive file dumps (use `@imports` instead)

**Use @imports for modularity:**

```markdown
See @README.md for project overview
See @docs/architecture.md for system design
See @.rubocop.yml for style rules
```

This keeps CLAUDE.md lean while giving Claude access to detailed reference material on demand.

📖 [Memory management docs](https://docs.anthropic.com/en/docs/claude-code/memory)

### 1.2 Auto Memory — Let Claude Take Notes

Auto memory is a directory where Claude records what it discovers as it works — debugging patterns, architectural insights, codebase quirks. Unlike CLAUDE.md (which you write), auto memory is Claude's own notebook.

Stored at `~/.claude/projects/<project>/memory/` with a `MEMORY.md` entrypoint. The first 200 lines are loaded into every session.

**Make it work for you:**

- Tell Claude explicitly: "Remember that we use pnpm, not npm" or "Save to memory that the API tests require a local Redis instance"
- Ask Claude to consult memory before starting: "Check your memory for patterns you've seen before, then review this PR"
- Edit it directly with `/memory` — curate it like you'd curate documentation

Force it on if you're not seeing it yet: `export CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`

### 1.3 The `.claude/rules/` Directory — Granular, Path-Specific Rules

For rules that should only apply to certain files or directories, use `.claude/rules/`:

```
.claude/rules/
├── api-controllers.md          # Rules for app/controllers/api/
├── database-migrations.md      # Rules for db/migrate/
└── test-conventions.md         # Rules for test/ or spec/
```

Use glob patterns in the frontmatter to scope rules:

```markdown
---
globs: ['db/migrate/**/*.rb']
---

- Always use `safety_assured` blocks with a comment explaining why
- Never use `change` method — use explicit `up` and `down`
- Run `bin/rails db:migrate:status` after generating
```

This is how you encode your team's hard-won institutional knowledge into every Claude session.

---

## 2. Prompting: The Craft That Makes Everything Else Work

### 2.1 The Anatomy of a Great Prompt

A great Claude Code prompt has three layers:

**Intent** — What you want to achieve, not how to achieve it:

> "Add rate limiting to the API endpoints in `app/controllers/api/v2/`"

**Constraints** — The boundaries and quality bars:

> "Use the `rack-attack` gem. Write request specs first. Limit to 100 requests per minute per API key."

**Verification** — How Claude (and you) will know it worked:

> "All existing tests should still pass. Run `bundle exec rspec spec/requests/api/v2/` to verify."

### 2.2 Prompting Patterns That Work

**The TDD prompt** — Force test-first thinking:

> "Write a failing test for [feature]. Show me the test. Then implement the minimum code to make it pass. Then refactor. Stop after each step for my review."

**The exploration prompt** — When you're not sure what you want yet:

> "Explore how authentication is currently handled across the codebase. Map the flow from request to response. Don't change anything yet."

**The constraint-heavy prompt** — When precision matters:

> "Refactor the `OrderProcessor` service. Keep the public interface identical. Don't touch the database schema. Every method should be under 10 lines. Write tests for any behavior you change."

**The "think hard" prompt** — For architectural decisions:

> "I need to add multi-tenancy to this application. Think through the tradeoffs between schema-per-tenant, row-level security, and the Apartment gem approach. Consider our current Postgres setup and ECS deployment. Don't implement anything — just give me your analysis."

### 2.3 What Not to Do

- **Don't be vague.** "Fix the tests" gives Claude no signal. "The `OrdersControllerTest` is failing because `create_order` returns a 422 — investigate why and fix the root cause" does.
- **Don't over-specify implementation.** Tell Claude _what_ and _why_, not _how_. It often finds better approaches than the one you'd dictate.
- **Don't dump your entire mental context.** If Claude needs background, put it in CLAUDE.md or a skill, not in every prompt.

📖 [Prompting best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)

---

## 3. Modes: Match the Tool to the Task

Claude Code has distinct operating modes. Using the right one at the right time is a force multiplier.

### 3.1 Normal Mode (Default)

Claude reads, writes, runs commands, and edits files. You approve each tool use. This is your workhorse for implementation.

**When to use:** Active feature development, bug fixes, refactoring.

### 3.2 Plan Mode

Claude can only read — no edits, no commands that modify state. It uses `AskUserQuestion` to gather requirements and clarify goals before proposing a plan.

**When to use:**

- Before starting any multi-file feature
- Exploring an unfamiliar codebase
- When you want Claude to research before acting

**How to enter:**

- `Shift+Tab` to cycle through modes (Normal → Auto-Accept → Plan)
- `--permission-mode plan` flag at startup
- Headless: `claude -p "Analyze the authentication flow and create a plan" --permission-mode plan`

**The discipline:** Always start complex work in Plan Mode. Let Claude map the territory, identify dependencies, and propose a sequence. Review the plan. Then switch to Normal or Auto-Accept to execute.

Press `Ctrl+G` to open the plan in your editor for direct editing before Claude proceeds.

### 3.3 Auto-Accept Mode

Claude executes edits without asking for approval. Use with care.

**When to use:** Mechanical tasks where you trust the pattern — running a well-defined refactoring, fixing lint errors, updating imports after a rename.

**When NOT to use:** Anything touching database schemas, security logic, or public APIs.

### 3.4 Headless Mode (`-p` flag)

Run Claude non-interactively with a single prompt. No UI, just input → output.

```bash
claude -p "Run the test suite and summarize any failures" --permission-mode bypassPermissions
```

**When to use:** CI/CD pipelines, scripted workflows, batch operations. Combine with `--output-format json` for programmatic consumption.

### 3.5 Background Tasks (`Ctrl+B`)

Send a running task to the background and continue working. Check back later.

**When to use:** Long-running test suites, large refactors, code generation tasks where you don't need to watch every step.

📖 [Common workflows](https://docs.anthropic.com/en/docs/claude-code/common-workflows)

---

## 4. Skills: Reusable Expertise as Code

Skills are packaged instructions that Claude loads on demand. They're the bridge between "I told Claude once" and "Claude always knows this."

### 4.1 Where Skills Live

- `~/.claude/skills/` — Your personal skills, available everywhere
- `.claude/skills/` — Project skills, shared with your team

Each skill is a directory with a `SKILL.md` file containing YAML frontmatter and markdown instructions.

### 4.2 Anatomy of a Good Skill

```markdown
---
name: tdd-feature
description: Implements features using strict TDD discipline. Use when building new features or adding functionality.
---

When implementing a feature:

1. **Red:** Write the smallest failing test that describes the desired behavior
2. **Green:** Write the minimum code to make the test pass — no more
3. **Refactor:** Clean up while keeping tests green

Rules:

- Never write implementation code before a failing test exists
- Run the test suite after every change: `bin/rails test`
- If a test is hard to write, the design is wrong — simplify the interface first
- Stop after each red-green-refactor cycle and show me the result
```

### 4.3 Advanced Skill Patterns

**Skills with context forking** — Run the skill in an isolated subagent:

```markdown
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

Results get summarized and returned to your main conversation. The research doesn't pollute your context window.

**Skills with shell commands** — Inject live data:

```markdown
---
name: review-pr
description: Review the current PR changes
---

## Current Changes

!`git diff main...HEAD --stat`

## Detailed Diff

!`git diff main...HEAD`

Review these changes for correctness, style, and potential issues.
```

**Disabling auto-invocation** — For sensitive skills:

```markdown
---
name: deploy
description: Deploy to production
disable-model-invocation: true
---
```

This skill can only be triggered by you typing `/deploy`, never by Claude deciding to run it.

### 4.4 Skills vs. Subagents — When to Use Which

Use **skills** when you want reusable prompts that run in your main conversation context. Use **subagents** when you want isolated execution with separate context, custom tool restrictions, or persistent memory.

Think of skills as "here's how to do this" and subagents as "here's a specialist to delegate this to."

📖 [Skills documentation](https://docs.anthropic.com/en/docs/claude-code/slash-commands)

---

## 5. Subagents: Delegation and Specialization

### 5.1 Why Subagents Matter

Every message in your main conversation consumes context. Subagents operate in their own context window, do their work, and return a summary. This is how you keep long sessions productive.

### 5.2 Creating Subagents

```bash
# Interactive creation
/agents → Create new agent

# Manual creation
mkdir -p .claude/agents
```

```markdown
# .claude/agents/test-runner.md

---

name: test-runner
description: Use PROACTIVELY to run tests and fix failures
tools: Bash, Read, Write, Edit, Glob, Grep

---

You are a test automation expert. When invoked:

1. Run the relevant test suite
2. If tests fail, analyze failures and fix them
3. Re-run to confirm the fix
4. Return a summary of what failed and what you changed

Preserve the original test intent — never weaken a test to make it pass.
```

**Key fields:**

- `description` — Be specific and action-oriented. Include "PROACTIVELY" or "MUST BE USED" to encourage automatic delegation.
- `tools` — Restrict to only what the agent needs. A code-reviewer doesn't need Write.
- `model` — Override the model (e.g., `model: sonnet` for faster, cheaper agents).
- `memory` — Give the agent persistent memory across sessions (`memory: user` or `memory: project`).
- `hooks` — Attach validation hooks (e.g., block write operations for a read-only agent).
- `skills` — Inject skill content at startup for domain knowledge.

### 5.3 Agent Teams (Research Preview)

For sustained parallel work, agent teams give each worker its own independent context and can operate in isolated git worktrees.

Enable with: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

Use when: tasks are genuinely independent and can be merged later, like implementing separate API endpoints or writing tests for different modules in parallel.

### 5.4 Chaining Subagents

For multi-step workflows:

> "Use the code-analyzer subagent to find performance issues, then use the optimizer subagent to fix them"

Claude passes relevant context between stages.

📖 [Subagents documentation](https://docs.anthropic.com/en/docs/claude-code/sub-agents)

---

## 6. Hooks: Automated Guardrails

Hooks are scripts that run at specific lifecycle points. They're how you encode safety and quality checks that run automatically, every time, without relying on Claude to remember.

### 6.1 Hook Events

| Event                | When it fires             | Use case                               |
| -------------------- | ------------------------- | -------------------------------------- |
| `PreToolUse`         | Before any tool executes  | Validate, block, or modify tool inputs |
| `PostToolUse`        | After any tool executes   | Log, audit, inject follow-up context   |
| `PostToolUseFailure` | When a tool fails         | Custom error handling                  |
| `UserPromptSubmit`   | When you send a message   | Inject context, modify prompts         |
| `SessionStart`       | Session begins/resumes    | Setup, environment checks              |
| `SessionEnd`         | Session ends              | Cleanup, reporting                     |
| `Stop`               | Claude tries to stop      | Force continuation ("block" + reason)  |
| `SubagentStart/Stop` | Subagent lifecycle        | Logging, validation                    |
| `PreCompact`         | Before context compaction | Save critical state                    |
| `PermissionRequest`  | Permission prompt shown   | Auto-approve or deny patterns          |

### 6.2 Where to Configure Hooks

```json
// .claude/settings.json (project, committed)
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/validate-command.sh"
          }
        ]
      }
    ]
  }
}
```

Also configurable in `~/.claude/settings.json` (user-level) or `.claude/settings.local.json` (local, not committed).

### 6.3 Practical Hook Examples

**Auto-run tests after every file edit:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/run-relevant-tests.sh"
          }
        ]
      }
    ]
  }
}
```

**Block dangerous commands:**

```python
#!/usr/bin/env python3
# scripts/validate-command.sh
import json, sys

input_data = json.load(sys.stdin)
command = input_data.get("tool_input", {}).get("command", "")

blocked = ["rm -rf", "DROP TABLE", "git push --force", "--no-verify"]
for pattern in blocked:
    if pattern in command:
        output = {
            "decision": "block",
            "reason": f"Blocked: command contains '{pattern}'"
        }
        print(json.dumps(output))
        sys.exit(0)

sys.exit(0)  # Allow by default
```

**Auto-approve safe reads:**

```python
#!/usr/bin/env python3
import json, sys

input_data = json.load(sys.stdin)
tool_name = input_data.get("tool_name", "")
file_path = input_data.get("tool_input", {}).get("file_path", "")

if tool_name == "Read" and file_path.endswith((".md", ".txt", ".json", ".yml")):
    print(json.dumps({
        "decision": "approve",
        "reason": "Documentation file auto-approved",
        "suppressOutput": True
    }))
    sys.exit(0)

sys.exit(0)
```

**Force Claude to continue when it tries to stop prematurely (Stop hook):**

Return `"block"` with a `reason` to prevent Claude from stopping. Useful for ensuring tasks complete fully.

📖 [Hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks)

---

## 7. MCP Servers: Extending Claude's Reach

Model Context Protocol servers give Claude access to external tools and data sources without custom code.

### 7.1 Configuration

Create `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

MCP tools appear as `mcp__<server-name>__<tool-name>` and require explicit permission.

### 7.2 When MCP Servers Add Real Value

- **Database access** — Let Claude query your development database directly to understand schema and data shapes
- **GitHub integration** — Create issues, review PRs, manage branches without leaving Claude Code
- **External APIs** — Connect to project management tools, documentation systems, monitoring

### 7.3 Tool Search for Large Tool Sets

When you have many MCP tools configured, tool search activates automatically (when tool descriptions exceed 10% of context window). Claude dynamically loads only the tools it needs rather than preloading all of them.

Control with: `ENABLE_TOOL_SEARCH=auto:5` (enable at 5% threshold)

📖 [MCP documentation](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-mcp)

---

## 8. Context Management: The Long Game

### 8.1 Compaction

As your conversation grows, Claude's context window fills. Compaction summarizes older messages to free up space, keeping critical information while discarding noise.

- **Auto-compaction** happens automatically as you approach the limit
- **Manual compaction** with `/compact` — do this proactively before starting a new phase of work
- **Custom instructions**: `/compact focus on the database migration decisions and test results`

### 8.2 The PreCompact Hook

Use this to save critical state before compaction wipes it:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/save-session-state.sh"
          }
        ]
      }
    ]
  }
}
```

### 8.3 Session Management

- `/resume` — Pick up where you left off, with full context
- `Ctrl+R` — Quick-resume recent sessions
- `--continue` flag — Continue the most recent session
- `--resume <session-id>` — Resume a specific session

### 8.4 The @-mention System

Reference files inline: `@src/models/order.rb` brings the file into context. This is better than asking Claude to read it because it's faster and more predictable.

Also works for MCP resources: `@server:resource`

### 8.5 Additional Directories

`--add-dir /path/to/shared-libs` lets Claude see files outside your project root. Skills and CLAUDE.md files in those directories are loaded automatically.

---

## 9. Output Styles: Changing How Claude Thinks

Output styles modify Claude's system prompt — they change its _persona_, not just its formatting.

### 9.1 Built-in Styles

- **Default** — Standard software engineering assistant
- **Explanatory** — Adds educational "Insights" between coding steps. Good for learning a new codebase.
- **Learning** — Collaborative mode where Claude leaves `TODO(human)` markers for you to implement. Forces you to engage with the code.

### 9.2 Custom Output Styles

```bash
/output-style:new I want an output style that enforces TDD and always explains architectural tradeoffs
```

Saved as markdown in `~/.claude/output-styles/`. You can also create them manually.

**Key distinction:** Output styles modify the system prompt and "turn off" the default software engineering instructions. CLAUDE.md adds context as a user message _alongside_ the default prompt. `--append-system-prompt` appends to the system prompt without replacing anything.

📖 [Output styles documentation](https://docs.anthropic.com/en/docs/claude-code/output-styles)

---

## 10. The Workflow: Putting It All Together

Here's the opinionated workflow for a feature implementation:

### Phase 1: Plan (5 minutes)

1. Enter Plan Mode (`Shift+Tab` twice or `--permission-mode plan`)
2. Describe the feature with intent, constraints, and verification criteria
3. Let Claude explore the codebase and propose a plan
4. Edit the plan (`Ctrl+G`) if needed
5. Approve the plan

### Phase 2: Test First (10 minutes)

1. Switch to Normal Mode (`Shift+Tab`)
2. "Write failing tests for the first item in the plan. Run them to confirm they fail."
3. Review the tests — are they testing behavior, not implementation?
4. Iterate until the test suite captures your intent

### Phase 3: Implement (variable)

1. "Implement the minimum code to make the failing tests pass."
2. Review each edit. Check that Claude isn't over-engineering.
3. "Run the full test suite."
4. Refactor if needed: "The `OrderProcessor` is doing too much. Extract the payment logic into a `PaymentHandler` service."

### Phase 4: Verify and Commit

1. "Run the linter. Fix any issues."
2. "Run the full test suite one more time."
3. "Create a commit with a descriptive message following conventional commits."
4. Or: "Create a PR with a description that explains the why, not just the what."

### Phase 5: Invest in Infrastructure

After every significant task, ask yourself: what should I codify?

- Did Claude discover a pattern? → Tell it to save to memory
- Did I repeat a constraint in my prompt? → Add it to CLAUDE.md
- Did I describe a workflow? → Make it a skill
- Did I catch Claude making a mistake? → Write a hook to prevent it

---

## 11. Essential Slash Commands Reference

| Command         | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `/compact`      | Manually compact context (add custom focus instructions) |
| `/clear`        | Clear conversation, start fresh                          |
| `/memory`       | Open memory file selector for editing                    |
| `/model`        | Switch models mid-session                                |
| `/agents`       | Manage subagents                                         |
| `/mcp`          | Manage MCP server connections                            |
| `/config`       | Access configuration menu                                |
| `/context`      | Check what's loaded, token usage, skill budget           |
| `/output-style` | Switch output styles                                     |
| `/resume`       | Resume a previous session                                |
| `/doctor`       | Health check your installation and settings              |

---

## 12. Model Selection

- **Opus 4.6** — Default. Best for complex reasoning, architectural decisions, multi-step implementations. Use this for anything that matters.
- **Sonnet 4.6** — Faster and cheaper. Good for mechanical tasks, simple refactors, and subagents that do repetitive work.
- **Haiku 4.5** — Fastest. Use for high-volume, low-complexity tasks in CI/CD or batch operations.

Switch mid-session with `/model`. Override per-subagent with the `model` field in agent definitions.

Thinking mode is enabled by default for Opus. Phrases like "think hard" or "ultrathink" are interpreted as regular instructions — they don't directly allocate more thinking tokens. Instead, Opus 4.6 uses adaptive thinking that dynamically allocates reasoning based on task complexity.

---

## 13. Keyboard Shortcuts Worth Memorizing

| Shortcut    | Action                                               |
| ----------- | ---------------------------------------------------- |
| `Shift+Tab` | Cycle permission modes (Normal → Auto-Accept → Plan) |
| `Ctrl+G`    | Open plan in external editor                         |
| `Ctrl+B`    | Background current task                              |
| `Ctrl+O`    | Toggle verbose mode (see thinking)                   |
| `Ctrl+R`    | Quick-resume recent session                          |
| `Ctrl+C`    | Interrupt current operation                          |
| `Escape`    | Cancel current input                                 |

---

## 14. Anti-Patterns to Avoid

**"Just do it" prompting.** Vague prompts produce vague results. Always include intent, constraints, and verification.

**Context hoarding.** Long sessions without compaction degrade quality. Compact proactively between phases.

**Skipping Plan Mode.** Jumping straight into implementation for complex features leads to rework. The 5 minutes you spend planning saves 30 minutes of backtracking.

**Ignoring auto memory.** If you're not curating what Claude remembers, you're leaving institutional knowledge on the floor.

**One massive CLAUDE.md.** Use `@imports` and `.claude/rules/` to keep things modular and maintainable.

**Not using subagents for verbose work.** Test runners, linters, and code analysis generate lots of output that fills your context. Delegate to subagents.

**Treating Claude as infallible.** Always review. Always run tests. The TDD workflow exists because it creates a mechanical verification loop that doesn't depend on trust.

---

## Quick Reference: Documentation Links

| Topic                    | URL                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview                 | [docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)                                                                                 |
| Setup                    | [docs.anthropic.com/en/docs/claude-code/setup](https://docs.anthropic.com/en/docs/claude-code/setup)                                                                                       |
| Common Workflows         | [docs.anthropic.com/en/docs/claude-code/common-workflows](https://docs.anthropic.com/en/docs/claude-code/common-workflows)                                                                 |
| Memory Management        | [docs.anthropic.com/en/docs/claude-code/memory](https://docs.anthropic.com/en/docs/claude-code/memory)                                                                                     |
| Skills & Slash Commands  | [docs.anthropic.com/en/docs/claude-code/slash-commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)                                                                     |
| Subagents                | [docs.anthropic.com/en/docs/claude-code/sub-agents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)                                                                             |
| Hooks Reference          | [docs.anthropic.com/en/docs/claude-code/hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)                                                                                       |
| Output Styles            | [docs.anthropic.com/en/docs/claude-code/output-styles](https://docs.anthropic.com/en/docs/claude-code/output-styles)                                                                       |
| Prompting Best Practices | [docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) |
| Agent SDK                | [docs.anthropic.com/en/docs/claude-code/sdk](https://docs.anthropic.com/en/docs/claude-code/sdk)                                                                                           |
| CLI Reference            | [docs.anthropic.com/en/docs/claude-code/cli](https://docs.anthropic.com/en/docs/claude-code/cli)                                                                                           |
| Changelog                | [docs.anthropic.com/en/release-notes/claude-code](https://docs.anthropic.com/en/release-notes/claude-code)                                                                                 |

---

_Last updated: February 2026. Claude Code evolves fast — check the [changelog](https://docs.anthropic.com/en/release-notes/claude-code) regularly._
