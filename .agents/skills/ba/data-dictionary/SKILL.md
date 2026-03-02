---
name: data-dictionary
description: Define data entities, fields, types, and validation rules for a domain or feature. Use when documenting a data model, aligning on field definitions, or specifying data requirements for a system.
model: haiku
---

Create a data dictionary for: $ARGUMENTS

If no input is provided, stop and ask:
1. "What domain, feature, or system are we documenting?"
2. "Provide any existing schema, field list, or data description to work from — or describe the data from scratch."

---

## Output Structure

For each entity:

### Entity: [EntityName]
**Description**: What does this entity represent? What is its purpose in the system?

| Field | Type | Required | Default | Validation Rules | Description |
|---|---|---|---|---|---|
| `field_name` | string / int / bool / date / enum / UUID / ... | Yes / No | — | Max 255 chars, unique | Human-readable description of what this field stores |

**Relationships**:
- [EntityName] has many [OtherEntity]
- [EntityName] belongs to [OtherEntity]
- [Field] references [OtherEntity].[field]

**Notes**: Any special handling, lifecycle rules, or business logic that affects this entity's data.

---

## Field Type Reference

Use consistent type names:
- `string` — text, specify max length if relevant
- `integer` / `decimal(p,s)` — numeric
- `boolean` — true/false
- `date` / `datetime` / `timestamp` — specify timezone handling
- `enum([value1, value2, ...])` — fixed value set, list all values
- `UUID` — unique identifier
- `json` — unstructured payload (flag these — they resist validation)
- `reference(Entity.field)` — foreign key

---

## Constraints

- Every enum field must list all valid values — "TBD" is not acceptable
- Flag any field with type `json` or `text` (unbounded) with "[Review — resists validation]"
- If a field name is ambiguous (e.g., `status`, `type`, `data`), flag it with "[Name too generic — clarify]"
- Do not invent fields not implied by the input — flag gaps with "[Field needed? — clarify]"
- Stop after drafting and ask: "Are there missing fields, entities, or relationships to add?"
