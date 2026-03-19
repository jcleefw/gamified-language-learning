# ADR: SRS Engine as a Separate Package

**Status:** Superseded by [20260319T000000Z-engineering-srs-engine-v2-learning-phase.md](20260319T000000Z-engineering-srs-engine-v2-learning-phase.md)

**Date:** 2026-03-02

**Deciders:** Solo founder

---

## Context

The SRS learning path is the core learning loop of the platform — mastery tracking, spaced repetition scheduling, batch composition, active window management, stuck word handling, and foundational deck mechanics. The current expected structure (CODEMAP.md) places this logic in `src/server/services/srsService.ts` and `src/server/services/quizBatchService.ts`, coupling it to the Nuxt server layer and Cloudflare D1.

The founding constraint is **portability**: the SRS engine is "the heart of the app" and must be framework-agnostic, testable in isolation, and potentially rewritable in another language. This means zero dependencies on Vue, Nuxt, Cloudflare bindings, HTTP, or any database driver.

The accepted monorepo ADR (`20260227T022513Z-engineering-monorepo-tooling.md`) establishes `packages/` as the home for shared, independently buildable packages managed by pnpm workspaces + Turborepo.

A prior engineering interview (2026-03-03) confirmed two separate engine packages (`srs-engine` and `curation-engine`) with pure logic, no side effects, and no cross-engine dependencies.

---

## Decision

Extract all SRS learning logic into **`packages/srs-engine`** — a pure, side-effect-free TypeScript package with a class-based API.

### What Goes In

| Responsibility                  | Description                                                                                                                                                                                                                   | PRD Reference |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Mastery counting**            | +1 correct / -1 wrong, floor at 0, configurable thresholds (5 foundational, 10 curated)                                                                                                                                       | §5.4          |
| **Phase transitions**           | Learning → ANKI review on mastery threshold; ANKI → Learning on 3 lapses (mastery reset to 0)                                                                                                                                 | §5.4, §5.5    |
| **ANKI scheduling**             | Interval calculation, ease factor, lapse tracking — via `ts-fsrs` behind an internal abstraction                                                                                                                              | §5.5          |
| **Batch composition**           | Build a batch of 15 questions: priority ordering (carry-over → foundational revision → new words → foundational learning), question type distribution (70/20/10 or post-depletion split), audio unavailability redistribution | §5.1, §5.3    |
| **Active window management**    | 8-word limit, 4-new-per-batch cap, sliding window entry on mastery                                                                                                                                                            | §5.2          |
| **Stuck word logic**            | No progress after 3 batches → shelved 1 day, max 2 shelved, re-entry as carry-over                                                                                                                                            | §5.9          |
| **Foundational deck mechanics** | 3 active at a time, continuous wrong rule (3 wrong → reset), 20% → 5% allocation shift on depletion                                                                                                                           | §5.6          |
| **Answer processing**           | Process a completed batch of answers, return updated mastery states. Wrong words carry over to next batch via existing priority rules — no mid-batch re-insertion                                                             | §5.7          |
| **Configuration validation**    | Validate that provided config values are sane (e.g., batch size > 0, thresholds > 0)                                                                                                                                          | §5.14         |

### What Stays Out

| Responsibility                                       | Where It Lives                               | Why                                    |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| D1 queries (read word states, write mastery updates) | Calling layer (Nuxt server routes / Workers) | Engine has no I/O                      |
| Audio file serving / TTS generation                  | TTS system / R2                              | Separate concern                       |
| Vue composables (`useQuizBatch`, `useWordMastery`)   | `apps/web`                                   | Framework-specific                     |
| Authentication / session management                  | `nuxt-auth-utils`                            | Infrastructure concern                 |
| Deck CRUD (create, publish, unpublish)               | Calling layer / curation engine              | Content management, not learning logic |
| Question rendering / UI                              | `apps/web` components                        | Presentation layer                     |

### Package Structure

