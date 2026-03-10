# Code Standards — Examples

Reference examples for the code standards defined in [RULES.md](../RULES.md). **Not mandatory agent reading** — use only when you need to see what a rule looks like in practice.

---

## 1. Explicit Types

**GOOD**:

```typescript
interface QuizAnswer {
  wordId: string;
  selectedChoice: string;
  isCorrect: boolean;
  timestamp: Date;
}

function recordAnswer(answer: QuizAnswer): void {
  // ...
}
```

**BAD**:

```typescript
function recordAnswer(answer: any): void {}
```

---

## 2. Descriptive Names

**GOOD**:

```typescript
const isWordMastered = mastery.count >= MASTERY_THRESHOLD;
const hasActiveLearnedWords = activeWindow.length > 0;
const getNextReviewInterval = (lapsedCount: number) =>
  ANKI_INTERVALS[lapsedCount];
```

**BAD**:

```typescript
const m = mastery.count >= MASTERY_THRESHOLD;
const a = activeWindow.length > 0;
const nri = (l) => ANKI_INTERVALS[l];
```

---

## 3. Self-Documenting Code

**GOOD**:

```typescript
// ANKI lapse rule: 3 failures drops word back to learning phase
if (word.lapseCount >= 3) {
  word.phase = 'learning';
  word.masteryCount = 0;
}
```

**BAD**:

```typescript
// Increment lapse count
word.lapseCount++;
// Set phase to learning
word.phase = 'learning';
```

---

## 4. No Generic Patterns

**GOOD**:

```typescript
// In quiz.ts
const multipleChoiceQuestions = questions
  .filter((q) => q.type === 'MC')
  .slice(0, 10);

// In admin.ts
const reviewQuestions = questions
  .filter((q) => q.type === 'review')
  .slice(0, 5);
// ↑ Two similar lines — acceptable without extracting
```

**BAD**:

```typescript
// utils/filterAndSlice.ts
export const filterAndSlice = (items, predicate, limit) =>
  items.filter(predicate).slice(0, limit);
// ↑ Over-engineered for two call sites
```
