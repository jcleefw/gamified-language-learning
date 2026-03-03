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

**See WORKFLOW.md for complete naming rules:**

- **File timestamps**: `YYYYMMDDTHHmmssZ` in UTC+10
- **Slugs**: camelCase → converted to kebab-case in filenames
- **Components**: PascalCase (`UserCard.vue`, `WordQuizBatch.tsx`)
- **Utilities**: camelCase (`formatDate.ts`, `parseWordBreakdown.ts`)
- **CSS variables**: kebab-case (`--primary-foreground`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ACTIVE_WORDS`)
- **Database tables/columns**: snake_case (`user_sessions`, `created_at`)

---

## Code Standards (Mandatory)

### 1. Explicit Types

- **No `any`** — Every value, callback, and function signature must have an explicit type
- **Typed callbacks**: `(word: Word, index: number) => void` not `(w, i) => {}`
- **Function args and returns**: Always annotated, no implicit inference
- **Complex objects**: Define interfaces or types; do not use inline object shapes

**Example (GOOD)**:
```typescript
interface QuizAnswer {
  wordId: string;
  selectedChoice: string;
  isCorrect: boolean;
  timestamp: Date;
}

function recordAnswer(answer: QuizAnswer): void {
  // ...
}
```

**Example (BAD)**:
```typescript
function recordAnswer(answer: any): void { }
```

---

### 2. Descriptive Names

- **No single-letter variables** (except loop indices: `i`, `j`, `k`)
- **Names must explain intent** without reading surrounding code
- **Prefixes for clarity**: `is`, `has`, `can`, `should`, `get`, `set` for boolean/getter functions

**Example (GOOD)**:
```typescript
const isWordMastered = mastery.count >= MASTERY_THRESHOLD;
const hasActiveLearnedWords = activeWindow.length > 0;
const getNextReviewInterval = (lapsedCount: number) => ANKI_INTERVALS[lapsedCount];
```

**Example (BAD)**:
```typescript
const m = mastery.count >= MASTERY_THRESHOLD;
const a = activeWindow.length > 0;
const nri = (l) => ANKI_INTERVALS[l];
```

---

### 3. Self-Documenting Code

- **Code explains itself** — names and structure are clear without comments
- **Add comments only** when logic is non-obvious (complex algorithm, domain-specific rule, workaround)
- **Avoid**: Restating obvious code in comments

**Example (GOOD)**:
```typescript
// ANKI lapse rule: 3 failures drops word back to learning phase
if (word.lapseCount >= 3) {
  word.phase = 'learning';
  word.masteryCount = 0;
}
```

**Example (BAD)**:
```typescript
// Increment lapse count
word.lapseCount++;
// Set phase to learning
word.phase = 'learning';
```

---

### 4. No Generic Patterns

- **Favor domain-specific solutions** over over-engineered abstractions
- **Three-line duplication is acceptable** if it avoids premature abstraction
- **Extract only when**: Pattern repeats 3+ times AND the abstraction is obvious
- **Avoid**: "Just in case" utilities, feature flags for hypothetical scenarios

**Example (GOOD)**:
```typescript
// In quiz.ts
const multipleChoiceQuestions = questions.filter(q => q.type === 'MC').slice(0, 10);

// In admin.ts
const reviewQuestions = questions.filter(q => q.type === 'review').slice(0, 5);
// ↑ Two similar lines — acceptable without extracting
```

**Example (BAD)**:
```typescript
// utils/filterAndSlice.ts
export const filterAndSlice = (items, predicate, limit) => items.filter(predicate).slice(0, limit);
// ↑ Over-engineered for two call sites
```

---

## Testing Protocol

### The "Two-Strike" Failure Rule

1. If a test/task fails at the **same step twice** → **STOP immediately**
2. Do NOT attempt a third autonomous fix
3. **State clearly**: "Two-Strike limit reached. Attempted [X] and [Y]. Error: [ERROR]"
4. **Escalate**: Ask for help or ask ONE clarifying question

**Why**: Loops waste tokens. Better to get human input than spin.

**Example**:
```
❌ Attempt 1: Fixed type error in QuizBatch.vue → test still fails at "mastery calculation"
❌ Attempt 2: Recalculated mastery logic → test still fails at "mastery calculation"
🛑 Two-Strike limit reached. Need clarification on expected mastery formula.
```

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

A story is NOT complete until:

1. **Code is merged/staged** for review
2. **Tests pass** (unit + integration + manual verification)
3. **Changelog generated** in `.agents/changelogs/EP##--slug/`
4. **Phased stop**: Ask "Ready for the next story?"
5. **CODEMAP synced**: Update if new files or entry points changed
6. **Memory updated**: Update `.agents/memory/{branch}/current-focus.md`

---

## Memory Protocol

The agent writes to `.agents/memory/{branch}/` at these trigger points:

| Trigger | File to Update | Content |
|---------|----------------|---------|
| Story completed | `current-focus.md` | What was completed, what's next |
| Decision made | `recent-decisions.md` | Why the decision, alternatives considered |
| Blocker hit | `blocked-items.md` | What's blocked, why, what's needed to unblock |
| Session end | `session-log.md` | Summary of session work and next steps |

---

## Epic Freeze Rule

**No new requirements after `impl-complete`.**

Once an epic reaches `impl-complete`, its scope is frozen:
- ✅ BDD test writing is allowed (verification only)
- ✅ Bug fixes found during BDD → create standalone `BUG##`
- ❌ New stories, new design specs, or scope changes → create a new Epic

---

## Guardrails (Automated Checks)

See `.agents/guardrails.yml` for implementation details.

Guardrails enforce:
- ☑️ Block dangerous commands (`rm -rf`, `git push --force`, `DROP TABLE`, etc.)
- ☑️ Require approval for sensitive file edits (`.env*`, `db/migrate/**`, Docker files)
- ☑️ Prevent schema changes without review
- ☑️ Auto-approve safe reads (documentation files)

---

## When in Doubt

1. **Stop** — Do not guess or assume
2. **Ask ONE specific question** — Not "is this okay?" but "Should I use X or Y because Z?"
3. **Wait for answer** — Do not continue autonomously
4. **Document the decision** in `.agents/memory/{branch}/recent-decisions.md`

