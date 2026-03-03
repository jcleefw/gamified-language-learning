# Current Focus

**Branch**: main
**Updated**: 2026-03-03

## Active Work

- **Epic**: N/A — Architecture planning phase
- **Story**: N/A
- **Status**: Housekeeping complete

## Last Session Outcome

Completed two follow-up tasks from the curation engine ADR session:

### Task 1: RULES.md Restructure (271 → 201 lines)
- Moved GOOD/BAD code examples from Code Standards section to `docs/code-standards-examples.md` (human-readable, not mandatory agent reading)
- Trimmed Testing Protocol example block (−8 lines) and Guardrails section (−8 lines)
- Added new "Package Structure Conventions" section: co-located tests, PascalCase class files, camelCase utility files, domain-scoped types.ts, integration tests at package root

### Task 2: Open Questions Audit
Resolved items struck through with inline notes across 5 files:
- **iOS audio autoplay**: resolved in SRS Learning Path PRD, FE Toolchain ADR, PRODUCT-BRIEF.md (was already resolved in PWA ADR and CONTEXT.md)
- **Monorepo shared types**: resolved in Monorepo Tooling ADR — each engine owns its types, no `packages/shared-types`
- **Monorepo structure**: resolved in FE Toolchain ADR — points to Monorepo Tooling ADR

### CODEMAP.md
- Added `docs/` directory entry

## ADRs Completed

1. ✅ **SRS engine as separate package** — `20260302T160536Z-engineering-srs-engine-package.md`
2. ✅ **Curation engine as separate package** — `20260303T210000Z-engineering-curation-engine-package.md`
3. **Shared types strategy** — ✅ Resolved inline (each engine owns its types; no shared-types package)
4. **API surface design** — pending (class-based confirmed, exact method signatures pending)
5. ~~**Backend server need**~~ — ✅ Resolved (`20260303T195134Z-engineering-headless-hono-backend.md`)

## Follow-Up Actions (Next Session)

1. ~~Update RULES.md~~ — ✅ Done
2. ~~Audit open questions across ADRs/PRDs~~ — ✅ Done
3. **Delete irrelevant session files**: `sessions/` contains files superseded by ADRs
4. Start next ADR topic (#4 API surface design)

## Context for Next Session

- Curation engine ADR: `product-documentation/architecture/20260303T210000Z-engineering-curation-engine-package.md`
- SRS engine ADR: `product-documentation/architecture/20260302T160536Z-engineering-srs-engine-package.md`
- Hono backend ADR: `product-documentation/architecture/20260303T195134Z-engineering-headless-hono-backend.md`
- Code standards examples: `docs/code-standards-examples.md`
