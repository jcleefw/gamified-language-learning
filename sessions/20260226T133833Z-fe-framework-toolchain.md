# Session State — 20260226T133833Z-fe-framework-toolchain

## Context

Project: Gamified language learning app with SRS-based quizzes (ANKI algorithm), audio playback, native script rendering (Chinese, Thai, etc.), and three user roles: admin, curator, learner.

This session continued from `20260227T000000Z-fe-platform-vue-pwa.md`. That session established PWA as the delivery platform. This session resolved the Vue vs React debate and selected the full frontend toolchain.

The session ended at a defined stop point. Design system token setup and monorepo structure are deferred to new contexts with separate ADRs.

---

## Decisions Made (User-Directed)

- **Framework**: Vue 3 with Composition API throughout (User)
- **Reason for Vue**: Personal learning project — wants to learn the full Vue ecosystem; wanted opinionated structure without Next.js complexity (User)
- **No Tailwind**: Hard rejection — "too bloated with classes in my browser DOM" (User, from THOUGHTS.md)
- **No CSS modules**: Avoid writing CSS modules; prefer typed, co-located styling (User, from THOUGHTS.md)
- **No inherited theme defaults**: User explicitly does not want to inherit component library defaults they didn't define — prior Chakra experience was frustration with namespace collisions and unwanted baseline styles (User)
- **Atomic design structure**: atoms → molecules → organisms, per THOUGHTS.md L122–143 (User, pre-existing)
- **Component explorer**: Histoire preferred over Storybook (User, flagged Storybook alternative as desired)
- **Package manager**: pnpm (User)
- **Monorepo structure**: Build monorepo with separate packages for frontend, backend, design-system, etc. (User — flagged for separate ADR)
- **Design system agent compliance**: Getting agentic agents to follow the design system is "very very important" — tokens must be the authoritative source of truth for agents (User, exact words)

## Decisions Made (Agent-Suggested, User-Approved)

- **Meta-framework**: Nuxt — user was willing to "explore and see where the limits are" after agent explained Nuxt as Vue's equivalent to Next.js but generally more contained (Agent-suggested, approved)
- **Component primitives**: Ark UI (Vue) — headless, accessible, built on Zag.js state machines, zero visual defaults. Same team as PandaCSS. (Agent-suggested, approved by proceeding to ADR)
- **Styling system**: PandaCSS — zero-runtime, type-safe, all default presets excluded, tokens user-defined from design files. (Agent-suggested, approved by proceeding to ADR)
- **Agent compliance mechanism**: PandaCSS `styled-system/` generated types + `.claude/rules/design-system.md` as enforcement layer (Agent-suggested, not contested — deferred to design system ADR)

---

## Points Discussed But Not Decided

- **Nuxt limits**: User is willing to explore Nuxt and find its limits. If Nuxt imposes constraints, fall back to plain Vite. Not yet stress-tested.
- **Design file availability**: Agent asked whether Figma/design files exist. User did not answer — deferred to design system ADR.

---

## Open Questions (To Be Discussed)

- **Design system ADR**: Full topic for next context. Covers:
  - Figma → PandaCSS token pipeline (or define-as-you-go)
  - `panda.config.ts` setup from scratch (no presets)
  - Semantic token structure (colours, spacing, typography, z-index, shadows)
  - `.claude/rules/design-system.md` for agent compliance
  - Storybook alternative confirmation (Histoire)
- **Monorepo ADR**: pnpm workspaces, package structure (frontend, backend, design-system), workspace conventions
- **iOS audio autoplay**: Carried forward from PWA ADR — requires early prototype to surface risk
- **PWA install prompt strategy**: When and how to prompt learners to install the PWA
- **Capacitor trigger criteria**: What specific limitations would trigger Capacitor migration

---

## Detailed Discussion Record

### Vue vs React

**User's stated reasons for Vue (from prior session, confirmed this session):**
1. Wants more opinionated build setup, but not Next.js
2. Personal learning project — wants to learn Vue lifecycle (unfamiliar with Vue)
3. Wants to explore Vue's approach to UI frameworks

**Agent clarified "opinionated build setup"**: User meant project structure and conventions — disliked how messy Next.js gets. Both frustrations: file-system routing conventions AND config/project structure sprawl. "Sometimes I think Next.js is trying to do too much."

**On learning intent**: User confirmed "everything in the Vue ecosystem" — Composition API from day one, not a gradual Options API introduction.

