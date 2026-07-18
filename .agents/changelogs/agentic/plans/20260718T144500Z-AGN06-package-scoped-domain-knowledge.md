# AGN06: Package-Scoped Domain Knowledge — Implementation Plan

**Date**: 20260718T144500Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Tool | Skill | Template | Workflow | Rule
**Status**: **Proposed** (2026-07-18)
**Track**: agentic
**Source ADRs**:
- [Two-Axis Knowledge Architecture](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md) (informs domain taxonomy)

---

## 1. Overview

The two-axis knowledge architecture (AGN05) records domain knowledge at both the time-series archive and per-domain `KNOWLEDGE.md` levels. However, packages have different scopes: `srs-engine` cares about spaced-repetition and algorithms but not test infrastructure; `ui-components` needs accessibility and styling knowledge but not backend routing.

This plan introduces a **configurable object strategy** for declaring which domain knowledge each package owns and excludes. The goal is deterministic filtering — when RAG or knowledge-synthesis tools encounter a package, they know exactly which domain categories to include or skip, and which package-level facts to surface without having to infer from file paths.

The design **minimizes configuration burden** by inferring most exclusions from inclusions (a package not listed under "testing" domain automatically excludes test knowledge) and uses a single source of truth: the workspace topology in `pnpm-workspace.yaml` combined with a lightweight `domains.json` registry.

**Scope of this plan:** the domain knowledge scoping mechanism (what gets indexed, filtered, or suppressed per package) and the configuration strategy to support it. Does NOT cover RAG integration, knowledge-graph retrieval, or changes to existing `KNOWLEDGE.md` format — those are future layers that consume this contract.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| ----------- | -------- | --------- |
| Source of truth for domains | Central `domains.json` registry; never scattered in package.json | Single authority; easier to audit + plan changes |
| Workspace topology source | Read from `pnpm-workspace.yaml` + package.json `"domains"` field | Packages declare their own scope; workspace file is authoritative for existence |
| Domain categories | Free-form (not enumerated); discovered from all declared scopes | Avoid hardcoding; system adapts as new domains emerge |
| Inclusion vs exclusion | Packages declare what they *own* (inclusions); exclusions inferred; optional explicit exclusion override | Positive scope is easier to reason about; fallback to inference scales |
| Per-package config | Light: `domains`, optional `excludeDomains` in package.json | Keep package.json changes minimal |
| Validation | Schema + tooling enforce: every declared domain exists in registry, no cycles in inheritance, no orphaned packages | Catch config errors early |
| Determinism | No LLM judgment in scoping; all routing is script-determined from config | Reproducible + auditable filtering |

## 3. Target Artifacts

```
.agents/
  tools/
    domains-registry.sh         # NEW — load/validate domains.json, inspect per-package
    domains-validate.sh         # NEW — check config consistency (declared → exists, no cycles)
    package-domain-scope.sh      # NEW — given a package, output its inclusion set + exclusion set
  reference/
    domains.json                # NEW — central registry {category: description, related[], stage}
  skills/dev/
    configure-domains/SKILL.md  # NEW — helper to set up package domains initially

{apps,packages}/<unit>/package.json
  # ADD optional fields:
  # "domains": ["spaced-repetition", "algorithm", "data-structures"]
  # "excludeDomains": ["testing", "test-setup"]  (optional override)
```

## 4. Completion Workflow (target state)

```
1. Admin runs configure-domains skill (once per package, or on first use)
   → Interactive prompt for package name + list of domain categories
   → Writes package.json "domains" field
   → Validates against domains.json registry

2. At retrieval time (RAG, knowledge synthesis, doc generation):
   → package-domain-scope.sh <package-name>
   → Returns {inclusions: [...], exclusions: [...], reason: "..."}
   → Caller filters KNOWLEDGE.md / archive queries by inclusion set

3. On config change:
   → domains-validate.sh checks entire workspace
   → Reports inconsistencies: undefined domains, missing packages, cycles
   → (Future CI gate; on-demand for now)
```

## 5. Stories

