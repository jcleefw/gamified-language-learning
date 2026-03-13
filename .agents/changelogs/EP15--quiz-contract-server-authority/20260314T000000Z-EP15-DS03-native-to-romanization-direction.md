# EP15-DS03: Add `native_to_romanization` Question Direction

**Date**: 20260314T000000Z
**Status**: Draft
**Epic**: EP15 — Quiz Contract: Server-Side Answer Authority
**Extends**: [EP15-DS02](./20260314T000000Z-EP15-DS02-mixed-question-direction.md)

---

## 1. Overview

EP15-DS02 introduced two question directions. This adds a third:

| Direction | `targetText` | `choices` values | Tests |
|---|---|---|---|
| `english_to_native` | English sound (e.g., `"k"`) | Thai characters (e.g., `"ก"`, `"ข"`, …) | Recall: hear the sound, pick the script |
| `native_to_english` | Thai character (e.g., `"ก"`) | English sounds (e.g., `"k"`, `"kh"`, …) | Recognition: see the script, pick the sound |
| `native_to_romanization` *(new)* | Thai character (e.g., `"ก"`) | Romanizations (e.g., `"Ko Kai"`, `"Kho Khai"`, …) | Recognition: see the script, pick the full name |

`native_to_romanization` tests a distinct skill from `native_to_english` — the learner must recall the consonant's full name (romanization), not just its phonetic value. Many consonants share the same English sound (e.g. `"kh"` maps to ก, ข, ค, ฆ), making romanization the only unambiguous label.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Direction selection | Uniform random 1-of-3 per question | Equal exposure to all three skill types; no weighting at this stage |
| Distractor source for new direction | `WordDetail.romanization` from pool, excluding current wordId | Already present on every `WordDetail`; no new data needed |
| `targetText` for `native_to_romanization` | `WordDetail.native` | Prompt is the Thai character; player picks the romanization |
| `correctText` for `native_to_romanization` | `WordDetail.romanization` | The correct choice is the full romanization name |
| Uniqueness concern | Romanizations are globally unique across the 44-consonant pool | Safe to use as distractor candidates without deduplication |

---

## 3. Data Structures

### `@gll/api-contract` — `QuestionDirection` type change

```typescript
// Before
type QuestionDirection = 'english_to_native' | 'native_to_english';

// After
type QuestionDirection = 'english_to_native' | 'native_to_english' | 'native_to_romanization';
```

No other changes to `@gll/api-contract`. `QuizQuestion.questionDirection` field already exists from DS02.

### `buildMcChoices` — add new branch (server-internal)

The function signature is unchanged. A third `direction` value is handled:

```
native_to_romanization:
  targetText  = pool.get(wordId).native
  correctText = pool.get(wordId).romanization
  distractors = 3 random pool entries (excluding wordId) → .romanization
```

Full mapping summary:

| direction | targetText | correctText | distractor field |
|---|---|---|---|
| `english_to_native` | `.english` | `.native` | `.native` |
| `native_to_english` | `.native` | `.english` | `.english` |
| `native_to_romanization` | `.native` | `.romanization` | `.romanization` |

### Direction picker in `/batch` handler

```typescript
// Before
const direction: QuestionDirection =
  Math.random() < 0.5 ? 'english_to_native' : 'native_to_english';

// After
const DIRECTIONS: QuestionDirection[] = [
  'english_to_native',
  'native_to_english',
  'native_to_romanization',
];
const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]!;
```

---

## 4. Files to Change

| File | Change |
|---|---|
| `packages/api-contract/src/srs.ts` | Add `'native_to_romanization'` to `QuestionDirection` union |
| `apps/server/src/routes/srs.ts` | Add `native_to_romanization` branch in `buildMcChoices`; replace 50/50 picker with 1-of-3 `DIRECTIONS` array |
| `apps/server/src/routes/__tests__/srs.test.ts` | Add test: when `questionDirection === 'native_to_romanization'`, `targetText` is a Thai char and all 4 choice values are romanization strings |

No changes to `batchRegistry`, `store`, seed files, or `/answers` handler.

---

## 5. Acceptance Criteria

- [ ] `QuestionDirection` type includes `'native_to_romanization'`
- [ ] `pnpm typecheck` green across monorepo after contract change
- [ ] When `questionDirection === 'native_to_romanization'`:
  - `targetText` is a Thai character (single Unicode char from the consonant set)
  - All 4 `choices` values are romanization strings (title-case multi-word, e.g. `"Ko Kai"`)
  - Exactly one choice value equals the correct romanization for that `wordId`
- [ ] `/answers` correctness check unchanged — `selectedKey === correctKey` still works for all three directions
- [ ] `pnpm test` green for `apps/server` and `packages/api-contract`

---

## 6. Out of Scope

- Weighted direction bias across the three directions — future tuning
- `english_to_romanization` direction (see English sound, pick full name) — low pedagogical value given overlapping English sounds
- Client rendering for the new direction — EP16
