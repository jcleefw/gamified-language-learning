# ADR: Curation Engine as a Separate Package

**Status:** Accepted

**Date:** 2026-03-03

**Deciders:** Solo founder

---

## Context

The content curation workflow is one of two core domain engines in the platform. It covers AI-assisted conversation generation, word breakdown extraction, content lifecycle management, and curator workflow logic. The SRS engine ADR (`20260302T160536Z-engineering-srs-engine-package.md`) established the pattern: pure logic packages in `packages/`, no I/O, no framework dependencies, class-based API, engine-owned types.

The curation engine has a unique challenge the SRS engine doesn't: its core workflow involves **AI generation via Gemini API** — an inherently I/O-bound operation. The engine must remain pure despite this dependency sitting at the heart of its domain.

The accepted monorepo ADR (`20260227T022513Z-engineering-monorepo-tooling.md`) and SRS engine ADR establish `packages/` as the home for extracted domain logic.

---

## Decision

Extract all content curation logic into **`packages/curation-engine`** — a pure, side-effect-free TypeScript package with a class-based API.

### I/O Boundary: Prompt-Builder + Response-Parser Pattern

The engine **never calls any external API**. Instead, it owns two halves of the AI interaction:

1. **Prompt construction**: The engine assembles the full structured prompt (generic requirements + language-specific prompt + curator parameters) and returns it as a typed object.
2. **Response parsing**: The engine receives the raw AI response from the calling layer and parses/validates it into typed domain structures using Zod schemas.

The calling layer is responsible for sending the prompt to Gemini and passing the raw response back to the engine. This keeps the engine 100% synchronous, pure, and testable with zero mocks.

```
Calling Layer                          Curation Engine
─────────────                          ───────────────
1. Curator provides params
2. ─── params ──────────────────────→  engine.buildConversationPrompt(params)
3. ←── StructuredPrompt ────────────   (pure, microseconds)
4. Send prompt to Gemini API
5. ←── raw AI response
6. ─── rawResponse ─────────────────→  engine.parseConversationResponse(raw)
7. ←── ParsedConversation ──────────   (validated via Zod)
8. Persist to D1
   ... curator reviews, triggers breakdown ...
9. ─── conversation ────────────────→  engine.buildBreakdownPrompt(conversation)
10.←── StructuredPrompt ────────────
11. Send prompt to Gemini API
12.←── raw AI response
13.─── rawResponse ─────────────────→  engine.parseBreakdownResponse(raw)
14.←── ParsedBreakdown ─────────────   (validated via Zod)
15.─── breakdowns ──────────────────→  engine.deduplicateWords(breakdowns)
16.←── UniqueWord[] ────────────────
17. Persist to D1
```

### What Goes In

| Responsibility | Description | PRD Reference |
|---|---|---|
| **Conversation prompt construction** | Assemble full prompt from generic + language-specific + curator params (topic, line count, difficulty, register) | §5.1 |
| **Conversation response parsing** | Parse + validate Gemini response into typed conversation lines (speaker, target text, translation) via Zod | §5.1 |
| **Breakdown prompt construction** | Assemble breakdown prompt from a reviewed conversation | §5.1 |
| **Breakdown response parsing** | Parse + validate into per-line word components (word, meaning, part of speech) via Zod | §5.1 |
| **Prompt merge logic** | Merge generic requirements + language-specific prompt + curator overrides into final prompt. Engine defines prompt schema (typed interfaces) | §5.4 |
| **Word deduplication** | Derive unique words from all line breakdowns — same word across multiple lines → single entity | §5.1 |
| **Content lifecycle state machine** | Enforce Draft → Published ↔ Unpublished transitions. Validate publish preconditions (breakdown complete, summary valid). Reject invalid transitions (e.g., Draft → Unpublished) | §5.7 |
| **Edit classification** | Diff old vs. new conversation, classify each change as minor (English meaning, notes) or destructive (target language text changed → new word entity) | §5.8 |
| **Nuance detection** | Auto-detect language-specific attributes from parsed content (e.g., Thai speaker gender from gendered particles). Pluggable per-language registry | §5.3 |
| **Summary validation** | Validate curator-authored summary: max 30 words, concise, no filler connector words | §5.11 |
| **Conversation duplication** | Produce a skeleton from an existing conversation: copy topic + summary, no lines copied. Ready for new generation in target language | §5.6 |
| **Configuration validation** | Validate that provided config values are sane (e.g., valid difficulties, valid registers, summary word limit > 0) | — |

