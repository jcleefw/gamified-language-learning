# EP35 - ContentStore Interface & Deck-as-Document Model

**Created**: 20260707T001258Z
**Status**: Completed

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP30 (persistent storage — `@gll/db`, schema, `words` graph, `import-curriculum`), EP34 (async storage contract — `ContentStore` is born async under it)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

A storage-boundary audit ([ContentStore ADR](../../../product-documentation/architecture/20260706T125002Z-engineering-contentstore-deck-document-model.md)) surfaced an asymmetry. Learner state is accessed through the domain-owned `LearningStore` interface, but **content has no equivalent seam**: [decks.ts](../../../apps/server/src/routes/decks.ts#L15) imports `schema`/`getDb` and assembles `AppDeckPayload` from a raw 4-table Drizzle join, and [import-curriculum.ts](../../../packages/db/src/import-curriculum.ts#L9) takes a `DbClient` directly and fans one deck across 5 tables. One storage domain sits behind an interface; the other is wide open.

Separately, the relational content schema (`decks` + `sentences` + `sentence_components` + `deck_words`) is **rigid for multilingual content**, where per-language fields vary. A runnable SQLite demo confirmed a document model works on the current engine via JSON columns — no NoSQL engine, and the global word graph is preserved.

This epic closes the content leak with a domain-owned `ContentStore`, then moves decks to a document model *behind that seam* — so the data-model swap has an interface to hide behind and the frontend measures as zero change.

## Scope

**In scope**:

- A domain-owned `ContentStore` interface in `@gll/db` (`getDecks`, `getDeck`, `importCurriculum`), **async** per the EP34 contract.
- Refactor [decks.ts](../../../apps/server/src/routes/decks.ts) to hold a `ContentStore` and map results to `AppDeckPayload`; it stops importing `schema`/`getDb`.
- A `DeckDocSchema` (Zod) defined once in `@gll/api-contract`, with `DeckDoc` inferred via `z.infer`; replaces the unchecked `as ConversationJSON` assertion at import ([decks.ts:106](../../../apps/server/src/routes/decks.ts#L106)) with a `parse` → 400.
- Collapse `sentences` + `sentence_components` into a typed `doc` JSON column (Drizzle `$type<DeckDoc>()`) + `CHECK (json_valid(doc))` backstop.
- Document-backed `ContentStore`: transactional import (validate → upsert words → insert doc → rebuild `deck_words` derived index), with a referential-integrity assertion that every component `wordId` resolves to a global `words.id`.
- Migrate existing deck rows (re-import from source) and update content-side tests.

**Out of scope**:

- **`words` table changes** — words stay global, relational, deduped; mastery linkage on `word_id` is untouched.
- **`AppDeckPayload` contract changes** — same shape out; exposing richer document fields (component annotations) is a future additive, opt-in change.
- **`srs-demo` / frontend changes** — firewalled by the API contract; not modified.
- **Async driver / hosting swap** — EP34 established the async shape; no real async driver here.
- **Learner state, SRS scheduling, shelving** — unaffected.

---

## Stories

### Phase 1: ContentStore seam — relational-backed (EP35-PH01)

> Delivered as a standalone step: closes the leak with **zero data-model risk** (per the ADR's Alternatives table). The document model in Phase 3 then swaps only the implementation behind this seam.

### EP35-ST01: Define the async `ContentStore` interface — ✅ Done

**Scope**: Add `ContentStore` interface to `@gll/db` — `getDecks(): Promise<AppDeck[]>`, `getDeck(id): Promise<AppDeck | null>`, `importCurriculum(decks): Promise<void>` — mirroring the `LearningStore` seam and async-by-EP34-contract.

### EP35-ST02: Relational-backed implementation + route/import refactor — ✅ Done

**Scope**: Implement `ContentStore` over the existing 4-table join and current `importCurriculum` logic; [decks.ts](../../../apps/server/src/routes/decks.ts) holds the store and maps to `AppDeckPayload`, dropping direct `schema`/`getDb` imports. Behaviour and existing tests unchanged.

### Phase 2: Explicit validation foundation (EP35-PH02)

### EP35-ST03: `DeckDocSchema` (Zod) in `@gll/api-contract` + import guard — ✅ Done

**Scope**: Add Zod to `@gll/api-contract`; define `DeckDocSchema` once with `DeckDoc = z.infer<...>`; replace the unchecked `as ConversationJSON` at the import boundary with `DeckDocSchema.parse`, rejecting malformed payloads with 400.

### Phase 3: Deck-as-document model behind the seam (EP35-PH03)

### EP35-ST04: Migrate `decks` schema to the document model — ✅ Done

**Scope**: Add `doc TEXT NOT NULL` (Drizzle `text('doc', { mode: 'json' }).$type<DeckDoc>()`) with `CHECK (json_valid(doc) AND json_type(doc) = 'object')`; keep top-level `language`; drop `sentences`/`sentence_components`; `words` unchanged.

> Landed bundled with ST05 in one commit — dropping `sentences`/`sentence_components` breaks the Phase-1 store's typecheck, so the two stories aren't independently compilable/shippable in isolation.

### EP35-ST05: Document-backed `ContentStore` implementation — ✅ Done

**Scope**: Rewrite the store behind the same interface — `importCurriculum` runs one `better-sqlite3` transaction (validate → upsert words → insert doc → rebuild `deck_words` via `INSERT … SELECT json_each`) with an explicit `wordId → words.id` referential-integrity assertion; `getDecks`/`getDeck` read from `doc` and still emit `AppDeckPayload`.

> **Scope extension**: `apps/cli-demo-db` (a separate legacy CLI demo tool) also read/wrote `sentences`/`sentence_components` directly via the shared `@gll/db` schema — a dependency the epic's original "out of scope" note didn't cover (that note only exempted cli-demo-db's *name-colliding* `importCurriculum` function, not this table dependency). Migrated its `import-curriculum.ts` and `db-query.ts` (`buildSentenceCorpus`) to the doc model too, confirmed with the user before proceeding, so the schema change didn't leave a second consumer broken.
> `deck_words` is rebuilt from the JS-resolved word-id set rather than a literal `INSERT … SELECT json_each` statement — same invariant (exact match to the doc just written), simpler than nested `json_each` lateral joins.

### EP35-ST06: Migrate existing decks + update content-side tests — ✅ Done

**Scope**: Re-import existing decks from source into the document shape (data is disposable); update `import-curriculum`, `decks`, and seed tests to the new shape. Contract snapshot for `AppDeckPayload` stays green.

> No incremental code needed — ST05's store rewrite already forced `seedContent` through the new validated document path, and the committed sample data (5 conversations) was confirmed to pass `DeckDocSchema` via the existing test suite (no validation throws). Local dev `.data/*.db` files are gitignored disposable runtime state; migration 0005 applies automatically and reseeds on next server start.

---

## Overall Acceptance Criteria

- [x] `ContentStore` is a domain-owned interface in `@gll/db`; `decks.ts` no longer imports `schema`/`getDb` and consumes the interface only.
- [x] All `ContentStore` methods are async (EP34 contract); no method returns a bare value.
- [x] `AppDeckPayload` shape is byte-identical before and after — verified by contract/snapshot test; `srs-demo` and the engine are untouched.
- [x] Decks persist as a single `doc` JSON row; `sentences`/`sentence_components` tables are gone; `words` stays global/relational with mastery linkage intact.
- [x] `deck_words` is rebuilt from `doc` on every import and cross-deck word queries still work.
- [x] `DeckDocSchema` is the single source of truth for both the runtime validator and the inferred `DeckDoc` type (no drift with Drizzle `$type`).
- [x] **Edge/error case**: a malformed deck payload is rejected with 400 by `DeckDocSchema.parse` (not silently coerced); and an import whose component `wordId` doesn't resolve to a global word **rolls back the whole transaction** — no half-imported deck persists. Both verified by test.

---

## Dependencies

- EP30 — `@gll/db`, content schema, global `words` graph, existing `import-curriculum`.
- EP34 — async storage contract; `ContentStore` inherits the async shape (its ADR "sync retained" note is superseded for the *contract shape*).
- Zod — net-new runtime-validation dependency in `@gll/api-contract`.

## Next Steps

1. ~~Review and approve plan~~ ✅
2. ~~Create Design Spec (DS) — resolve the ADR's open questions (exact method surface, `deck_words` materialize-vs-compute, migration approach, Zod adoption scope, whether the `CHECK` constraint earns its keep)~~ ✅ See [EP35-DS01](../../changelogs/EP35--contentstore-deck-document-model/20260707T001817Z-EP35-DS01-contentstore-deck-document-model.md).
3. ~~Begin implementation~~ ✅ All stories (ST01–ST06) implemented and verified — full-repo `typecheck`/`lint`/`test` green.