### AGN06-ST01: Domain Registry Foundation

**Scope**: The static registry everything else depends on.
**Read List**: AGN05 (domain taxonomy from archive); two-axis ADR D1 (workspace as truth)
**Tasks**:

- [ ] Create `.agents/reference/domains.json` with shape: `{ "category": { "description", "related": [], "stage": "current|archived|experimental" } }`
- [ ] Seed with categories discovered in the codebase: `spaced-repetition`, `algorithm`, `data-structures`, `ui`, `accessibility`, `styling`, `testing`, `routing`, `middleware`, `validation`, etc. (read from existing package names + AGN05 archive)
- [ ] Expose a `related` field for categories that subsume or depend on others (e.g., `"accessibility"` is related to `"ui"`)
- [ ] Add a `stage` field to track lifecycle: `current` (active knowledge), `archived` (historical), `experimental` (not yet core)

**Acceptance Criteria**:
- [ ] `domains.json` validates against a JSON Schema at `.agents/reference/domains-schema.json`
- [ ] No circular dependencies in `related`
- [ ] Registry is discoverable in `.agents/reference/` and documented in agentic ADR

### AGN06-ST02: Package Domain Configuration Schema

**Scope**: The lightweight per-package contract.
**Read List**: ST01 registry; package.json conventions
**Tasks**:

- [ ] Amend package.json schema (if using a custom one, or document the convention):
  - `"domains"`: array of category names (strings) — what this package owns
  - `"excludeDomains"`: optional array of category names — explicit exclusions (override inference)
- [ ] Create a `package-schema-snippet.json` documenting the fields for team reference

**Acceptance Criteria**:
- [ ] A package with `"domains": ["spaced-repetition"]` is valid
- [ ] A package with an undefined domain name (e.g., `"typo-domain"`) fails validation (ST03)
- [ ] The fields are optional; a package with neither is valid (defaults to empty scope)

### AGN06-ST03: `domains-registry` & `domains-validate` Tools

**Scope**: Load, inspect, and validate the domain configuration across the workspace.
**Read List**: ST01–02; `pnpm-workspace.yaml`
**Tasks**:

- [ ] Script at `.agents/tools/domains-registry.sh` — reads `domains.json`, validates against schema, outputs JSON for downstream use
- [ ] Script at `.agents/tools/domains-validate.sh` — checks entire workspace:
  - Every declared domain in any package.json exists in `domains.json`
  - No circular dependencies in `related` chains
  - Every workspace package is discoverable (optional: warn on packages with no `domains` field)
  - `excludeDomains` references only declared domains
- [ ] Both scripts return zero on success, nonzero + error message on failure (scriptable)

**Acceptance Criteria**:
- [ ] `domains-registry.sh` outputs a JSON object matching the registry shape
- [ ] `domains-validate.sh` catches a typo in a package's `domains` field and reports it with file + line
- [ ] Running both on a clean setup (ST01 registry + ST02 schema) passes

### AGN06-ST04: `package-domain-scope` Tool

**Scope**: Given a package name, return its full inclusion and exclusion set (for use by RAG/knowledge filters).
**Read List**: ST03 tools; Two-Axis ADR D7 (projection contract)
**Tasks**:

- [ ] Script at `.agents/tools/package-domain-scope.sh <package-name>` — outputs JSON:
  ```json
  {
    "package": "srs-engine",
    "inclusions": ["spaced-repetition", "algorithm", "data-structures"],
    "exclusions": ["testing", "routing", "middleware", "styling"],
    "reason": "explicit domains declared; exclusions inferred from non-declaration"
  }
  ```
- [ ] If package has `"excludeDomains"` override, merge it into exclusions
- [ ] Fallback: if package has no `domains` field, return empty inclusions + all categories in exclusions (safer: assume it owns nothing)

**Acceptance Criteria**:
- [ ] Running on `srs-engine` (with `"domains": ["spaced-repetition", "algorithm"]`) returns those inclusions
- [ ] Running on a package with no `domains` field returns empty inclusions + warns in stderr
- [ ] Output is valid JSON, consumable by retrieval-layer tools

