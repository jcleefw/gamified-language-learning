# Session Log

**Branch**: main

## Sessions

### 2026-03-03 — Engine Package Extraction ADR Interview

**Branch**: main
**Goal**: Create engineering-design ADR for whether SRS and curation engines should be separate packages

**Completed**:
- Read existing monorepo ADR, CONTEXT.md, CODEMAP.md for context
- Completed engineering-design skill interview (6 questions, all answered)
- User confirmed: portability, two separate packages, shared types with generics, pure functions no side effects, testability

**Decisions Made**:
- Engines are "the heart of the app" — must be framework-agnostic and potentially language-portable
- Two packages preferred over one unified engine
- No side effects — pure domain logic
- Shared types via separate package with generics (no duplication)
- Each sub-topic (types strategy, API surface design) may get its own ADR

### 2026-03-03 — Backend Strategy & Headless Architecture

**Goal**: Determine the backend server strategy (Headless vs Monolithic).

**Completed**:
- Decided on a Headless Hono API (Cloudflare Worker) as the central orchestration layer.
- Drafted ADR: `20260303T195134Z-engineering-headless-hono-backend.md`.
- Updated architect questions to mark this item resolved.

**Decisions Made**:
- Backend acts as a Gateway for secrets (Gemini) and I/O (D1/R2).
- Nuxt is treated as a plug-and-play frontend consumer.
- Auth moves to a backend-first strategy.

### 2026-03-03 — Curation Engine Package ADR

**Goal**: Create engineering-design ADR for curation engine as a separate package.

**Completed**:
- Loaded engineering-design skill, conducted full interview (13 questions)
- Wrote ADR: `20260303T210000Z-engineering-curation-engine-package.md`
- Updated architect questions — all 4 original questions now resolved
- Updated CODEMAP.md with new ADR entries

**Decisions Made**:
- Prompt-builder + response-parser pattern (engine never calls Gemini API)
- TTS stays out of engine — calling-layer service, shared infra
- Foundational decks stay out — not curated content, calling-layer validation
- Nuance detection stays in — pluggable per-language registry
- Content lifecycle: Draft → Published ↔ Unpublished (no Draft → Unpublished)
- Edit classification: engine diffs and classifies, calling layer acts
- Summary: curator-authored, max 30 words, validated by engine
- Zod as runtime dep for AI response parsing
- Package structure conventions: co-located tests, domain-scoped types.ts, PascalCase class files

**Next Session Should**:
- Update RULES.md (move examples to docs/, trim, add package conventions)
- Audit open questions across all ADRs and PRDs
- Delete irrelevant session files
- Start ADR #3 (shared types strategy) or #4 (API surface design)

### 2026-03-04 — ANKI Parameters & Word Pool Deck Discussion

**Branch**: main
**Goal**: Resolve open question on ANKI defaults vs mobile-tuned parameters; define word pool deck behavior for eager learners

**Completed**:
- Discussed three approaches (A: pure defaults, B: conservative, C: defaults + cap) with concrete number traces
- Resolved ANKI parameter open question → Approach C (FSRS 0.90 retention + 90-day max interval cap)
- Defined word pool deck as sandbox mode (no ANKI side effects)
- Designed soft signal mechanism (3 wrong all-time → pull review date forward, reset counter)
- Updated SRS PRD §5.11, §8.1, §13
- Updated CONTEXT.md open questions
- Updated SRS Engine ADR `SrsConfig` with `desiredRetention` and `maxInterval`

**Decisions Made**:
- ANKI parameters: Approach C — FSRS defaults + 90-day max interval cap
- Word pool: sandbox mode, analytics-tracked, soft signal at 3 wrong
- No minimum pool size for word pool
- Question type distribution: same as curated (70/20/10), challenge modes deferred
- No separate ADR for word pool — product rules, not architecture

---

## Session Statistics

| Metric | Value |
|--------|-------|
| Total Sessions (this branch) | 4 |
| Average Duration | — |
| Stories Completed | 0 |
| Bugs Fixed | 0 |
