# ADR: ContentStore Interface & Deck-as-Document Model

**Status:** Proposed

**Date:** 2026-07-06

**Deciders:** Solo founder

> **Shared principle (common to this ADR and its sibling, [async storage contract]):**
> Storage interfaces should be **domain-owned and driver-agnostic**, mirroring the discipline already applied to the engine boundary — where a persistence detail leaking into `@gll/srs-engine-v2` was explicitly rejected (see [srs-engine-v2 library boundary](../../.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md)). Learner state already earns this via `LearningStore`; content does not. This ADR closes that gap for content. A sibling ADR addresses the synchronous-driver coupling in `LearningStore`.

---

## Context

A storage-boundary audit surfaced an asymmetry. Learner state is accessed through the domain-owned `LearningStore` interface ([learning-store.ts](../../packages/db/src/learning-store.ts)) — `state.ts` and `shelving.ts` never touch SQLite directly. **Content has no equivalent seam:**

- [`decks.ts`](../../apps/server/src/routes/decks.ts#L16) queries `schema` with raw Drizzle inline and assembles the response from a 4-table join.
- [`import-curriculum.ts`](../../packages/db/src/import-curriculum.ts) takes a Drizzle `DbClient` directly and fans a single deck out across 5 tables.

There is no `ContentStore`. So one storage domain is behind an interface and the other is wide open — the abstraction was applied unevenly.

Separately, the relational content schema (`decks` + `sentences` + `sentence_components` + `deck_words`) **feels rigid** for multilingual content, where per-language fields vary. This is the stated motivation to explore a document model. A runnable SQLite demo confirmed the document model works on the current engine (SQLite 3.43) using JSON columns — **no NoSQL engine required**, and the global word graph is preserved.

**Non-negotiable constraints:**

- **Words are global, deduped graph nodes.** `(language, text)` is unique; a word is shared across decks; **learner mastery hangs off `word_id`** (see [schema design decisions](../../.agents/memory/EP30--persistent-storage/schema-design-decisions.md)). Words must stay relational — they are not hierarchical content.
- **`srs-demo` is firewalled by the API contract.** It fetches `/api/decks` and consumes `AppDeckPayload` ([content.ts:77](../../packages/api-contract/src/content.ts#L77)); it does not depend on `@gll/db`. The contract must stay stable so the frontend is untouched.
- **Synchronous storage is retained.** `better-sqlite3` stays; async is the sibling ADR's concern and is out of scope here.

---

## Decision

### 1. Introduce a `ContentStore` interface (domain-owned)

Define a `ContentStore` interface in `@gll/db` covering content reads and curriculum import (e.g. `getDecks()`, `getDeck(id)`, `importCurriculum(decks)`). Move the content logic out of `decks.ts` and the free-standing `import-curriculum` function so both consume the interface. `decks.ts` stops importing `schema`/`getDb`; it holds a `ContentStore` and maps its result to `AppDeckPayload`.

This gives content the same seam learner state already has, closing the leak.

### 2. Model decks as documents behind that interface

Behind `ContentStore`, collapse three tables into one document per deck:

```sql
CREATE TABLE decks (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  language TEXT NOT NULL,          -- top-level column: cheap filtering/indexing
  doc      TEXT NOT NULL           -- JSON: sentences + nested components (JSONB on SQLite >= 3.45)
);
```

- `sentences` and `sentence_components` are **absorbed into `doc`** as a nested structure; each component holds a `wordId` reference.
- **`words` stays global and relational — unchanged.** Component `wordId`s join to it, so the shared word graph and mastery linkage are preserved.
- `deck_words` becomes a **derived index**, rebuilt from `doc` on import (one `INSERT ... SELECT json_each`), keeping cross-deck word queries cheap.
- In Drizzle, `doc` is a typed column: `text('doc', { mode: 'json' }).$type<DeckDoc>()` — document flexibility *with* compile-time type safety.

### 3. Keep the `AppDeckPayload` API contract stable

`decks.ts` produces the same `AppDeckPayload[]` shape from the document instead of from joins. `srs-demo` is not modified. Any future exposure of richer document fields (component-level annotations currently flattened to `wordIds: string[]`) is an **additive, opt-in** contract change, out of scope here.

### 4. Guard the document with an explicit validation strategy

The relational schema today provides *implicit* validation for free — `NOT NULL`, typed columns, unique constraints reject some malformed data at insert. A `doc` blob loses that, and there is currently **no runtime validation at all** (import does `payload as ConversationJSON` — a compile-time assertion that checks nothing, [decks.ts:106](../../apps/server/src/routes/decks.ts#L106)). The document model therefore requires validation to be added back *explicitly*. Done properly this is **stronger** than the relational baseline, because a schema validator expresses invariants columns cannot (non-empty arrays, integer/range checks, cross-field rules).

Defense in depth, outermost first:

1. **Schema validation at import (primary guard).** A `DeckDocSchema` (Zod) defined **once in `@gll/api-contract`**, with `DeckDoc` inferred from it (`z.infer`) so the runtime validator and the Drizzle `$type<DeckDoc>()` type cannot drift. Import calls `DeckDocSchema.parse(doc)` and rejects the whole payload (400) on failure — replacing the unchecked `as` assertion.
2. **Referential integrity (what schema validation can't catch).** SQLite cannot FK from inside a JSON array, so `importCurriculum` explicitly asserts every component `wordId` resolves to a global `words.id`, inside the transaction. This is the guard that protects the **global word-graph integrity** the [schema decisions](../../.agents/memory/EP30--persistent-storage/schema-design-decisions.md) depend on.
3. **SQLite `CHECK` constraint (backstop for non-app writers).** `CHECK (json_valid(doc) AND json_type(doc) = 'object')` guarantees the column is never corrupt/arbitrary text regardless of who writes it (migrations, manual SQL). Deliberately minimal — full-structure validation stays at layer 1.
4. **Atomic transaction.** Validate → upsert words → insert doc → rebuild `deck_words` in one `better-sqlite3` transaction; any failure rolls back, so a half-imported or malformed deck is never persisted.

Layers 1–2 are what earn the "which we control" claim. Generated columns for individual queried fields (typed + indexed + constrained) remain an optional per-field escalation.

---

## Rationale

- **Symmetry with the engine boundary** — Content deserves the same domain-owned seam that protects learner state and the engine. Interfaces are cheapest to introduce *before* a data-model change, not after.
- **The document model targets the actual pain** — Rigidity is a *content-shape* problem. A document lets per-language/per-deck fields be keys, not migrations; a deck reads in one row instead of a 4-table join; import is one write instead of a 5-table fan-out.
- **SQLite, not NoSQL** — The runnable demo proved JSON columns deliver the document model on the existing engine, synchronously, while keeping SQL joins to the global word graph. A document *database* (Firestore/Mongo) would break the global word identity, force an async rewrite, and contradict the accepted [infra ADR](20260301T161844Z-infra-cloudflare-platform.md). We want the document *model*, not the document *database*.
- **The interface makes the model swappable** — With `ContentStore` in place, relational-vs-document lives behind one seam; the blast radius is `decks.ts` + import + tests, and the frontend measures as zero.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
| --- | --- | --- | --- |
| **Status quo — raw Drizzle in `decks.ts`** | No work | Leak persists; document swap has no seam to hide behind | Leaves the boundary asymmetry this ADR exists to fix |
| **`ContentStore` interface, keep relational tables** | Closes the leak with zero data-model risk | Rigidity pain remains | Viable as a first step; deferred only if the document model needs more validation — the interface is the same either way |
| **Document model without a `ContentStore` interface** | Gets flexibility fast | Content stays interface-less; misses the cheap moment to close the leak | Wastes the one refactor that touches these files anyway |
| **Document *database* (Firestore / MongoDB)** | "True" NoSQL | Breaks global word graph; async rewrite; contradicts infra ADR; two-engine local/cloud mismatch | Cost far exceeds the content-shape benefit |

---

## Consequences

**Positive:**

- Closes the content leak — storage access is now uniformly behind domain-owned interfaces.
- Per-language/per-deck content fields without migrations; one-read deck; one-write import.
- Global word graph and mastery linkage preserved (words stay relational).
- Typed documents via Drizzle `$type<DeckDoc>()` — flexibility with type safety.
- Validation ends up **stronger** than the relational baseline: a single Zod `DeckDocSchema` (source of truth for both the runtime check and the inferred type) expresses invariants columns cannot, and closes the pre-existing "unchecked `as` assertion" gap on the import path.
- `srs-demo`, the engine, and all learner-state tables are untouched.

**Negative / Risks:**

- The `doc` column is not self-validating at the DB layer — mitigated by the 4-layer validation strategy above (Decision §4). This replaces implicit column-level validation with explicit schema validation; the risk is real only if that strategy is *not* built.
- New dependency: **Zod** in `@gll/api-contract`. The codebase currently has no runtime validator, so this is a net-new tool (though it addresses a pre-existing gap — the unchecked `as` assertions across import and seed paths).
- Cross-deck word queries depend on the derived `deck_words` index staying in sync — it must be rebuilt on every import.
- Any deck field that needs querying/filtering requires an expression index (`json_extract(doc, '$.field')`) rather than coming free with a column.
- Existing deck rows must be migrated — re-import from source (data is disposable) or a one-off migration script.
- Content-side tests (`import-curriculum`, `decks`, seed) need updating to the new shape.

**Neutral:**

- Storage stays synchronous — async is deferred to the sibling ADR.
- `AppDeckPayload` unchanged; learner state, SRS scheduling, and shelving unaffected.

---

## Open Questions

| Question | Owner | Target |
| --- | --- | --- |
| Exact `ContentStore` method surface (`getDecks`, `getDeck`, `importCurriculum`, others?) | Dev | Before implementation |
| `deck_words`: materialized-on-import (recommended) vs computed-on-read | Dev | During implementation |
| Migration of existing decks: re-import vs one-off script | Dev | Before merge |
| Does `AppDeckPayload` want extending to expose richer document fields (component annotations)? Additive if so. | Product | Deferred — not required by this ADR |
| Zod adoption scope: only `DeckDocSchema`, or also replace the existing unchecked `as` assertions on the seed/conversation paths? | Dev | During implementation |
| Is the `CHECK (json_valid(...))` constraint worth it given layers 1–2, or over-belt-and-braces? | Dev | During implementation |

---

_Related:_

- Sibling ADR — [async storage contract](20260706T125834Z-engineering-async-storage-contract.md) (`LearningStore` sync-driver coupling). **Note:** if that ADR is accepted, `ContentStore` is born async and this ADR's "synchronous storage is retained" scope note is superseded for the *contract shape* (the data model and driver stay as decided here)
- [20260301T161844Z-infra-cloudflare-platform.md](20260301T161844Z-infra-cloudflare-platform.md) — the document *model* stays compatible; a document *database* would supersede it
- [schema design decisions](../../.agents/memory/EP30--persistent-storage/schema-design-decisions.md) · [srs-engine-v2 library boundary](../../.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md)
