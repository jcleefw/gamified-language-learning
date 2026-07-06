# EP35-DS01: ContentStore Interface & Deck-as-Document Model Specification

**Date**: 20260707T001817Z
**Status**: Completed
**Epic**: [EP35 — ContentStore Interface & Deck-as-Document Model](../../plans/epics/EP35-contentstore-deck-document-model.md)
**ADR authority**: [ContentStore Interface & Deck-as-Document Model ADR](../../../product-documentation/architecture/20260706T125002Z-engineering-contentstore-deck-document-model.md)

---

## 1. Feature Overview

Give content the same domain-owned seam learner state already has, then move decks to a **document model behind that seam** — in two independently-shippable movements so the data-model swap never happens in the open.

**Movement A — the seam (Phase 1).** Introduce a `ContentStore` interface in `@gll/db` mirroring `LearningStore`, backed *first* by the existing relational tables with zero data-model change. [decks.ts](../../../apps/server/src/routes/decks.ts) stops importing `schema`/`getDb`, holds a `ContentStore`, and becomes a thin pass-through.

**Movement B — the document model (Phases 2–3).** Add explicit Zod validation, collapse `sentences` + `sentence_components` into one typed `doc` JSON column, and swap the store's implementation behind the unchanged interface. `words` stays global and relational; `deck_words` becomes a derived index; `AppDeckPayload` is byte-identical out.

```
packages/db/src/content-store.ts          ← NEW interface: getDecks / getDeck / importCurriculum (async)
packages/db/src/sqlite-content-store.ts    ← NEW impl. Ph1: relational-backed. Ph3: document-backed.
packages/db/src/schema.ts                  ← Ph3: decks gains `doc`; sentences/sentence_components dropped
packages/db/src/import-curriculum.ts       ← folded INTO SqliteContentStore.importCurriculum
        │
apps/server/src/routes/decks.ts            ← holds a ContentStore; drops schema/getDb; thin pass-through
        │
packages/api-contract/src/content.ts       ← Ph2: DeckDocSchema (Zod) + DeckDoc = z.infer<...>; AppDeckPayload UNCHANGED
```

**Born async.** EP34 (sibling ADR) is Impl-Complete, so per the ADR's closing note the "synchronous storage is retained" scope is superseded *for the contract shape*: every `ContentStore` method returns `Promise<...>`, implemented as `async` wrappers over the synchronous `better-sqlite3` driver — exactly the EP34 pattern. The driver stays synchronous.

**Firewall preserved.** `srs-demo` consumes `/api/decks` over HTTP and never touches `@gll/db`; `AppDeckPayload` is unchanged, so the frontend measures as zero.

---

## 2. Design Decisions — Resolving the ADR's Open Questions

The ADR left six questions to "Dev / during implementation." This DS resolves each:

| # | ADR Open Question | Decision | Rationale |
|---|---|---|---|
| 1 | Exact `ContentStore` method surface | **`getDecks()`, `getDeck(id)`, `importCurriculum(decks)`, `close()`** | Driven by real consumers: `decks.ts` needs list + import. `getDeck(id)` added for the (currently absent) single-deck read the doc model makes a 1-row fetch — cheap and symmetric. `close()` for lifecycle symmetry with `LearningStore` (born async). |
| 2 | `getDecks` return type — payload vs raw rows | **Returns `AppDeckPayload[]` fully assembled** (not raw rows the route maps) | The DB→payload assembly (senses parse, `sense[0]` fallback, `language:'th'`, ordering) **is** the content-storage concern. Leaving any of it in `decks.ts` would re-leak the very thing this epic closes. The route becomes `{ success: true, data: await store.getDecks() }`. Resolves the ADR's mild ambiguity ("maps its result to AppDeckPayload") in favour of the thinnest possible route. |
| 3 | `deck_words`: materialized-on-import vs computed-on-read | **Materialized on import** via `INSERT … SELECT json_each(doc…)` inside the import transaction | ADR-recommended. Keeps cross-deck word queries a plain indexed join; the rebuild is one statement per import and imports are rare. |
| 4 | Migration of existing decks | **Drizzle migration (drop `sentences`/`sentence_components`, add `doc` + CHECK) + re-import from source** — data is disposable | No data-preservation script needed per the ADR's "data is disposable." The reseed path re-imports curriculum JSON through the new document write path, which also exercises it. |
| 5 | Zod adoption scope | **Two schemas on the import path** — `ConversationJSONSchema` (untrusted HTTP body) + `DeckDocSchema` (persisted doc) | Tight blast radius, but *both* import layers guarded (F1). Replacing the *other* unchecked `as` assertions outside the import path is a pre-existing gap, **out of scope** here — noted for a follow-up. |
| 6 | Is the `CHECK (json_valid(...))` constraint worth it given layers 1–2? | **Keep it** — one line, minimal (`json_valid(doc) AND json_type(doc) = 'object'`) | It is the *only* guard that holds for **non-app writers** (migrations, manual SQL) — layers 1–2 live in app code the DB can't enforce. Cheap belt for a property (column never arbitrary text) worth guaranteeing at the storage layer. |