### What Stays Out

| Responsibility | Where It Lives | Why |
|---|---|---|
| Gemini API calls (sending prompts, receiving responses) | Calling layer (Hono backend / Workers) | Engine has no I/O |
| D1 queries (read/write conversations, words, prompts) | Calling layer | Engine has no I/O |
| System prompt CRUD (store/retrieve/save custom prompts) | Calling layer (D1 persistence) | Storage concern — engine owns merge logic only |
| TTS audio generation, playback, storage | Calling-layer service (`ttsService.ts`) | Shared infra concern, inherently I/O-bound, consumed by both curation and SRS paths |
| Foundational deck validation/ingestion | Calling layer (Zod schema validation) | Not curated content — predefined reference data, doesn't fit engine purpose |
| Curator collaboration toggle (allow others to edit) | Calling layer | Authorization concern — engine has no user/permission awareness |
| Vue composables, UI components | `apps/web` | Framework-specific presentation layer |
| Authentication / session management | `nuxt-auth-utils` / Hono auth middleware | Infrastructure concern |

### Content Lifecycle State Machine

Three states, three valid transitions:

```
Draft ──────→ Published ←──────→ Unpublished
              (validated)        (always allowed)
```

- **Draft → Published**: requires validation (breakdown complete, summary valid, all fields present)
- **Published → Unpublished**: always allowed, no preconditions
- **Unpublished → Published**: same validation as initial publish (re-publish after withdrawal)
- **Draft → Unpublished**: invalid — "unpublished" means "was published, now withdrawn"

The engine owns transition validation. Downstream effects of unpublishing (learner-side: active window words finish naturally, deck removed from topic list) are SRS domain — the calling layer coordinates this.

### Edit Classification

When a curator edits a published conversation, the engine classifies each change:

- **Minor edit**: English meaning, romanization, notes, audio metadata changed. Target language text unchanged. Learner mastery unaffected — propagates immediately.
- **Destructive edit**: Target language text itself changed (e.g., `กิน` → `ทาน`). Old word retains its mastery progress. New word enters as unlearned.

The engine returns `EditClassification[]` — the calling layer decides what to persist (update in place vs. create new word entity + warn curator).

### Package Structure

```
packages/curation-engine/
├── src/
│   ├── index.ts                      # Public API exports
│   ├── CurationEngine.ts             # CurationEngine class
│   ├── prompts/
│   │   ├── conversationPrompt.ts     # Conversation prompt construction + merge
│   │   ├── breakdownPrompt.ts        # Breakdown prompt construction + merge
│   │   ├── types.ts                  # Prompt-domain types
│   │   └── __tests__/
│   │       ├── conversationPrompt.test.ts
│   │       └── breakdownPrompt.test.ts
│   ├── parsers/
│   │   ├── conversationParser.ts     # Parse + validate Gemini conversation response
│   │   ├── breakdownParser.ts        # Parse + validate Gemini breakdown response
│   │   ├── types.ts                  # Parser-domain types
│   │   └── __tests__/
│   │       ├── conversationParser.test.ts
│   │       └── breakdownParser.test.ts
│   ├── lifecycle/
│   │   ├── stateMachine.ts           # State transitions, publish validation
│   │   ├── editClassification.ts     # Diff + classify edits
│   │   ├── types.ts                  # Lifecycle-domain types
│   │   └── __tests__/
│   │       ├── stateMachine.test.ts
│   │       └── editClassification.test.ts
│   ├── words/
│   │   ├── deduplication.ts          # Unique word derivation from breakdowns
│   │   ├── types.ts                  # Word-domain types
│   │   └── __tests__/
│   │       └── deduplication.test.ts
│   ├── nuance/
│   │   ├── detector.interface.ts     # NuanceDetector registry interface
│   │   ├── thai.ts                   # Thai-specific detection rules
│   │   ├── types.ts                  # Nuance-domain types
│   │   └── __tests__/
│   │       └── thai.test.ts
│   ├── summary/
│   │   ├── validation.ts            # Summary word count, conciseness validation
│   │   └── __tests__/
│   │       └── validation.test.ts
│   └── types.ts                      # Shared/generic types across domains
├── __tests__/
│   └── integration/                  # Cross-domain lifecycle scenario tests
├── package.json
├── tsconfig.json
└── CHANGELOG.md
```