### AGN06-ST05: `configure-domains` Skill

**Scope**: Interactive setup helper for teams to configure a package's domains.
**Read List**: ST01–04 tools; configure-domains example scripts
**Tasks**:

- [ ] Skill at `.agents/skills/dev/configure-domains/SKILL.md` — interactive prompt:
  - Ask for package name (validate it exists in workspace)
  - List all categories from `domains.json`
  - Prompt "which domains does this package own?" (multi-select)
  - Optionally ask "any explicit exclusions?" (multi-select)
  - Write to package.json + run `domains-validate.sh`
  - Confirm success or report errors

**Acceptance Criteria**:
- [ ] Skill can configure a package end-to-end
- [ ] It catches attempts to add an undefined domain and re-prompts
- [ ] After running, the modified package.json is valid

### AGN06-ST06: Integration with Two-Axis Knowledge (Documentation)

**Scope**: Surface the domain-scoping mechanism in the agentic ADRs so future retrieval layers know the contract.
**Read List**: Two-Axis ADR D7 (projection); ST04 output shape
**Tasks**:

- [ ] Amend [Two-Axis ADR](../../../../product-documentation/architecture/20260718T094101Z-agentic-two-axis-knowledge-architecture.md) **D7 (Projection Contract)** to include:
  - Reference to `package-domain-scope.sh` output as the canonical scoping source
  - Example: when a Graph RAG layer indexes `srs-engine/KNOWLEDGE.md`, it filters by that package's inclusion set
  - Note that future tools (retrieval, synthesis, doc-gen) SHOULD use `package-domain-scope.sh` to scope queries

**Acceptance Criteria**:
- [ ] ADR D7 is amended with a paragraph on domain scoping
- [ ] Example retrieval query is documented (pseudo-code)

## 6. Sequencing & Dependencies

```
ST01 ─┬─> ST02 ─┐
      ├─> ST03 ─┼─> ST04 ─> ST05
      └─> ST06  │
              └─(documents contract for future)
```

ST01 (registry) unblocks everything. ST02–03 are independent (schema + tools). ST04 depends on ST03 (uses the registry). ST05 is the interactive helper, depends on all prior. ST06 documents the contract once the mechanism is proven.

## 7. Success Criteria

1. **Deterministic scoping:** Given a package name, `package-domain-scope.sh` returns a consistent, reproducible inclusion/exclusion set.
2. **Low configuration burden:** Setting up domains for a package takes <5 minutes with the `configure-domains` skill; no manual YAML file editing.
3. **Centralized registry:** All domain categories live in one place; adding a new category doesn't touch package files.
4. **Validation enforces invariants:** Typos, circular references, and stray packages are caught by `domains-validate.sh`.
5. **Future-ready contract:** Two-Axis ADR D7 documents how retrieval layers SHOULD use domain scoping; no implementation needed yet.

## 8. Future Work (Out of Scope)

- **RAG integration:** A future Graph RAG layer will call `package-domain-scope.sh` to filter `KNOWLEDGE.md` queries by package scope.
- **CI gates:** `domains-validate.sh` can be wired into CI/pre-commit hooks (not done here; deferred to a follow-up plan).
- **Domain hierarchy:** If categories grow complex, a future enhancement could support inheritance (e.g., `ui/forms` under `ui`); for now, use `related` field.

## 9. Resolved Decisions (at proposal, 2026-07-18)

- **Configuration location:** Packages declare their own scope in `package.json` rather than a separate `.agents/domains.yaml` per package. Rationale: keeps package metadata in one place; tool reads both files in concert.
- **Inference strategy:** Exclusions are inferred from non-declaration (a package not listed under "testing" automatically excludes test knowledge) unless explicitly overridden with `excludeDomains`. Rationale: reduces config verbosity; fallback is safe (assume minimal scope unless declared).
- **Centralized vs distributed registry:** One `domains.json` in `.agents/reference/` is the source of truth, not scattered definitions. Rationale: single authority; audit trail; easier to deprecate or rename categories.
