# ADR: Frontend Framework & Toolchain Selection

**Status:** Accepted

**Date:** 2026-02-26

**Deciders:** Solo founder

---

## Context

The gamified language learning app requires a frontend framework and toolchain decision. A prior ADR ([20260227T000000Z-fe-pwa-platform-strategy.md](20260227T000000Z-fe-pwa-platform-strategy.md)) already established PWA as the delivery platform, `display: standalone` for the immersive learner path, and Capacitor as a deferred upgrade option.

This ADR covers the framework, build system, styling approach, component structure, and component explorer. It does **not** cover the design system token setup, monorepo structure, or package management — those are deferred to separate ADRs.

**Key constraints going in:**

- Personal learning project — user wants to learn the Vue ecosystem deeply (Composition API, lifecycle, reactivity)
- Mobile-first learner path; admin/curator paths are desktop
- No Tailwind CSS — class-polluted DOM is an explicit rejection
- No CSS modules — typed, co-located styling is required
- Avoid inheriting default component themes (Chakra-style baseline the user didn't write)
- Atomic design system (atoms/molecules/organisms) already defined in THOUGHTS.md
- Agentic compliance is a first-class requirement: AI agents must be able to follow the design system reliably

---

## Decision

**Framework:** Vue 3, Composition API throughout.

**Meta-framework / build:** Nuxt — for project structure conventions and opinionated defaults. Nuxt's limits relative to this project's needs are explicitly flagged as an open question to be stress-tested during implementation.

**Component primitives:** Ark UI (Vue) — headless, accessible, built on Zag.js state machines, zero visual defaults.

**Styling system:** PandaCSS — zero-runtime, type-safe, framework-agnostic CSS-in-JS. All built-in presets excluded. Every token defined from design files. No inherited defaults.

**Component structure:** Atomic design (atoms → molecules → organisms), per existing guidelines in THOUGHTS.md.

**Component explorer:** Histoire — Vue-native Storybook alternative (`.story.vue` files). Required at atom and molecule layers per THOUGHTS.md.

**Package manager:** pnpm. Monorepo structure (frontend, backend, design-system packages) deferred to a separate ADR.

---

## Rationale

**Why Vue over React:**
The user explicitly wants to learn the Vue ecosystem. This is a learning project — React was the known quantity and Vue the intentional exploration. Vue + Nuxt provides structure without Next.js's complexity, which was the stated frustration.

**Why Nuxt over plain Vite:**
The user's complaint about Next.js was specifically about project structure sprawl and config complexity — not about the concept of a meta-framework. Nuxt provides comparable conventions (file-system routing, layouts, composables) with a reputation for being more contained. The user explicitly stated willingness to explore Nuxt and find its limits.

**Why Ark UI over Reka UI (formerly Radix Vue):**
Ark UI and PandaCSS are from the same team (Chakra UI / Segun Adebayo). They are designed to work together. Ark UI also provides a stronger underlying interaction model via Zag.js state machines. Reka UI has stronger Vue-first investment but lacks the integrated design system story.

**Why PandaCSS over Vue SFC scoped styles:**
Vue's scoped `<style>` blocks are collocated but not typed. PandaCSS provides compile-time type safety for style utilities, a semantic token system, and zero runtime overhead. Critically: all tokens are user-defined — there are no inherited defaults to fight.

**Why this solves the Chakra inheritance problem:**
Ark UI ships zero visual CSS. PandaCSS with presets excluded means nothing exists until the user defines it. The namespace collision and default-override problems from Chakra are structurally eliminated.

**Why Histoire over Storybook:**
Histoire is Vue-native (built by Akryum, the Vue tooling ecosystem). Story files are `.vue` files — no framework adaptation layer. Lower overhead for a Vue learning project.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| React + Chakra UI v3 / Ark UI | Mature CSS-in-JS story, Chakra is well-known | User wants to learn Vue; same Chakra theme inheritance risk | Learning objective is Vue |
| Vue + Vite (no Nuxt) | Full control, minimal config | No project structure conventions; user wants opinionated defaults | User explicitly wants conventions |
| Nuxt UI v3 | Official Nuxt component library, built on Reka UI | Ships with Tailwind v4 — hard rejection | Tailwind is a hard no |
| Reka UI (formerly Radix Vue) + PandaCSS | Strong Vue-first investment, Radix lineage | Less integrated with PandaCSS; Ark UI + Panda is a more coherent stack | Ark UI + PandaCSS preferred for coherence |
| Chakra UI Vue | Familiar Chakra mental model | Less maintained, inherits default theme user explicitly rejected | Inherited defaults problem |
| Vue SFC scoped styles | Collocated, idiomatic Vue | Not typed; same frustration as CSS modules in practice | Typed styling is a hard requirement |
| Tailwind CSS | Utility-first, widely adopted | DOM pollution with utility classes — explicit rejection | Hard no |
| Storybook | Mature, widely adopted | Framework adaptation layer for Vue; Histoire is Vue-native | Histoire is the right fit |

---

## Consequences

**Positive:**
- Zero inherited defaults — every token and style is intentional
- Type-safe styling enforced at compile time via PandaCSS
- Accessible component primitives via Ark UI + Zag.js state machines
- Deep Vue ecosystem learning: Composition API, Nuxt composables, Vue reactivity system
- Histoire `.story.vue` files are idiomatic — no mental overhead from framework adapters
- PandaCSS `styled-system/` generated types become the machine-readable source of truth for agents

**Negative / Risks:**
- Ark UI's Vue support is secondary to React — potential lag in Vue-specific fixes or features
- PandaCSS + Ark requires more upfront work than a pre-styled component library (no out-of-the-box buttons or inputs)
- Nuxt limits unknown — meta-framework may impose constraints not yet visible; flagged as an open risk
- No design files established yet — token setup is a dependency for the first component

**Neutral:**
- Monorepo setup (pnpm workspaces, frontend/backend/design-system packages) will be established in a separate ADR
- Design system initialization (Figma → tokens → `panda.config.ts`) is a prerequisite before first atom is built

---

## Open Questions

| Question | Owner | Notes |
|---|---|---|
| What are Nuxt's actual limits for this project? | User + implementation | Explore during build — if Nuxt imposes constraints, fall back to Vite |
| Do design files (Figma, etc.) exist, or will tokens be defined during implementation? | User | Affects whether a Figma → PandaCSS codegen step is needed |
| Monorepo structure: how are frontend, backend, and design-system packages organized? | Deferred | Separate ADR |
| Agent design system compliance: `.claude/rules/design-system.md` setup | Deferred | Separate ADR — design system ADR |
| ~~iOS audio autoplay restrictions~~ | ~~Deferred~~ | **Resolved**: Hybrid approach — session-level `AudioContext` unlock + per-question autoplay attempt + visible tap-to-play fallback. See PWA ADR. |

---

## Related ADRs

- [20260227T000000Z-fe-pwa-platform-strategy.md](20260227T000000Z-fe-pwa-platform-strategy.md) — Platform strategy (PWA, standalone mode, Capacitor upgrade path)
- Design system ADR — TBD (next session)
- Monorepo structure ADR — TBD