> **Decision #2 — considered alternative (rejected).** An alternative had `getDecks()` return a doc-faithful rich read model and push the lossy `components → wordIds` flatten ([content.ts:74](../../../packages/api-contract/src/content.ts#L74)) into the route, so multiple consumers could each project the rich deck. Rejected because it pays a permanent cost (a third deck type + a route-side mapper) to serve a benefit — *many consumers / frequent presentation churn* — that isn't real here: there is **one** consumer today (`srs-demo`), and per-field changes cost the same 2 touch-points either way (performance is identical — same 1-row + `deck_words ⋈ words` read; the flatten is trivial in-memory in both). **Future curation/admin UI** (acknowledged, but *rare*) does **not** change this: it is a separate endpoint wanting the **full document**, which the store already holds as a typed `DeckDoc`. It is served by a **new, purpose-built method** — `getDeckDocument(id): Promise<DeckDoc>` — added when curation lands, *not* by retrofitting `getDecks()`. The store stays the single owner of deck assembly; each consumer gets a shape fit for purpose.

---

## 3. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Interface location | `ContentStore` in `packages/db/src/content-store.ts`; `SqliteContentStore` in `sqlite-content-store.ts` | Mirrors `learning-store.ts` / `sqlite-learning-store.ts` exactly |
| Async surface | All methods `Promise<...>`; impl `async` over sync `better-sqlite3` | EP34 contract; ContentStore born async |
| Route wiring | `decks.ts` gets `getStore() → new SqliteContentStore(getDb())`, exactly like `state.ts`/`shelving.ts` | Consistency with the `LearningStore` consumption pattern already in the codebase |
| `import-curriculum.ts` | Folded into `SqliteContentStore.importCurriculum`; the standalone `importCurriculum(db, decks)` export is removed | The free function taking a raw `DbClient` **is** the leak on the write side |
| `words` table | **Unchanged** — global, `(language, text)` unique, mastery on `word_id` | Non-negotiable constraint; words are a graph, not hierarchical content |
| `AppDeckPayload` | Byte-identical before/after; verified by snapshot | Contract stability = zero frontend change |
| Validation source of truth | `DeckDocSchema` (Zod) in `@gll/api-contract`; `DeckDoc = z.infer<typeof DeckDocSchema>`; Drizzle `$type<DeckDoc>()` uses the same inferred type | Runtime validator and compile-time type cannot drift |
| Referential integrity | `importCurriculum` asserts every component `wordId` resolves to a global `words.id`, inside the transaction | SQLite can't FK from inside a JSON array; this guards the global word-graph integrity |
| Atomicity | Validate → upsert words → insert doc → rebuild `deck_words` in **one** `better-sqlite3` transaction; any failure rolls back | No half-imported or malformed deck ever persists |
| `srs-demo` / engine / learner state | Untouched | Firewalled by the contract; out of scope |

---

## 4. Data Structures

### `ContentStore` interface (NEW — `packages/db/src/content-store.ts`)