**Nuxt resolution**: Agent presented Nuxt as Vue's equivalent of Next.js but generally more contained. User said: "I'm willing to explore Nuxt and see where is the limit." This was accepted as the build approach.

### CSS-in-JS / Styling

**User's THOUGHTS.md L116–143 (exact text, user-selected):**
- NO Tailwind CSS — "too bloated with classes in my browser DOM"
- Prefer something like Radix, Chakra with CSS-in-JS approach — "styling are typed too"
- Avoid writing CSS modules
- Storybook setup but prefer alternative (needs research)
- Atomic design: atoms, molecules, organisms with specific rules per layer

**Agent flagged the Vue CSS-in-JS tension**: Vue doesn't have a mature CSS-in-JS story equivalent to React's Chakra/Radix ecosystem. Presented landscape:
- Reka UI (formerly Radix Vue): unstyled Vue primitives
- Ark UI: headless, Zag.js state machines, same team as PandaCSS
- PandaCSS: zero-runtime, type-safe, framework-agnostic, all presets excludable

**User's Chakra frustration (exact words)**: "one thing i didn't like about chakra was the existing theme setup by the chakra ui which often is not what I want. I find myself because i didn't set it up from scratch, i inherited a lot of unwanted styling, yet no understand how to use or reverse them in place for my preserve style choice especially with some similar name space."

**Agent resolution**: Ark UI ships zero visual CSS — nothing to inherit. PandaCSS with presets excluded means nothing exists until user defines it. Namespace collision problem is structurally eliminated.

**Agentic compliance requirement (exact words)**: "If we go with Ark UI + PandaCSS ensure theme setup is according to design files is important. Getting agentic agents to follow them is very very important."

Agent confirmed: PandaCSS `styled-system/` generated types + `.claude/rules/design-system.md` scoped to component directories is the enforcement mechanism. Deferred to design system ADR.

### Monorepo + Package Structure

**User stated (end of session):** "use pnpm, build monorepo, have specific folder to hold frontend, backend, design-system, etc." Flagged as "note this down to discuss" — separate ADR.

---

## Current State of the Spec/Design

### Platform (from prior ADR — confirmed)
- PWA with `display: standalone`
- Always-online (no offline in v1)
- No app store at this stage
- Capacitor as deferred upgrade path
- Single codebase for all three roles

### Frontend Toolchain (decided this session)
- **Framework**: Vue 3, Composition API
- **Meta-framework**: Nuxt (limits TBD via implementation)
- **Package manager**: pnpm
- **Repo structure**: Monorepo (separate ADR)
- **Component primitives**: Ark UI (Vue) — zero visual defaults, Zag.js state machines
- **Styling system**: PandaCSS — zero-runtime, type-safe, no presets, tokens from design files
- **Component structure**: Atomic design (atoms/molecules/organisms) per THOUGHTS.md L122–143
- **Component explorer**: Histoire (Vue-native)

### Component Rules (from THOUGHTS.md — pre-existing, confirmed)
- **Atoms**: 1 Ark UI component, max 1 useState, MUST have `.story.vue`, pure/controlled
- **Molecules**: 2+ components, <3 useState, MUST have `.story.vue`
- **Organisms**: most complex, `.story.vue` optional
- **Semantic tokens always** — never hardcode colours, shadows, z-index

### ADRs Written
- [product-documentation/architecture/20260227T000000Z-fe-pwa-platform-strategy.md](../product-documentation/architecture/20260227T000000Z-fe-pwa-platform-strategy.md)
- [product-documentation/architecture/20260226T133833Z-fe-framework-toolchain.md](../product-documentation/architecture/20260226T133833Z-fe-framework-toolchain.md)

---

## Next Steps

1. **Design system ADR** (new context, new ADR):
   - Figma/design file availability question first
   - `panda.config.ts` from scratch — token structure (colours, spacing, typography, shadows, z-index)
   - Semantic token naming conventions
   - `.claude/rules/design-system.md` for agent enforcement
   - Histoire setup confirmation
   - Agent design system compliance infrastructure

2. **Monorepo ADR** (new context, new ADR):
   - pnpm workspace setup
   - Package boundaries: `apps/web` (Nuxt), `packages/design-system`, `packages/backend` or similar
   - Shared tooling config (TypeScript, ESLint, etc.)

3. **iOS audio autoplay prototype** — early spike to surface risk for audio recognition question type