**Conventions** (apply to all engine packages):
- Unit tests co-located with domain in `__tests__/` subdirectories
- PascalCase for class files (`CurationEngine.ts`), camelCase for utility files (`conversationPrompt.ts`)
- Each domain folder has its own `types.ts` for private types; top-level `types.ts` for shared/generic types only
- Integration tests at package root — cross-domain scenarios only

### API Surface

Class-based, config baked in at construction:

```ts
const engine = new CurationEngine({
  summaryMaxWords: 30,
  lineCounts: [1, 2, 4, 6],
  difficulties: ['beginner', 'intermediate', 'advanced'],
  registers: ['formal', 'informal', 'mixed'],
})

// Prompt building
engine.buildConversationPrompt(params)        // → StructuredPrompt
engine.buildBreakdownPrompt(conversation)     // → StructuredPrompt

// Response parsing
engine.parseConversationResponse(raw)         // → ParsedConversation | ValidationErrors
engine.parseBreakdownResponse(raw)            // → ParsedBreakdown | ValidationErrors

// Word processing
engine.deduplicateWords(breakdowns)           // → UniqueWord[]

// Content lifecycle
engine.validateForPublish(conversation)       // → { valid: boolean; reasons?: string[] }
engine.transitionState(conversation, target)  // → NewState | ValidationError

// Edit classification
engine.classifyEdit(old, new)                 // → EditClassification[]

// Duplication
engine.duplicateForTranslation(conversation)  // → ConversationSkeleton

// Validation
engine.validateSummary(text)                  // → { valid: boolean; reason?: string }
```

Exact method signatures deferred to ADR #4 (API surface design).

### Types Ownership

The engine **defines and exports its own types** (`ParsedConversation`, `ParsedBreakdown`, `UniqueWord`, `ConversationState`, `EditClassification`, `StructuredPrompt`, `CurationConfig`, etc.). It does not import types from `packages/shared-types`, `packages/srs-engine`, or any other package. The calling layer maps between engine types and database/API shapes.

Each domain folder within the package has its own `types.ts` for domain-private types. The top-level `src/types.ts` contains only types shared across multiple domains within the package.

### Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| `zod` | Runtime | Validate/parse Gemini API responses into typed structures |
| `vitest` | Dev | Unit + integration tests |
| `typescript` | Dev | Type checking, build |

Hard rule: **no framework dependencies** (no Vue, no Nuxt, no Cloudflare bindings, no HTTP libraries, no database drivers, no AI API clients).

### Versioning

Semver with changelog generated from commits. Even as an internal `workspace:*` package, version bumps signal breaking changes and maintain a publication-ready history.

---

## Rationale

**Prompt-builder + response-parser (Option A over injected adapter):** The engine stays 100% synchronous and pure. No async, no side effects, no mocks needed in tests. The calling layer handles the single Gemini API call — trivial orchestration. An injected adapter would give the engine workflow ownership but at the cost of async code, interface mocking, and a blurred I/O boundary.

**Full domain ownership (Option A over Option B):** The engine owns the complete curation lifecycle — prompt construction, response parsing, word deduplication, lifecycle management, edit classification. The calling layer is a thin I/O orchestrator. This keeps all curation rules in a single authority with no logic drift.

**Class-based API:** Consistent with SRS engine. Config baked in at construction avoids repetitive config passing. Internally pure — no I/O or side effects despite class syntax.

**Engine-owned types with domain-scoped types.ts:** Each domain folder has private types that don't leak to other domains. Top-level types.ts holds only cross-domain shared types. This prevents a single 500-line types file and makes each domain self-contained.

**Co-located unit tests:** Tests live next to the code they test, not in a parallel tree. Reduces navigation overhead and makes it obvious when a module is missing tests.

**TTS out of engine:** TTS is shared infrastructure consumed by both curation and SRS. It's inherently I/O-bound (API calls, R2 storage, queue management). No meaningful pure logic to extract — stays as a calling-layer service (`ttsService.ts`).

