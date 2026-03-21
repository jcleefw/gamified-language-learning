# EP##-DS##: {Feature Title} Specification

**Date**: {TIMESTAMP} <!-- Call .agents/tools/generate-timestamp.sh to fill this -->
**Status**: Draft
**Epic**: [EP## - {Name}]({path})

---

## 1. Feature Overview

{Technical summary — HOW this will be built}

## 2. Core Requirements

| Requirement | Decision   | Rationale |
| ----------- | ---------- | --------- |
| {Name}      | {Decision} | {Why}     |

## 3. Data Structures

```typescript
{Language-appropriate type definitions}
```

## 4. User Workflows

```
START → {Step 1} → {Decision?} → {Step 2} → END
```

## 5. Stories

<!-- Each story = one independently testable unit.
     Use Phase headings to group stories when the epic has distinct sub-domains (EP##-PH01, EP##-PH02).
     Omit Phase headings for simple epics with a single concern.
     Stories always belong to the Epic directly — Phase is a label only. -->

<!-- ### Phase 1: {Sub-domain name} (EP##-PH01) -->

### EP##-ST01: {Data Layer}

**Scope**: {one layer}
**Read List**: {FILES THE AGENT SHOULD READ — token-saving}
**Tasks**:

- [ ] {Task}
      **Acceptance Criteria**:
- [ ] {Criterion}

<!-- ### Phase 2: {Sub-domain name} (EP##-PH02) -->

### EP##-ST02: {UI Component}

**Scope**: {one component}
**Read List**: {FILES}
**Tasks**:

- [ ] {Task}
      **Acceptance Criteria**:
- [ ] {Criterion}

## 6. Success Criteria

1. {Condition}
2. No type errors
