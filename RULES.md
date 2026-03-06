# RULES.md

Read this before starting any task. **These rules override all other instructions.**

---

## Golden Rules (Override Everything)

| # | Rule | Meaning |
|---|------|---------|
| 1 | **Platform Agnostic** | This governance system works with ANY AI coding agent (Claude Code, Cursor, Windsurf, or future tools). No platform lock-in. All artifacts live in `.agents/` — the universal governance root. |
| 2 | **Token Cautious** | Every file read, every directory scan, every exploratory action costs tokens. Read less, read smarter. Prefer targeted reads over exploration. When isolation available (forked contexts, subagents), use it. |
| 3 | **Automate With Human In The Loop** | Do enough to reduce toil (scaffolding, templates, naming). But every significant action needs approval. Never auto-proceed through phases. Never auto-commit. Never auto-deploy. |
| 4 | **When Unsure, Stop And Ask** | If requirements are ambiguous, if a file seems wrong, if a pattern is unclear — STOP. Ask ONE specific question. Do not guess. Do not assume. Do not "try and see." |

---

## Mandatory Behaviors

### CODEMAP.md Updates

**ALWAYS update CODEMAP.md** when:
- Adding files or directories
- Changing file purposes
- Modifying entry points or main exports
- Restructuring dependencies

**Before finishing any code task**, check if CODEMAP.md needs updating.

---

## Naming Conventions

**See WORKFLOW.md §Naming Conventions** for the full table.

---

## Code Standards (Mandatory)

> Examples for all rules below: [`docs/code-standards-examples.md`](docs/code-standards-examples.md)

### 1. Explicit Types

- **No `any`** — Every value, callback, and function signature must have an explicit type
- **Typed callbacks**: `(word: Word, index: number) => void` not `(w, i) => {}`
- **Function args and returns**: Always annotated, no implicit inference
- **Complex objects**: Define interfaces or types; do not use inline object shapes

### 2. Descriptive Names

- **No single-letter variables** (except loop indices: `i`, `j`, `k`)
- **Names must explain intent** without reading surrounding code
- **Prefixes for clarity**: `is`, `has`, `can`, `should`, `get`, `set` for boolean/getter functions

### 3. Self-Documenting Code

- **Code explains itself** — names and structure are clear without comments
- **Add comments only** when logic is non-obvious (complex algorithm, domain-specific rule, workaround)
- **Avoid**: Restating obvious code in comments

### 4. No Generic Patterns

- **Favor domain-specific solutions** over over-engineered abstractions
- **Three-line duplication is acceptable** if it avoids premature abstraction
- **Extract only when**: Pattern repeats 3+ times AND the abstraction is obvious
- **Avoid**: "Just in case" utilities, feature flags for hypothetical scenarios

---

## Package Structure Conventions

Applies to all packages in `packages/` (engine packages and future shared packages).