```
packages/srs-engine/
├── src/
│   ├── index.ts                  # Public API exports
│   ├── srs-engine.ts             # SrsEngine class
│   ├── mastery.ts                # Mastery counting, phase transitions
│   ├── batch.ts                  # Batch composition, priority ordering
│   ├── active-window.ts          # 8-word window management
│   ├── stuck-words.ts            # Shelving logic
│   ├── foundational.ts           # Foundational deck mechanics
│   ├── scheduling/
│   │   ├── scheduler.interface.ts  # SpacedRepetitionScheduler abstraction
│   │   └── fsrs-scheduler.ts       # ts-fsrs adapter
│   └── types.ts                  # All engine-owned types
├── __tests__/
│   ├── unit/                     # Per-function unit tests
│   └── integration/              # Lifecycle scenario tests (5-10)
├── package.json
├── tsconfig.json
└── CHANGELOG.md
```

### API Surface

Class-based, config baked in at construction:

```ts
const engine = new SrsEngine({
  batchSize: 15,
  masteryThreshold: { curated: 10, foundational: 5 },
  activeWordLimit: 8,
  newWordsPerBatch: 4,
  questionTypeSplit: { mc: 0.7, wordBlock: 0.2, audio: 0.1 },
  shelveAfterBatches: 3,
  maxShelved: 2,
  lapseThreshold: 3,
  continuousWrongThreshold: 3,
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxInterval: 90, // days — prevents words from vanishing for months
});

// Core operations
engine.composeBatch(wordStates); // → Batch (15 questions, typed, ordered)
engine.processAnswers(answers, states); // → UpdatedWordState[]
```

Exact method signatures deferred to ADR #4 (API surface design).

### Data Flow

```
Calling Layer (Nuxt server route / Worker)         SRS Engine (in-process)
─────────────────────────────────────────         ─────────────────────────
1. Query D1 → fetch word states for user+deck
2. ──── wordStates ────────────────────────────→  engine.composeBatch(wordStates)
3. ←── batch (15 questions) ───────────────────   (pure function, microseconds)
4. Serve batch to frontend
   ... user completes quiz ...
5. Receive 15 answers from frontend
6. ──── answers + wordStates ──────────────────→  engine.processAnswers(answers, states)
7. ←── updatedStates ──────────────────────────   (mastery changes, phase transitions)
8. Write updatedStates to D1
9. Repeat from step 1 for next batch
```

**Per-batch cost:** 1 D1 read (~50 rows) + 1 D1 write (~15 rows). At 10 users × 10 decks/day × 10 batches/deck = 50,000 reads + 15,000 writes/day — well within D1 free tier (5M reads, 100K writes).

### Types Ownership

The engine **defines and exports its own types** (`WordState`, `MasteryPhase`, `QuizAnswer`, `Batch`, `SrsConfig`, etc.). It does not import types from `packages/shared-types` or `packages/curation-engine`. The calling layer maps between engine types and database/API shapes.

Each engine is fully standalone — `srs-engine` and `curation-engine` have no knowledge of each other's type shapes. The calling layer consumes what it needs from each.

### ANKI Scheduler Abstraction

`ts-fsrs` is used as the initial scheduler, wrapped behind an internal interface:

```ts
interface SpacedRepetitionScheduler {
  scheduleReview(word: WordState, isCorrect: boolean): ReviewResult
  getNextInterval(word: WordState): number
}

class FsrsScheduler implements SpacedRepetitionScheduler { ... }
```

This allows swapping to a custom implementation without changing the engine's public API or any consumer code.

### Dependencies

| Dependency   | Type                | Purpose                              |
| ------------ | ------------------- | ------------------------------------ |
| `ts-fsrs`    | Runtime             | ANKI scheduling (behind abstraction) |
| `date-fns`   | Runtime (if needed) | Date math for interval calculations  |
| `vitest`     | Dev                 | Unit + integration tests             |
| `typescript` | Dev                 | Type checking, build                 |

Hard rule: **no framework dependencies** (no Vue, no Nuxt, no Cloudflare bindings, no HTTP libraries, no database drivers).

### Versioning

Semver with changelog generated from commits. Even as an internal `workspace:*` package, version bumps signal breaking changes and maintain a publication-ready history.

---

## Rationale

**Full batch ownership (Option A over B):** The engine owns the complete batch lifecycle — composition, priority ordering, question type distribution, and answer processing. This keeps all quiz rules in a single authority. The calling layer is a thin data-fetcher and persister, with no quiz logic to maintain. The D1 query cost is identical between options.

**Class-based API:** Preferred coding style. Configuration is baked in at construction, avoiding repetitive config passing on every call. Internally pure — no I/O or side effects despite class syntax.

