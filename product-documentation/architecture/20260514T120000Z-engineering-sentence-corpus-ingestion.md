# ADR: Sentence Corpus Ingestion — JSON to Engine Data Shape

**Status:** Draft

**Date:** 2026-05-14

**Deciders:** JC Lee

---

## Context

The SRS engine (`srs-engine-v2`) is stateless and receives all content as inputs — it has no knowledge of where data comes from. The engine needs three things to run a session with sentence questions:

- `words: QuizItem[]` — the words to learn in this deck
- `pool: QuizItem[]` — global distractor pool
- `sentenceContexts: SentenceContext[]` — eligible sentences for word-block questions

The raw content source is a conversation JSON file (see `packages/srs-engine/data/samples/conversations-2026-03-08.json`). This ADR answers: **what transform is required to get from that JSON to the engine's input shape, and where does the data live along the way?**

---

## The Source: Conversation JSON

Each conversation in the JSON has:

```json
{
  "id": "5577296f-...",
  "topic": "let's eat something",
  "uniqueWords": [
    { "thai": "หิว", "romanization": "hǐw", "english": "hungry", "type": "adjective" },
    ...
  ],
  "breakdown": [
    {
      "thai": "หิวแล้ว ไปกินอะไรกัน?",
      "english": "I'm hungry, let's go eat something?",
      "romanization": "hǐw lɛ́ɛo bpai gin a-rai gan?",
      "components": [
        { "thai": "หิว", "romanization": "hǐw", "english": "hungry", "type": "adjective" },
        ...
      ]
    }
  ]
}
```

- `uniqueWords` → the word pool for this conversation (deduplicated)
- `breakdown` → one entry per sentence, each with its words in position order via `components`
- `lines` → raw dialogue; not used for SRS content

---

## Decision

### D1 — Word ID scheme

`wordId` = language prefix + native form: `th::หิว`

This is stable, human-readable, and already in use across `mock-word-pool.ts`, `mock-sentence-corpus.ts`, and `mock-decks.ts`. Words are globally unique by `wordId` — the same word appearing in multiple conversations maps to the same ID.

### D2 — Words are global; sentences belong to a conversation

| Concern | Scope | Reason |
|---|---|---|
| Words (`QuizItem`) | Global | Mastery is global — `th::กิน` is the same word regardless of which deck introduced it |
| Sentences (`SentenceContext`) | Per conversation | A sentence is authored in the context of a specific conversation; it has no meaning outside it |

A conversation (deck) owns its sentences. It does not own its words.

### D3 — One `breakdown` entry → one `SentenceContext`

Each entry in `breakdown` produces exactly one `SentenceContext`:

```
breakdown[i].english          → SentenceContext.englishSentence
breakdown[i].components       → SentenceContext.wordOrder (wordId refs, in position order)
sentenceId                    → conversationId + position index (e.g. 'sent::5577296f::0')
```

`wordOrder` is derived by mapping each component to its `wordId`:
```
wordOrder = components.map(c => `th::${c.thai}`)
```

`englishSentence` is taken directly from `breakdown[i].english` — it is not reconstructed from components, because English sentence structure can differ from the native word order.

### D4 — Ingestion is a transform, not a storage decision

The ingestion step converts the conversation JSON into the engine's input shape. Whether the result is held in memory, written to flat files, or stored in a database is a separate concern. The transform itself is:

```
Conversation JSON
  └── uniqueWords   → QuizItem[]          (global words store)
  └── breakdown[]   → SentenceContext[]   (per-conversation sentences store)
  └── id + topic    → Conversation record (deck registry)
```

The engine always receives already-resolved inputs — it never sees the raw JSON.

### D5 — Mock data layer mirrors DB table responsibilities

Before a real database exists, the mock data layer is structured to mirror the same schema boundaries:

| Mock file | DB equivalent | Contents |
|---|---|---|
| `mock-words.ts` | `words` table | Global `QuizItem[]` — one entry per `wordId` |
| `mock-decks.ts` | `conversations` table | Deck metadata + `wordIds[]` (join, not inline words) |
| `mock-sentence-corpus.ts` | `sentences` table | `SentenceContext[]` with `conversationId` added |
| `mock-db.ts` (new) | Query layer | Join functions that assemble engine inputs from the above |

`mock-db.ts` exposes:
```ts
getWordsForDeck(conversationId): QuizItem[]
getWordPool(language): QuizItem[]
getSentenceContexts(conversationId, runState): SentenceContext[]
```

These are the same queries a real DB layer would execute. Swapping to a real DB = replacing `mock-db.ts` implementations only. The engine signature and caller contract are unchanged.

`resolveEligibleContexts` in `learning-io.ts` (currently inline in the demo runner) moves into `mock-db.ts` — it belongs to the query layer, not the runner.

