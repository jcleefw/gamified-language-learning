# Current Focus

**Branch**: main
**Updated**: 2026-03-03

## Active Work

- **Epic**: N/A — Architecture planning phase
- **Story**: N/A
- **Status**: In progress

## Last Session Outcome

Completed engineering-design interview for package extraction. No ADR written yet — user wants **separate ADRs per topic**, not an umbrella ADR.

## Key Decisions from Interview

- **Portability is the primary driver**: Engines are "the heart of the app" — must be framework-agnostic, swappable across frontends (Vue/React/Angular), potentially rewritable in another language
- **Two separate packages**: `packages/srs-engine` + `packages/curation-engine` (not unified)
- **Pure logic, no side effects**: No HTTP, no DB, no Vue, no Cloudflare bindings. Calling layer handles all I/O
- **Shared types**: Separate `packages/shared-types` with TypeScript generics to avoid duplication
- **Testing in isolation**: A key driver for extraction
- **API surface**: Open to classes, modules, or prototypes — wants dedicated discussion

## ADRs To Write (Each Needs Its Own Discussion)

1. ~~**SRS engine as separate package**~~ — ✅ Done (`20260302T160536Z-engineering-srs-engine-package.md`)
2. **Curation engine as separate package** — scope, boundaries, what goes in/out
3. **Shared types strategy** — each engine owns its types (decided in SRS ADR), may revisit for truly shared primitives
4. **API surface design** — class-based confirmed (`new SrsEngine(config)`), exact method signatures pending
5. **Backend server need** — item #4 from `product-documentation/architecture/questions for achitect.md`

## Immediate Next Steps

1. Start a new conversation for the first ADR topic
2. Reference this memory file for context

## Context for Next Session

- Reference file: `product-documentation/architecture/questions for achitect.md`
- Existing monorepo ADR: `product-documentation/architecture/20260227T022513Z-engineering-monorepo-tooling.md`
- Recommendation from this session: pure logic packages, zero framework deps, data in → data out