**Foundational decks out of engine:** Foundational decks are predefined reference data, not curated content. The engine's purpose is the AI-assisted curation workflow. Foundational deck validation is simple schema validation — Zod in the calling layer suffices.

**Zod as runtime dependency:** The engine parses unstructured AI output — runtime validation is essential, not optional. Zod provides typed schemas that serve as both validator and type source. Justified over hand-written parsers.

**Nuance detection in-engine:** Operates on parsed conversation data the engine already owns. Pure functions (text in → detected attributes out). Designed as a pluggable per-language registry for clean future extraction if a second consumer emerges.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| Keep curation logic in server services | No package overhead | Coupled to Nuxt/Cloudflare, untestable without mocking I/O, not portable | Violates portability requirement |
| Injected adapter for Gemini (Option B) | Engine owns full workflow including API call orchestration | Requires async, interface mocking in tests, blurred I/O boundary | Purity is more valuable than workflow encapsulation |
| Include TTS in curation engine | Single package for all curation | TTS is shared with SRS, inherently I/O-bound, doesn't fit pure logic pattern | Separate concern with multiple consumers |
| Include foundational decks in engine | All content validation in one place | Foundational decks aren't curated — different concern, doesn't fit engine purpose | Engine purpose is AI-assisted curation workflow |
| Separate nuance detection package | Maximum modularity | One consumer today, tiny scope, creates overhead | Keep in-engine with clean directory boundary; extract if second consumer emerges |
| Zero runtime dependencies | Maximum portability | Reinventing schema validation for unstructured AI output | Impractical; Zod is small, well-scoped, and essential for parsing AI responses |
| Top-level `__tests__/unit/` directory | Centralized test location | Tests disconnected from source, harder to spot missing coverage | Co-located tests are more maintainable |

---

## Consequences

**Positive:**
- Curation logic is testable in complete isolation — no Gemini API, no D1, no Workers mocking
- Package is portable across frontends and runtimes
- Single authority for all curation rules — prompt construction, parsing, lifecycle, edit classification
- Prompt-builder pattern means engine tests are fast and deterministic (no async, no network)
- Zod schemas serve double duty as runtime validators and TypeScript type sources
- Domain-scoped types prevent type file bloat and enforce encapsulation within the package

**Negative / Risks:**
- Calling layer must orchestrate the prompt → API call → parse cycle — 3 steps instead of 1 engine call. Boilerplate but straightforward
- Gemini response format changes require updating Zod schemas in the engine — engine and API are loosely coupled but not independent
- Nuance detection may outgrow its in-engine home if multiple consumers emerge — designed for clean extraction but migration cost exists
- Class-based API decision is preliminary — exact method signatures deferred to ADR #4

**Neutral:**
- Turborepo pipeline must include `curation-engine` as a dependency — requires `turbo.json` update
- ESLint flat config needs a new glob layer for `packages/curation-engine/**` (TypeScript strict)
- Package structure conventions (co-located tests, domain-scoped types, naming) apply to all engine packages — to be recorded in RULES.md

---

## Open Questions

| Question | Owner | Target |
|---|---|---|
| Exact method signatures and class API design | Architect | ADR #4 (API surface design) |
| Package name — `@projectname/curation-engine` or unscoped `curation-engine`? | Dev | Before `package.json` creation |
| Should `CurationEngine.create()` be offered alongside `new CurationEngine()` for ergonomics? | Dev | ADR #4 |
| Gemini response format stability — how often does the response structure change? Affects Zod schema maintenance burden | Dev | Before implementation |
| Summary word count limit (30) — sufficient for all languages? May need per-language override | Dev | During implementation |

---

*Related ADRs:*
- [SRS Engine Package](20260302T160536Z-engineering-srs-engine-package.md)
- [Monorepo Tooling](20260227T022513Z-engineering-monorepo-tooling.md)
- [Headless Hono Backend](20260303T195134Z-engineering-headless-hono-backend.md)
- [Cloudflare Platform](20260301T161844Z-infra-cloudflare-platform.md)
- Shared Types Strategy — resolved inline (each engine owns its types; no shared-types package)
- API Surface Design — ADR #4 (pending)
