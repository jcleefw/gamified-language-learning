# EP15-DS02: Mixed Question Direction for `/api/srs/batch`

**Date**: 20260314T000000Z
**Status**: Draft
**Epic**: EP15 — Quiz Contract: Server-Side Answer Authority
**Extends**: [EP15-DS01](./20260313T000000Z-EP15-DS01-design-spec.md)

---

## 1. Overview

Currently `/api/srs/batch` always generates `multiple_choice` questions in one direction:
- `targetText` = Thai native character (e.g., "ก")
- `choices` = Thai native characters (distractors)

This means both the prompt and the choices are the same type of value. The change introduces two directions, randomly assigned per question:

| Direction | `targetText` | `choices` values |
|---|---|---|
| `english_to_native` | English name (e.g., "Ko Kai") | Thai characters (e.g., "ก", "ข", "ค", "ง") |
| `native_to_english` | Thai character (e.g., "ก") | English names (e.g., "Ko Kai", "Kho Khai", …) |

The invariant: **`targetText` and `choices` values are never the same type of text.**

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Direction assignment | 50/50 random per question | Balanced exposure to both recognition and recall |
| Expose `questionDirection` in wire type | **Yes** — add to `QuizQuestion` | Client needs it to render the prompt correctly; inferring from script is fragile |
| `correctKey` calculation | Unchanged — key whose value === correct answer text | Works for both directions; no logic change needed |
| Distractor source for `english_to_native` | `WordDetail.native` (Thai chars) from pool | Same pool, different field |
| Distractor source for `native_to_english` | `WordDetail.english` (English names) from pool | Same pool, different field |
| `targetText` for `english_to_native` | `WordDetail.english` | Prompt is the English name; player picks the Thai char |
| `targetText` for `native_to_english` | `WordDetail.native` | Prompt is the Thai char; player picks the English name |

---

## 3. Data Structures

### `@gll/api-contract` — `QuizQuestion` addition

```typescript
type QuestionDirection = 'english_to_native' | 'native_to_english';

interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
  targetText: string;
  choices: Record<string, string>;
  questionDirection: QuestionDirection;  // ADD
}
```

### `buildMcChoices` signature change (server-internal)

```typescript
// Before
function buildMcChoices(
  wordId: string,
  pool: Map<string, WordDetail>,
): { choices: Record<string, string>; correctKey: string }

// After
function buildMcChoices(
  wordId: string,
  pool: Map<string, WordDetail>,
  direction: QuestionDirection,
): { choices: Record<string, string>; correctKey: string; targetText: string }
```

**`english_to_native`** (see English name, pick Thai char):
```
correctText  = pool.get(wordId).native
distractors  = 3 random pool entries (excluding wordId) → .native
targetText   = pool.get(wordId).english
```

**`native_to_english`** (see Thai char, pick English name):
```
correctText  = pool.get(wordId).english
distractors  = 3 random pool entries (excluding wordId) → .english
targetText   = pool.get(wordId).native
```

In both cases, shuffle `[correctText, ...distractors]` into `{ a, b, c, d }` and find the key whose value equals `correctText` — same logic as today.

---

## 4. Workflow Change — `/batch` handler

```
for each multiple_choice question:
  direction = Math.random() < 0.5 ? 'english_to_native' : 'native_to_english'
  { choices, correctKey, targetText } = buildMcChoices(q.wordId, wordDetails, direction)
  correctKeys[q.wordId] = correctKey
  return { wordId, questionType, targetText, choices, questionDirection: direction }
```

No change to `/answers` handler — correctness is still `selectedKey === correctKey` regardless of direction.

---

## 5. Files to Change

| File | Change |
|---|---|
| `packages/api-contract/src/srs.ts` | Add `QuestionDirection` type; add `questionDirection` field to `QuizQuestion` |
| `apps/server/src/routes/srs.ts` | Update `buildMcChoices` signature + logic; update `/batch` handler to pick random direction |
| `apps/server/src/routes/__tests__/srs.test.ts` | Add test: MC questions have `questionDirection`; choices type matches direction |

---

## 6. Acceptance Criteria

- [ ] Each `multiple_choice` question in `/batch` response has `questionDirection: 'english_to_native' | 'native_to_english'`
- [ ] When `questionDirection === 'english_to_native'`: `targetText` is an English name; all 4 choice values are Thai characters
- [ ] When `questionDirection === 'native_to_english'`: `targetText` is a Thai character; all 4 choice values are English names
- [ ] `targetText` is never the same type of value as the `choices` in the same question
- [ ] `correctKey` is still stored server-side only; `/answers` flow unchanged
- [ ] `pnpm test` green for `apps/server` and `packages/api-contract`
- [ ] `pnpm typecheck` green across monorepo

---

## 7. Out of Scope

- Weighted direction bias (e.g., 70/30 favoring harder direction) — future tuning
- Client-side rendering logic for direction — EP16
- Exposing direction in `/answers` response — not needed; direction is per question in `/batch`