**Engine-owned types:** The engine is the brain — it dictates the data shapes it accepts and returns. This makes the package fully self-contained and portable. No dependency on a shared-types package or the curation engine.

**ts-fsrs behind abstraction:** Battle-tested scheduling math without lock-in. The abstraction allows swapping to a custom implementation if the library doesn't fit the PRD's lapse/fallback rules precisely.

**Minimal deps allowed:** Zero-dep dogma is impractical. Small, well-scoped utilities like `date-fns` are permitted when they avoid reinventing standard operations. The constraint is no framework or I/O dependencies.

**Unit + integration tests:** Unit tests cover individual functions. Integration tests (5-10 lifecycle scenarios) catch bugs that only surface when multiple engine functions interact across a word's lifecycle — e.g., Phase 1 → ANKI → lapse → Phase 1 re-entry with stale stuck-word counters.

---

## Alternatives Considered

| Option                                                   | Pros                                            | Cons                                                                                      | Why Not Chosen                                                                        |
| -------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Keep SRS logic in `src/server/services/`                 | No package overhead, simpler project structure  | Coupled to Nuxt/Cloudflare, untestable without mocking I/O, not portable                  | Violates the portability requirement — the engine can't be extracted or reused        |
| Engine advises, calling layer assembles batch (Option B) | Clearer responsibility split for batch assembly | Quiz rules split across two locations, calling layer must understand composition priority | Same D1 cost, but more maintenance burden on the calling layer and risk of rule drift |
| Shared types package for engine types                    | Single source of truth for `WordState` etc.     | Creates a dependency — engine is no longer self-contained                                 | Undermines portability; engine should be takeable as-is                               |
| Zero runtime dependencies                                | Maximum portability                             | Reinventing date math and scheduling algorithms                                           | Impractical; ts-fsrs and date-fns are small, well-scoped, and justified               |
| No integration tests (unit only)                         | Faster test suite                               | Lifecycle bugs (phase transitions, state resets) only caught in production                | 5-10 scenario tests are lightweight and catch a critical class of bugs                |
| Factory function (`createSrsEngine()`) over class        | More functional style                           | Equivalent technically; class syntax preferred                                            | Coding style preference for `new SrsEngine()` / `SrsEngine.create()`                  |

---

## Consequences

**Positive:**

- SRS logic is testable in complete isolation — no D1, no Workers, no Vue mocking
- Package is portable across frontends (Vue/React/Angular) and runtimes (Node/Bun/Deno/Workers)
- Single authority for all quiz rules — no logic drift between engine and calling layer
- ts-fsrs abstraction allows scheduler replacement without consumer impact
- Semver changelog provides clear upgrade path if published externally

**Negative / Risks:**

- Calling layer must map between D1 row shapes and engine types — boilerplate mapping code
- ts-fsrs may not perfectly match the PRD's lapse/fallback rules — may need custom adapter logic or eventual replacement
- Class-based API decision is preliminary — exact method signatures deferred to ADR #4

**Neutral:**

- Turborepo pipeline must include `srs-engine` as a dependency of `apps/web` and/or `packages/backend` — requires `turbo.json` update
- ESLint flat config needs a new glob layer for `packages/srs-engine/**` (TypeScript strict)

---

## Open Questions

| Question                                                                                          | Owner     | Target                         |
| ------------------------------------------------------------------------------------------------- | --------- | ------------------------------ |
| Exact method signatures and class API design                                                      | Architect | ADR #4 (API surface design)    |
| Does `ts-fsrs` support the 3-lapse fallback rule natively, or does the adapter need custom logic? | Dev       | Before implementation          |
| Should `SrsEngine.create()` be offered alongside `new SrsEngine()` for ergonomics?                | Dev       | ADR #4                         |
| Package name — `@projectname/srs-engine` or unscoped `srs-engine`?                                | Dev       | Before `package.json` creation |

---

_Related ADRs:_

- [Monorepo Tooling](20260227T022513Z-engineering-monorepo-tooling.md)
- [Infra — Cloudflare Platform](20260301T161844Z-infra-cloudflare-platform.md)
- Curation Engine Package — ADR #2 (pending)
- Shared Types Strategy — ADR #3 (pending)
- API Surface Design — ADR #4 (pending)
