# Gap Analysis: `wordId` Scheme for Thai Homographs

**Date:** 2026-05-14
**Author:** JC Lee
**Trigger:** ADR OQ7 — `20260514T120000Z-engineering-sentence-corpus-ingestion.md`

---

## Context

**Business driver:** The SRS engine's mastery tracking is keyed on `wordId`. If two distinct learning items share one `wordId`, the scheduler conflates their progress — mastering one meaning grants unearned credit for another. This analysis determines whether the current `th::native_form` scheme is sufficient or whether a discriminator (e.g. `th::native_form::type`) is needed before the corpus grows.

**Scope:** `wordId` identity in `srs-engine-v2`, `mock-words.ts`, `mock-sentence-corpus.ts`, `mock-decks.ts`. Out of scope: ingestion tooling, UI rendering, sense-level granularity beyond POS.

---

## Research Findings

### Thai dictionaries

All major Thai reference sources (RTSD, Wiktionary, LEXiTRON/Longdo) model homographs as **one headword with multiple senses** — not as separate headword entries per grammatical role. Wiktionary splits ที่ into two etymology groups (place/at cluster vs. which/that cluster), but these are sub-sections of one page, not separate entries. RTSD uses numbered senses under one headword. The stable key in every source is the surface form; POS is an annotation on the sense, not a key component.

### Language learning apps

| App | Model | Distinguishing key |
|---|---|---|
| Duolingo Thai | One item per surface form; different roles taught in separate lesson modules | `form` (one card, reintroduced in context) |
| Memrise | One card per `(form, gloss)` pair; same form can appear multiple times with different English | `form + primary gloss` |
| Anki (community Thai decks) | One note per `(form, gloss)` — same form repeated for distinct meanings | `form + gloss` |
| jpdb.io | One item per `(headword, sense_id)` from JMdict — most granular | `headword_id + sense_id` |
| WaniKani (Japanese) | One item per meaning cluster per kanji; different readings covered by vocabulary cards | `meaning cluster` |

**Key finding:** No major app uses `form + POS` as a compound primary key. The closest real-world practice is `form + gloss` (Anki/Memrise) or `headword + sense_index` (jpdb). However, gloss strings are unstable as IDs (vary across conversations), and sense indices require a maintained dictionary registry. The `type` field already present on every word in the source JSON makes `form::type` the most practical discriminator available without new infrastructure.

### Implication for scheduling correctness

A learner who masters ที่ as "place/at" should not get credit for ที่ as "that/which". These are distinct grammatical functions requiring separate exposure and recall. Conflating them under one `wordId` means:
- Mastery counter increments regardless of which meaning was tested
- `seen` count for sentence eligibility is shared — a learner may be served a sentence requiring relative pronoun ที่ before they have seen it in that role
- Wrong-streak behaviour is mixed — a wrong answer on one role penalises mastery of the other

---

## Current State

`wordId = th::หิว` — one record per surface form. The `english` field carries multi-gloss strings where needed (`"already; now"`, `"what; something"`). No POS discriminator in the ID. Mastery state is one counter per surface form. The current mock corpus contains no homographs in Phase 1 content — the collision has not yet materialised.

---

## Desired State

The scheduler tracks mastery independently for each distinct learning item. The `wordId` scheme is stable from the start — no migration required when a homograph is introduced later. A sentence's `wordOrder` references the specific sense of a word being tested, not just its surface form.

---

## Gap Register

| ID | Dimension | Current State | Desired State | Gap | Type | Impact |
|---|---|---|---|---|---|---|
| G-001 | Data — ID stability | `th::ที่` is one record for all roles | One record per meaning cluster | Same `wordId` used for multiple schedulable items | Missing | High — scheduling correctness |
| G-002 | Data — ID scheme | No POS discriminator in ID | POS or sense discriminator in ID when needed | No mechanism to distinguish meanings at the ID level | Missing | High — triggered when any homograph enters corpus |
| G-003 | Data — migration path | No homograph exists in mock data yet | Retrofit must not break existing `wordOrder` refs or learner state | No safe incremental migration once an ID is in use across corpus and learner state | Partial | High — cost is future, but unrecoverable without full migration |
| G-004 | Data — authoring signal | Author has no way to know if a new word is a homograph at authoring time | Authoring must flag or prevent silent collision | Silent collision — `th::ที่` upsert overwrites or merges records with no warning | Missing | Med — tooling concern, deferred |

---

## Prioritized Gaps

| Priority | Gap ID | Rationale |
|---|---|---|
| 1 | G-002 | Cheapest to close now — add `type` suffix to ID scheme before any homograph enters the corpus; zero migration cost at this stage |
| 2 | G-001 | Follows directly from G-002 — once the scheme supports a discriminator, one record per meaning cluster is natural |
| 3 | G-003 | Only closeable proactively — migration cost grows linearly with corpus size and learner state volume |
| 4 | G-004 | Tooling concern — deferred to ingestion library (ADR OQ6) |

---

## Recommendations

1. **Adopt `th::native_form::type` now**, before any homograph enters the corpus. The `type` field already exists on every word in the source JSON. For unambiguous words the suffix is redundant but harmless — `th::หิว::adjective`. For ที่: `th::ที่::noun`, `th::ที่::preposition`, `th::ที่::relative` become distinct schedulable items with independent mastery state.

2. **Update the mock data layer immediately** — `mock-words.ts`, `mock-sentence-corpus.ts`, and `mock-decks.ts` all use `th::หิว` style today. One refactor now costs nothing; the same refactor after learner state exists requires a migration.

3. **Standardise the `type` vocabulary** — define the allowed values (`noun`, `verb`, `particle`, `preposition`, `adjective`, `adverb`, `question`, `interjection`, `pronoun`, `auxiliary verb`) so the suffix is stable across conversations and not free-text. Values must match what the source JSON produces.

---

## Out of Scope

- **G-004 authoring validation** — collision detection at ingest time belongs to the ingestion library, not the engine.
- **Sense-level granularity** (jpdb-style `sense_id`) — `form::type` is sufficient for Phase 1 beginner content. Sub-sense splitting is over-engineering at this stage.
- **Non-Thai languages** — the same scheme applies (`ja::`, `zh::`, etc.) but analysis of their homograph profiles is deferred.

---

## Related

- ADR: `product-documentation/architecture/20260514T120000Z-engineering-sentence-corpus-ingestion.md` — OQ7
- Mock data: `packages/srs-engine-v2/data/mock/mock-words.ts`, `mock-sentence-corpus.ts`, `mock-decks.ts`
