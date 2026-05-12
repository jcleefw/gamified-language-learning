# EP24-DS02: App-Local Deck Data Specification

**Date**: 20260511T231222Z
**Status**: Draft
**Epic**: [EP24 - Vue SRS Demo App](../../plans/epics/EP24-vue-srs-demo.md)

---

## 1. Feature Overview

Remove the app's dependency on `@gll/srs-engine-v2` mock data (`mock-decks`, `mock-words`, `mock-word-pool`). Instead the app owns its deck data locally in `src/data/`. The `eatLines` / `weatherLines` content from the engine's mock-decks file are the source of truth for the new local data.

A transformer function converts the line-based `AppDeck` format into the flat `QuizItem[]` and word pool arrays the engine expects.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Data location | `apps/srs-demo/src/data/` | App owns its data, not the engine package |
| Word type | Reuse engine's `MockWord` shape (via import) | Engine's `QuizItem = MockFoundational \| MockWord`; vocab words are `MockWord` — no need for a new type |
| App deck type | New `AppDeck` / `AppLine` interfaces in `src/data/types.ts` | Decouples app data shape from engine internals |
| Transformer | Pure function `deckToQuizItems(deck)` + `buildWordPool(decks)` in `src/data/transformer.ts` | Explicit, testable conversion layer |
| Engine subpath exports | Remove `./data/mock/*` imports from app | App no longer needs them; engine package.json subpath exports can stay for other consumers |

---

## 3. Data Structures

```typescript
// src/data/types.ts
export interface AppWord {
  id: string
  native: string
  romanization: string
  english: string
  type: string
  language: 'th'
}

export interface AppLine {
  speaker: 'A' | 'B'
  native: string
  romanization: string
  english: string
  words: AppWord[]
}

export interface AppDeck {
  id: string
  topic: string
  lines: AppLine[]
}
```

`AppWord` is structurally identical to `MockWord` from the engine. The transformer casts `AppWord` to `MockWord` (which is `QuizItem`) — no data loss.

```typescript
// src/data/transformer.ts
export function deckToQuizItems(deck: AppDeck): MockWord[]
// Extracts unique words (deduped by id) from all lines in a deck.
// Returns them in insertion order.

export function buildWordPool(decks: AppDeck[]): MockWord[]
// Extracts all unique words across all decks (deduped by id).
// Used as the distractor pool passed to composeBatchMulti.
```

---

## 4. User Workflows

No UX change. Internal wiring change only:

```
BEFORE:
  App.vue → mockDecks (engine)
           → mockWords (engine)
           → wordPool (engine)

AFTER:
  App.vue → appDecks (local src/data/decks.ts)
           → deckToQuizItems(deck) (local transformer)
           → buildWordPool(appDecks) (local transformer)
```

---

## 5. Stories

### EP24-ST07: App-local deck types and data

**Scope**: Define types and copy deck content into the app
**Read List**:
- `packages/srs-engine-v2/data/mock/mock-decks.ts` — source content (eatLines, weatherLines)
- `packages/srs-engine-v2/data/mock/mock-words.ts` — MockWord type reference
**Tasks**:

- [ ] Create `src/data/types.ts` — `AppWord`, `AppLine`, `AppDeck`
- [ ] Create `src/data/decks.ts` — `eatDeck` and `weatherDeck` as `AppDeck[]`, using eatLines / weatherLines as content source; export `appDecks: AppDeck[]`

      **Acceptance Criteria**:
- [ ] All words from eatLines and weatherLines are present in the respective deck
- [ ] No imports from `@gll/srs-engine-v2` in `src/data/`

### EP24-ST08: Transformer — `AppDeck` → `QuizItem[]`

**Scope**: Pure conversion functions, no Vue
**Read List**:
- `src/data/types.ts` (ST07 output)
- `packages/srs-engine-v2/src/engine/compose-batch.ts` — `QuizItem` type
**Tasks**:

- [ ] Create `src/data/transformer.ts`
- [ ] `deckToQuizItems(deck: AppDeck): MockWord[]` — deduplicate words by `id` across all lines
- [ ] `buildWordPool(decks: AppDeck[]): MockWord[]` — deduplicate across all decks

      **Acceptance Criteria**:
- [ ] Duplicate word IDs (same word appears in multiple lines) are collapsed to one entry
- [ ] `buildWordPool([eatDeck, weatherDeck])` contains all unique words from both decks
- [ ] No word appears twice in the output

### EP24-ST09: Wire app to local data

**Scope**: Update `App.vue` and `DeckSelector.vue` to use local data; remove engine mock imports
**Read List**:
- `src/App.vue`
- `src/components/DeckSelector.vue`
- `src/data/decks.ts` (ST07)
- `src/data/transformer.ts` (ST08)
**Tasks**:

- [ ] Replace `mockDecks` / `mockWords` / `wordPool` imports in `App.vue` with `appDecks`, `deckToQuizItems`, `buildWordPool`
- [ ] Update `getDeckWords(id)` to use `deckToQuizItems`
- [ ] Build `wordPool` constant from `buildWordPool(appDecks)` at module level
- [ ] Update `DeckSelector.vue` — import `appDecks` instead of `mockDecks` from engine
- [ ] Remove `MockWord` import from engine in `App.vue` (use `AppWord` cast or inline)

      **Acceptance Criteria**:
- [ ] No imports from `@gll/srs-engine-v2/data/mock/*` anywhere in `src/`
- [ ] `vue-tsc --noEmit` passes
- [ ] Quiz loop works end-to-end in the browser

---

## 6. Success Criteria

1. `src/data/` is self-contained — no engine mock data imports
2. `vue-tsc --noEmit` passes with zero errors
3. Both decks selectable and quiz loop runs correctly in the browser