---

## Alternatives Considered

| Option | Why Not Chosen |
|---|---|
| Store sentences globally (not per conversation) | Sentences are meaningless without their conversation context; cross-deck sentences create authoring and eligibility ambiguity |
| Reconstruct `englishSentence` from components at runtime | English word order differs from native word order — safe reconstruction would require a separate English word order field or NLP; authored string is simpler and correct |
| Keep `mock-decks.ts` as-is (words inline per line) | Words duplicated across lines; no stable global word reference; schema responsibilities are hidden |
| Derive `wordId` from a hash or sequential ID | `th::หิว` is stable, readable, and already in use — no benefit to an opaque ID at this stage |

---

## Consequences

**Positive:**
- Engine inputs are fully derivable from the conversation JSON — no hand-authored corpus files needed
- The same word appearing in multiple conversations always produces the same `wordId` — `กิน` in the "eat" deck and `กิน` in the "weather" deck both become `th::กิน`. The global words store gets one row, not two, because the ID scheme makes duplicates structurally impossible rather than relying on manual checks
- Mock layer and future DB layer share the same interface — migration is a drop-in replacement

**Negative / Risks:**
- `wordId` = `th::` + native form assumes the native form is unique per language. Homographs (same script, different meaning) would collide. This is acceptable for Phase 1 Thai content; a disambiguation suffix can be added if needed.
- `mock-db.ts` is a new file that must be kept in sync with `mock-words.ts`, `mock-decks.ts`, and `mock-sentence-corpus.ts` manually until a DB exists.

**Neutral:**
- `mock-decks.ts` shape changes: words are removed from `MockLine`; the line carries only `native`, `english`, `romanization` for display. `wordIds` on the deck record is the authoritative word list.
- `mock-sentence-corpus.ts` gains a `conversationId` field per entry.

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ1 | What is the raw authored form — one record per sentence, one per word, or structured text? | Architect | **Resolved** — conversation JSON is the authored form; `breakdown` entries are sentences, `uniqueWords` are words. No separate authoring step. See D1–D3. |
| OQ2 | Does one sentence produce one `SentenceContext` or multiple (one per testable word)? | Architect | **Resolved** — one `breakdown` entry → one `SentenceContext`. Not one per word. See D3. |
| OQ3 | Where does the raw→engine transform happen — build-time, runtime, or manual? | Architect | **Resolved** — transform is manual for Phase 1 (mock files maintained by hand). Build-time script is deferred to production. See D4 and OQ6. |
| OQ4 | Does the ingestion design change any fields on `SentenceContext`? | Architect | **Resolved** — `SentenceContext` gains `conversationId` to anchor it to its deck. `wordOrder` and `englishSentence` are derived from `breakdown` as specified in D3. No other field changes. |
| OQ5 | Should `mock-db.ts` live in `data/mock/` (alongside mock data) or `demo/` (alongside the runner)? | Architect | **Resolved** — `data/mock/`. The engine has no knowledge of the storage layer; the query layer is a data concern, not a runner concern. `demo/` calls `mock-db.ts`, same as it would call a real DB client. |
| OQ6 | Does the ingestion transform need to be a runnable script (JSON → mock files), or is manual maintenance of mock files acceptable for Phase 1? | Dev | **Deferred** — ingestion tooling is out of scope for `srs-engine-v2`. Likely a separate package or library. Manual mock maintenance is acceptable until that package exists. |
| OQ7 | `wordId` collision for homographs — is `th::` + native form sufficient for all Phase 1 Thai content? | Content | **Open — two options under consideration:** **A** — accept collision: `th::ที่` = one record, one mastery counter; works for beginner content where only one meaning is introduced at a time. **B** — type suffix: `th::ที่::noun`, `th::ที่::preposition` — separate mastery per grammatical role using the `type` field already present in the JSON; more accommodating with less variation than gloss-based disambiguation. B is preferred if the engine should treat different meanings as separate learning items. **Research required**: how do real-world dictionaries (e.g. Thai Royal Institute Dictionary, Wiktionary, Longdo) model homographs — as one entry with multiple senses, or as separate headword entries per grammatical role? That convention should inform whether Option A or B is the more natural fit. Decision deferred pending research and content review. |

---

## Related

- ADR: `20260512T235900Z-engineering-compose-sentence-batch-boundary.md` — `SentenceContext` shape
- Reference: `reference/data-pipeline-boundary.md` — engine boundary and query layer contract
- Sample: `packages/srs-engine/data/samples/conversations-2026-03-08.json` — source JSON shape
- Mock: `packages/srs-engine-v2/data/mock/mock-sentence-corpus.ts` — current sentence fixtures