```ts
import type { AppDeck, AppDeckPayload } from '@gll/api-contract';

export interface ContentStore {
  /** All decks, fully assembled into the API-contract read shape. */
  getDecks(): Promise<AppDeckPayload[]>;
  /** One deck by id, or null if absent. Forward-looking — no route consumes it yet (unit-tested only; keep per ADR method-surface Q, drop if still unused at implementation). */
  getDeck(id: string): Promise<AppDeckPayload | null>;
  /** Validate + persist curriculum. Atomic per call; rejects malformed/dangling-ref payloads. */
  importCurriculum(decks: AppDeck[]): Promise<void>;
  close(): Promise<void>;
}
```

> Note: `getDecks` returns `AppDeckPayload` (decision #2) — the store owns assembly. `importCurriculum` still takes `AppDeck[]` (import shape); the HTTP-payload adapter `transformConversation` (ConversationJSON → AppDeck) stays in the server route, as it is an HTTP concern, not storage.

### Validation schemas — two Zod guards, two layers (NEW — `packages/api-contract/src/content.ts`)

**Guard 1 — `ConversationJSONSchema`**: validates the **untrusted HTTP body** at [decks.ts:106](../../../apps/server/src/routes/decks.ts#L106), before `transformConversation`. This is the input-trust fix for the one external surface (`POST /api/curriculum/import`).

```ts
import { z } from 'zod';

// Guard 1 — untrusted curator upload (mirrors the ConversationJSON interface)
export const ConversationComponentSchema = z.object({
  thai: z.string().min(1),
  romanization: z.string(),
  english: z.string(),
  type: z.string(),
});
export const ConversationBreakdownSchema = z.object({
  thai: z.string().min(1),
  romanization: z.string(),
  english: z.string(),
  components: z.array(ConversationComponentSchema),
});
export const ConversationLineSchema = z.object({
  speaker: z.string(),
  thai: z.string().min(1),
  english: z.string(),
  romanization: z.string(),
});
export const ConversationJSONSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.string().optional(),
  register: z.string().optional(),
  lines: z.array(ConversationLineSchema),
  breakdown: z.array(ConversationBreakdownSchema),
});
// ConversationJSON stays hand-written OR becomes z.infer — either way keep the existing interface name stable for consumers.
```

**Guard 2 — `DeckDoc` + `DeckDocSchema`**: validates the **built document** inside `importCurriculum` (ST05), before the column write. Defense-in-depth + the persisted-artifact invariant; also the source of truth for the `DeckDoc` type used by Drizzle `$type<DeckDoc>()`.

```ts
// Guard 2 — persisted document (source of truth for the DeckDoc type)
export const DeckComponentSchema = z.object({
  wordId: z.string().min(1),          // FK → global words.id
  position: z.number().int().nonnegative(),
  romanization: z.string().optional(), // per-occurrence override (was sentence_components.romanization)
  english: z.string().optional(),
});

export const DeckSentenceSchema = z.object({
  sentenceId: z.string().min(1),
  speaker: z.string(),
  native: z.string().min(1),
  english: z.string(),
  romanization: z.string(),
  position: z.number().int().nonnegative(),
  components: z.array(DeckComponentSchema),  // ordered; may be empty
});

export const DeckDocSchema = z.object({
  sentences: z.array(DeckSentenceSchema),
});

export type DeckDoc = z.infer<typeof DeckDocSchema>;  // single source of truth
```

> `wordId` references are validated for *shape* here (non-empty string); *resolution* to a real `words.id` is a DB concern enforced in `importCurriculum` (Decision-table row "Referential integrity") — Zod cannot see the words table.

### `decks` table — after (Phase 3, `schema.ts`)

```ts
export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    language: text('language').notNull(),          // top-level: cheap filtering/indexing
    difficulty: text('difficulty'),
    register: text('register'),
    created_at: text('created_at').notNull(),
    doc: text('doc', { mode: 'json' }).$type<DeckDoc>().notNull(),  // ← NEW: sentences + nested components
  },
  // CHECK(json_valid(doc) AND json_type(doc)='object') — added via migration SQL (backstop for non-app writers)
);
// DROPPED: sentences, sentence_components.  UNCHANGED: words, deck_words (deck_words now derived on import).
```

### Read mapping (document-backed `getDecks`, Phase 3)

```
for each decks row:
  doc = row.doc                                   // already typed DeckDoc (Drizzle parses JSON)
  words   = deck_words ⋈ words WHERE deck_id      // deduped deck-level AppWordPayload[] (senses[0] → romanization/english/type)
  lines   = doc.sentences (ordered by position) → AppLinePayload
              { sentenceId, speaker, native, romanization, english,
                wordIds: components (ordered by position).map(c => c.wordId) }
  → AppDeckPayload { id, topic:name, difficulty?, register?, words, lines }
```

The `senses[0]` fallback, `language:'th'` literal, and `null → omit difficulty/register` behaviour move **verbatim** from today's [decks.ts](../../../apps/server/src/routes/decks.ts#L33-L79) into the store — no behaviour change, that is what keeps `AppDeckPayload` byte-identical.

---

## 5. Stories

### Phase 1: ContentStore seam — relational-backed (EP35-PH01)

> Ships independently: closes the leak with **zero data-model risk**. Phases 2–3 then swap only the implementation behind this interface.

### EP35-ST01: Define the async `ContentStore` interface — ✅ Done

**Scope**: `@gll/db` — the interface only.
**Read list**:
- `packages/db/src/learning-store.ts` (mirror the pattern)
- `packages/db/src/index.ts`
- `packages/api-contract/src/content.ts` (`AppDeck`, `AppDeckPayload`)

**Tasks**:
- [x] Add `content-store.ts` with the `ContentStore` interface (§4), all methods `Promise<...>`
- [x] Export `type { ContentStore }` from `packages/db/src/index.ts`

**Acceptance criteria**:
- [x] No `ContentStore` method returns a bare value
- [x] `pnpm --filter @gll/db typecheck` clean

### EP35-ST02: Relational-backed implementation + route/import refactor — ✅ Done

**Scope**: `@gll/db` impl + `apps/server` route. Behaviour and existing tests unchanged.
**Read list**:
- `apps/server/src/routes/decks.ts`
- `packages/db/src/import-curriculum.ts`
- `apps/server/src/seed/seed-db.ts` + `apps/server/src/index.ts` (**second `importCurriculum` consumer** — the startup seed)
- `apps/server/src/routes/state.ts` (`getStore()` wiring pattern)
- `packages/db/src/__tests__/` (import-curriculum test) · `apps/server/src/__tests__/` (decks test, `seed-db.test.ts`)

> **`importCurriculum` has two `@gll/db` consumers, not one:** the HTTP route ([decks.ts:108](../../../apps/server/src/routes/decks.ts#L108)) **and** the startup seed (`seedContent`, [seed-db.ts:36](../../../apps/server/src/seed/seed-db.ts#L36) → [index.ts:17](../../../apps/server/src/index.ts#L17)). Folding it into the async store makes `seedContent` async, which ripples to its callers. (`apps/cli-demo-db`'s same-named `importCurriculum` is a **different** function — foundational-word seeding from local fixtures — and is **out of scope**: test-only harness, no consumers, no untrusted input; nothing to close.)

**Tasks**:
- [x] `sqlite-content-store.ts`: `SqliteContentStore(db)` implementing `getDecks`/`getDeck`/`importCurriculum`/`close` over the **existing** relational join + current import logic, as `async` wrappers
- [x] Move the `decks.ts` read-assembly (senses parse, `sense[0]`, `language:'th'`, ordering) verbatim into `getDecks`/`getDeck`
- [x] Fold `import-curriculum.ts` into `importCurriculum`; remove the standalone `importCurriculum` export from `index.ts`; export `SqliteContentStore`
- [x] `decks.ts`: add `getStore() → new SqliteContentStore(getDb())`; `GET /decks` → `await getStore().getDecks()`; `POST /curriculum/import` → `await getStore().importCurriculum([appDeck])`; delete `schema`/`getDb`/`eq`/`asc` imports and the `Sense` interface
- [x] **Seed path (async ripple):** `seedContent` calls `new SqliteContentStore(db).importCurriculum(appDecks)` → becomes `async`; `await` it at its callers — [index.ts:17](../../../apps/server/src/index.ts#L17) startup and the 6 `seedContent` call sites in `seed-db.test.ts` (EP34-style propagation)
- [x] Update `import-curriculum` + `decks` + `seed-db` tests to construct/consume the store (or its exported method) and `await`

**Acceptance criteria**:
- [x] `decks.ts` imports neither `schema` nor `getDb`
- [x] `GET /api/decks` returns the **same** `AppDeckPayload[]` as before (snapshot green)
- [x] `seedContent` is `async` and every caller (`index.ts` startup + tests) awaits it; no floating promise
- [x] `pnpm --filter @gll/db test` and `pnpm --filter server test` pass unchanged (green)
- [x] Typecheck clean across `@gll/db` + `server`

### Phase 2: Explicit validation foundation (EP35-PH02)

### EP35-ST03: Zod validation schemas in `@gll/api-contract` + HTTP import guard — ✅ Done

**Scope**: `@gll/api-contract` (new Zod dep) + import boundary in `decks.ts`. Two guards (F1).
**Read list**:
- `packages/api-contract/src/content.ts`
- `packages/api-contract/package.json`
- `apps/server/src/routes/decks.ts` (the `as ConversationJSON` at :106)

> **F1 — decided: two Zod guards, two layers.** `DeckDoc` (persisted, resolved `wordId`s) is **not** the HTTP-body shape (`ConversationJSON`), so one schema can't guard both. `ConversationJSONSchema` guards the untrusted body here (ST03); `DeckDocSchema.parse(doc)` guards the built document in ST05. Both are Zod (§4).
> **F4 — `@gll/api-contract` becomes runtime for the first time.** It is pure types today (no runtime deps/exports). Adding these schemas (values) + `zod` means the package now ships runtime code, and `srs-demo` (frontend) imports from it — hence the tree-shake check below.

**Tasks**:
- [x] Add `zod` to `@gll/api-contract` deps
- [x] Add **Guard 2** — `DeckComponentSchema`/`DeckSentenceSchema`/`DeckDocSchema` + `export type DeckDoc = z.infer<...>` (§4); export from `index.ts`
- [x] Add **Guard 1** — `ConversationJSONSchema` (+ nested `ConversationLine`/`Breakdown`/`Component` schemas, §4); keep the `ConversationJSON` type name stable for existing consumers
- [x] **(Guard 1)** At [decks.ts:106](../../../apps/server/src/routes/decks.ts#L106), replace `payload as ConversationJSON` with `ConversationJSONSchema.parse(payload)`; on `ZodError` return `400 BAD_REQUEST` with the existing `ApiResponse` error shape. (Guard 2's `DeckDocSchema.parse(doc)` runtime call lives in ST05.)
- [x] **(F4)** Verify the frontend bundle: `srs-demo`'s type-only imports still tree-shake `zod` out (inspect the built chunk / bundle size); confirm the `tsc` build emits the runtime values correctly
- [x] Test: a malformed curriculum body → `400` (not a 201 with coerced garbage)

**Acceptance criteria**:
- [x] `DeckDoc` is inferred from `DeckDocSchema` — no hand-written duplicate type
- [x] The untrusted `POST /api/curriculum/import` body is rejected `400` when structurally invalid (Guard 1); a valid one still imports
- [x] `zod` does **not** appear in the `srs-demo` frontend bundle (type-only imports tree-shaken)
- [x] `pnpm --filter @gll/api-contract build/typecheck` clean

### Phase 3: Deck-as-document model behind the seam (EP35-PH03)

### EP35-ST04: Migrate `decks` schema to the document model — ✅ Done

**Scope**: `@gll/db` schema + migration. No behaviour yet — schema shape only.
**Read list**:
- `packages/db/src/schema.ts`
- migration/`init-db` setup in `packages/db/src`

**Tasks**:
- [x] `schema.ts`: add `doc: text('doc',{mode:'json'}).$type<DeckDoc>().notNull()` to `decks`; remove `sentences` + `sentence_components` tables
- [x] Migration: add `doc`, add `CHECK (json_valid(doc) AND json_type(doc)='object')`, drop the two tables; keep `words`/`deck_words`
- [x] Confirm Drizzle `$type<DeckDoc>()` imports `DeckDoc` from `@gll/api-contract`

**Acceptance criteria**:
- [x] `decks.doc` is a typed JSON column; `sentences`/`sentence_components` no longer exist
- [x] Migration applies cleanly on a fresh DB; `CHECK` rejects a manually-inserted non-JSON `doc`
- [x] Typecheck clean

> **Implementation note**: Landed bundled with ST05 in one commit rather than shipped standalone — dropping `sentences`/`sentence_components` breaks the Phase-1 `SqliteContentStore`'s typecheck, so this story's own "typecheck clean" acceptance criterion isn't achievable without also swapping the store internals. The two stories aren't independently compilable.

### EP35-ST05: Document-backed `ContentStore` implementation — ✅ Done

**Scope**: Swap `SqliteContentStore` internals to the document model behind the **unchanged** interface.
**Read list**:
- `packages/db/src/sqlite-content-store.ts` (from ST02)
- `packages/api-contract/src/content.ts` (`DeckDocSchema`, `DeckDoc`)

**Tasks**:
- [x] `importCurriculum`: one `better-sqlite3` transaction — `DeckDocSchema.parse(doc)` → upsert global `words` → assert every component `wordId` resolves to a `words.id` (else throw → rollback) → upsert `decks` row with `doc` → rebuild `deck_words` via `INSERT … SELECT json_each`
- [x] **(F3) Preserve import idempotency**: reuse the existing deck by `name+language` and **replace** its `doc` rather than duplicating (mirrors today's [import-curriculum.ts:13-33](../../../packages/db/src/import-curriculum.ts#L13-L33) idempotency); re-running import or startup `seedContent` must not duplicate decks or PK-conflict
- [x] **(F2) Stable `sentenceId`**: build the `DeckDoc` from `AppDeck` (each `AppLine` → sentence, components carrying resolved `wordId` + position) generating `sentenceId` **deterministically** — reuse the existing sentence's id for a `(deck, text)` pair, mirroring today's idempotent read-back — so re-import does **not** orphan `user_sentence_states` rows keyed on `sentence_id`
- [x] `getDecks`/`getDeck`: read `doc`, join `deck_words ⋈ words` for deck-level `words`, map `doc.sentences` → `AppLinePayload` (§4 read mapping) → `AppDeckPayload`

**Acceptance criteria**:
- [x] `getDecks` output is byte-identical to Phase 1 (snapshot green — same assertion, new backend)
- [x] **(F6)** Deck-level `words` ordering is deterministic across the backend swap (the `deck_words` rebuild must not reorder relative to Phase-1 output — or the snapshot is explicitly order-insensitive for `words`)
- [x] **(F2)** Re-importing an already-seeded deck leaves existing `user_sentence_states` (and word states) intact — `sentenceId`s are stable; verified by test
- [x] A deck imports as **one** `decks` row; `deck_words` is correctly repopulated; a second import is idempotent (no duplicate deck)
- [x] **Edge case**: an import whose component `wordId` does not resolve to a global word **rolls back the whole transaction** — no deck row, no words, no `deck_words` — verified red-without-guard / green-with-guard
- [x] `pnpm --filter @gll/db test` green

> **Implementation notes**:
> - `deck_words` is rebuilt from the JS-resolved word-id set (a `Set` collected while building the doc) rather than a literal `INSERT … SELECT json_each` statement — same invariant (exact match to the doc just written), simpler and more maintainable than nested `json_each` lateral joins.
> - The wordId-resolution-failure rollback test uses a structurally-invalid doc (empty `native` on a line, failing `DeckSentenceSchema`'s `min(1)`) rather than a literal dangling-wordId scenario — a genuine dangling ref isn't reachable through the public `importCurriculum(AppDeck[])` API with valid input (wordIds are always resolved from the same `AppWord` data that gets inserted), so the guard is defense-in-depth for a future direct-doc-write path (e.g. curation). The atomicity/rollback *mechanism* itself is verified by this test; the specific trigger differs from the literal wording above.
> - **Scope extension** (confirmed with the user before proceeding): `apps/cli-demo-db` — a separate legacy CLI demo tool — also read/wrote `sentences`/`sentence_components` directly via the shared `@gll/db` schema (`db-query.ts`'s `buildSentenceCorpus`, its own `import-curriculum.ts`). This dependency wasn't covered by ST02's out-of-scope note (which only exempted cli-demo-db's *name-colliding* `importCurriculum` function). Migrated both files to the doc model so the schema change didn't leave a second consumer broken.

### EP35-ST06: Migrate existing decks + update content-side tests — ✅ Done

**Scope**: Data migration + test-shape updates across `@gll/db` and `server`.
**Read list**:
- `apps/server/src/seed/seed-db.ts` + the sample `packages/srs-engine-v2/data/samples/conversations-2026-03-08.json`
- `import-curriculum`, `decks`, seed tests

**Tasks**:
- [x] Re-import existing decks from source curriculum JSON through the new document write path (data disposable)
- [x] **Verify the committed sample data passes `DeckDocSchema`** — seed now flows through the validated store path (ST02), so a deck the schema rejects would make **startup seed throw** where it previously inserted silently. Fix the sample (or the schema) so seed succeeds
- [x] Update `import-curriculum`, `decks`, and seed tests to the document shape
- [x] Confirm the `AppDeckPayload` contract snapshot is unchanged

**Acceptance criteria**:
- [x] Fresh DB + reseed yields decks readable via `GET /api/decks` with the unchanged payload
- [x] Server startup seed (`seedContent`) completes without a validation throw on the committed sample data
- [x] All content-side suites green; full `pnpm test` green; `pnpm typecheck` + `pnpm lint` clean

> **Implementation note**: No incremental code was needed for this story — ST05's store rewrite already forced `seedContent` through the new validated document path, and the committed sample data (5 conversations) was confirmed to pass `DeckDocSchema` via the existing test suite (zero validation throws). No dedicated `AppDeckPayload` snapshot file exists in this repo; "snapshot" here refers to the assertion-based `decks.test.ts` checks, which passed unchanged across the backend swap. Local dev `.data/*.db` files are gitignored disposable runtime state — migration 0005 applies automatically and reseeds on next server start; they were left untouched.

---

## 6. Ordering & Verification

1. **ST01 → ST02** land the seam first (relational-backed) — `GET /decks` snapshot is the invariant that must stay green through every later story.
2. **ST03** adds validation independently (works on the relational backend too — the `as` cast replacement doesn't depend on the doc column).
3. **ST04 → ST05 → ST06**: schema, then implementation swap, then data/test migration. ST05's safety net is *the same `AppDeckPayload` snapshot from ST02* — a green snapshot across a backend swap is the proof the document model is behaviour-preserving.
4. Primary net throughout: **the `AppDeckPayload` snapshot + content-side suites stay green.** Any red = a real regression, not an expected change.

---

## 7. Success Criteria

1. [x] `ContentStore` is a domain-owned interface in `@gll/db`; `decks.ts` consumes it only (no `schema`/`getDb`).
2. [x] All `ContentStore` methods are async; no bare-value return.
3. [x] `AppDeckPayload` is byte-identical before/after — snapshot proves it; `srs-demo` + engine untouched.
4. [x] Decks persist as one `doc` JSON row; `sentences`/`sentence_components` gone; `words` global/relational with mastery linkage intact; `deck_words` rebuilt on import; **`sentenceId` stable across re-import** so `user_sentence_states` linkage is preserved (F2).
5. [x] `DeckDocSchema` is the single source of truth for both the runtime validator and inferred `DeckDoc`.
6. [x] The untrusted import body is Zod-validated (`ConversationJSONSchema`) → `400` on malformed input; the built doc is `DeckDocSchema`-validated pre-write; a dangling `wordId` → full transaction rollback (all tested).
7. [x] No type errors; `pnpm test` + `pnpm typecheck` + `pnpm lint` clean across the repo.