| Convention | Rule |
|---|---|
| **Class files** | PascalCase (`CurationEngine.ts`, `FsrsScheduler.ts`) |
| **Utility files** | camelCase (`conversationPrompt.ts`, `deduplication.ts`) — consistent with [Naming Conventions](#naming-conventions) |
| **Unit tests** | Co-located per domain in `__tests__/` subdirectories next to source — not a top-level `__tests__/unit/` tree |
| **Integration tests** | Package root `__tests__/integration/` — cross-domain lifecycle scenarios only |
| **Domain types** | Each domain folder has its own `types.ts` for domain-private types |
| **Shared types** | Top-level `src/types.ts` for types shared across multiple domains within the package |
| **No cross-package type imports** | Each engine defines and exports its own types; calling layer maps between packages |

---

## Testing Protocol

### Unit Test Protocol

| Layer | TDD | Coverage | Done Gate |
|---|---|---|---|
| Engine packages | Strict TDD | All paths | Full package suite pass |
| Backend routes | Pragmatic | Contract-level | Full package suite pass |
| Frontend | Pragmatic | Happy path | Full package suite pass |
| BDD | PRD scenarios + QA impl | Medium | Deferred to UI stage |

### The "Two-Strike" Failure Rule

1. If a test/task fails at the **same step twice** → **STOP immediately**
2. Do NOT attempt a third autonomous fix
3. **State clearly**: "Two-Strike limit reached. Attempted [X] and [Y]. Error: [ERROR]"
4. **Escalate**: Ask for help or ask ONE clarifying question

---

## Implementation Process

### Phased Implementation (Mandatory)

For any story or task:

1. **PLAN Phase**: Understand requirements, identify files to read
2. **CODE Phase**: Write code following code standards
3. **TEST Phase**: Run tests, verify acceptance criteria
4. **REVIEW Phase**: Self-review for standards compliance, CODEMAP updates

**After each phase, STOP and ask**: "Ready for next phase?"

**Do NOT auto-proceed.** The human reviews after each phase.

**Exception**: Trivial fixes (typo, single-line syntax) may skip ceremony.

**Story-level state**: No formal story states — PLAN/CODE/TEST/REVIEW phases + full package suite pass is sufficient. Ask "Ready for next story?" when done.

---

## Commit Discipline

- One commit per story, at end of REVIEW phase, after full package suite passes.
- Implementation + tests in one commit — never split.
- Format: `feat(EP##-ST##): [what]. [why in body].`
- Conventional types: `feat`, `fix`, `chore`, `docs`, `refactor`.

---

## Token-Saving Protocol

### CODEMAP-Conditional Reading

Use CODEMAP.md as a navigation aid — **not as a mandatory first step for every interaction**.

| Situation | Action |
|-----------|--------|
| Navigating unfamiliar territory | Read CODEMAP first → identify relevant files → read those |
| You know the exact file | Go direct — skip CODEMAP |
| Unsure which files matter | Read CODEMAP (Golden Rule #4: when unsure, stop and ask) |

**NEVER**: List directory → read everything → figure out what matters

### Context Budget Rule

Before reading more than 5 files, ask: **"Do I need all of these?"**

### Story-Scoped Context Blocks

When implementing a story from a Design Spec, read ONLY the files listed in the story's **Read List** section.

### Delegation for Verbose Work

When a workflow step is marked `delegate: true` (or when output is large), isolate work in a separate context if the platform supports it (subagent, background task, forked context).

---

## Story Completion Protocol

See **WORKFLOW.md §Epic Lifecycle** for full lifecycle.

**In a worktree (parallel epic branch):**
Checklist: tests pass → changelog generated → CODEMAP synced → memory updated → `git push` → `gh pr create` → **STOP. Tell the human the PR is ready. Do NOT merge. Do NOT checkout main.**

**On main (serial work):**
Checklist: tests pass → changelog generated → CODEMAP synced → memory updated → commit → ask "Ready for next story?"

---

## Memory Protocol

> **IMPORTANT**: Do NOT use any platform-specific auto-memory system (e.g., Claude Code's `~/.claude/` directory). All project memory is in `.agents/memory/{branch}/` only.

The agent writes to `.agents/memory/{branch}/` at these trigger points. For detailed update guidelines, see `.agents/tools/memory-write-guide.md`.

| Trigger | File to Update | Content |
|---------|----------------|---------|
| Story completed | `current-focus.md` | What was completed, what's next |
| Decision made | `recent-decisions.md` | Why the decision, alternatives considered |
| Blocker hit | `blocked-items.md` | What's blocked, why, what's needed to unblock |
| Session end | `session-log.md` | Summary of session work and next steps |

---

## Epic Freeze Rule

No new requirements after `impl-complete`. See WORKFLOW.md §Epic Lifecycle for details.

---

## Guardrails

See `.agents/guardrails.yml` — blocks dangerous commands, requires approval for sensitive file edits, prevents schema changes without review.

---

## When in Doubt

1. **Stop** — Do not guess or assume
2. **Ask ONE specific question** — Not "is this okay?" but "Should I use X or Y because Z?"
3. **Wait for answer** — Do not continue autonomously
4. **Document the decision** in `.agents/memory/{branch}/recent-decisions.md`

