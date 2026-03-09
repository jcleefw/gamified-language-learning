# EP08-DS01: Terminal Quiz Runner + Real Seed Data Specification

**Date**: 20260308T141850Z
**Status**: Draft
**Epic**: [EP08 - Terminal Quiz Runner + Seed Data](../../plans/epics/EP08-terminal-quiz-runner.md)

---

## 1. Feature Overview

Wire the SRS engine end-to-end using real Thai language content. Two mapper functions convert raw content (foundational consonants + conversation decks) into `WordState[]`, and a terminal quiz runner script loops `composeBatch → answer → processAnswers` to validate the engine as a complete system.

## 2. Core Requirements

| Requirement | Decision | Rationale |
|-------------|----------|-----------|
| Content types location | `packages/srs-engine/data/types.ts` | Co-located with sample files; not exported from `@gll/srs-engine` — internal to data layer |
| Mapper location | `packages/srs-engine/data/mappers.ts` | Pure functions; testable independently |
| Word ID strategy | `foundational:{char.id}` for consonants (e.g. `foundational:ko-kai`), `curated:{word.thai}` for conversation words (e.g. `curated:หิว`) | Native character is the source of truth for uniqueness — romanization stripping loses tone information which changes meaning in tonal languages; IDs are machine-generated, never typed by users |
| Foundational deck size | 5 consonants (first 5 from sample: ก ข ค ง จ) | Enough to prove foundational mechanics without bloating test runs |
| Foundational category | All `ThaiCharacter` entries → `category: 'foundational'` | Consonants are high-frequency building blocks |
| Curated category | All conversation `uniqueWords` → `category: 'curated'` | Vocabulary from conversation decks |
| Deduplication | Conversation words deduped by `thai` field across all conversations | Same word appearing in multiple conversations = one `WordState` |
| Runner input | stdin via Node `readline` | Interactive; proves engine API ergonomics |
| Runner answer format | `c` = correct, `w` = wrong, `q` = quit | Minimal keystrokes for testing |
| Runner iterations | Loop until user quits or all words mastered | Open-ended; no fixed batch count |

## 3. Data Structures

### Content Types (`packages/srs-engine/data/types.ts`)

```typescript
/** Foundational character — language-agnostic base.
 *  PRD §5.10: base = id, character, name, romanization, language, type.
 *  Language-specific metadata varies (Thai: class/soundClass/IPA; other langs: TBD). */
export interface FoundationalCharacter {
  id: string
  char: string
  name: string
  romanization: string
  language: string
  nameThai?: string
  type: 'consonant' | 'vowel' | 'tone'
  audioFile?: string
  metadata?: Record<string, unknown>   // language-specific; not typed per-language in Stage 1
}

/** A single word extracted from a conversation breakdown. */
export interface ConversationWord {
  thai: string
  romanization: string
  english: string
  type: string              // 'verb' | 'noun' | 'adjective' | 'particle' | etc.
}

/** A conversation deck with dialogue lines and extracted vocabulary. */
export interface Conversation {
  id: string
  topic: string
  lines: ConversationLine[]
  difficulty: string
  register: string
  uniqueWords: ConversationWord[]
  createdAt?: number
}

export interface ConversationLine {
  speaker: string
  thai: string
  english: string
  romanization: string
}
```

### Mapper Functions (`packages/srs-engine/data/mappers.ts`)

```typescript
import type { WordState } from '../src/types.js'
import type { FoundationalCharacter, ConversationWord } from './types.js'

/** Convert a FoundationalCharacter to a fresh WordState (foundational, learning phase). */
export function characterToWordState(char: FoundationalCharacter): WordState

/** Convert conversation uniqueWords to fresh WordStates (curated, learning phase).
 *  Deduplicates by `thai` field — first occurrence wins.
 *  Word ID = `curated:${word.thai}` (native character as unique key). */
export function conversationWordsToWordStates(words: ConversationWord[]): WordState[]
```

**WordState mapping:**

| Source field | WordState field | Value |
|-------------|----------------|-------|
| `ThaiCharacter.id` | `wordId` | `foundational:{char.id}` (e.g. `foundational:ko-kai`) |
| — | `category` | `'foundational'` |
| — | `masteryCount` | `0` |
| — | `phase` | `'learning'` |
| — | `lapseCount` | `0` |
| — | `correctCount` | `0` |
| — | `wrongCount` | `0` |
| `ConversationWord.thai` | `wordId` | `curated:${word.thai}` (e.g. `curated:หิว`) |
| — | `category` | `'curated'` |
| — | all other fields | same defaults as above |

## 4. User Workflows

### Quiz Runner Flow

```
START
  → Load consonants from foundations-consonants.ts → characterToWordState() → foundationalStates[]
  → Load conversations from conversations-2026-03-08.json → conversationWordsToWordStates() → curatedStates[]
  → Merge into allWordStates[]
  → Create SrsEngine(config)
  → LOOP:
      → engine.composeBatch(allWordStates) → batch
      → Print batch questions (word ID, question type)
      → For each question: prompt stdin → c/w/q
      → If 'q': EXIT
      → Build QuizAnswer[] from responses
      → engine.processAnswers(answers, allWordStates) → updatedStates
      → Print mastery summary (phase, mastery count, changes)
      → allWordStates = updatedStates
      → LOOP
```

## 5. Stories

### EP08-ST01: Content types + seed data mappers

**Scope**: Data types and pure mapper functions
**Read List**:
- `packages/srs-engine/src/types.ts` (WordState shape)
- `packages/srs-engine/data/samples/foundations-consonants.ts` (input format)
- `packages/srs-engine/data/samples/conversations-2026-03-08.json` (input format)

**Tasks**:
- [ ] Create `packages/srs-engine/data/types.ts` — `ThaiCharacter`, `ThaiCharacterMetadata`, `ConversationWord`, `Conversation`, `ConversationLine`
- [ ] Create `packages/srs-engine/data/mappers.ts` — `characterToWordState()`, `conversationWordsToWordStates()`
- [ ] Fix import in `foundations-consonants.ts`: replace `@/types/characters` with relative import to `./types.js`
- [ ] Create `packages/srs-engine/data/__tests__/mappers.test.ts`
- [ ] Update `packages/srs-engine/data/CODEMAP.md`

**Acceptance Criteria**:
- [ ] `characterToWordState()` produces a valid `WordState` with `category: 'foundational'`, `phase: 'learning'`, all counters at 0
- [ ] `wordId` format is `foundational:{id}` for characters (e.g. `foundational:ko-kai`), `curated:{word.thai}` for conversation words (e.g. `curated:หิว`)
- [ ] `conversationWordsToWordStates()` deduplicates by `thai` — duplicate words across conversations produce one `WordState`
- [ ] First 5 consonants from `foundations-consonants.ts` map successfully (ก ข ค ง จ)
- [ ] Conversation words from sample JSON map successfully
- [ ] `pnpm test` passes

### EP08-ST02: Terminal quiz runner

**Scope**: Interactive terminal script proving engine end-to-end
**Read List**:
- `scripts/demo-srs.ts` (existing script conventions)
- `packages/srs-engine/src/srs-engine.ts` (SrsEngine API)
- `packages/srs-engine/data/mappers.ts` (ST01 output)
- `packages/srs-engine/data/samples/foundations-consonants.ts`
- `packages/srs-engine/data/samples/conversations-2026-03-08.json`

**Tasks**:
- [ ] Create `scripts/quiz-runner.ts` — interactive quiz loop using `readline`
- [ ] Load real seed data: import consonants + read conversation JSON, map to `WordState[]`
- [ ] Instantiate `SrsEngine` with production-like config (batchSize=15, masteryThreshold curated=10 / foundational=5, activeWordLimit=8)
- [ ] Loop: `composeBatch` → display questions → collect stdin answers (c/w/q) → `processAnswers` → print summary
- [ ] Print per-batch summary: words answered, mastery changes, phase transitions, shelved words
- [ ] Add `"quiz": "tsx scripts/quiz-runner.ts"` to root `package.json`
- [ ] No unit tests (interactive script)

**Acceptance Criteria**:
- [ ] `pnpm run quiz` starts the interactive runner without errors
- [ ] First batch contains a mix of foundational and curated words
- [ ] Answering 'c' or 'w' updates mastery and proceeds to next question
- [ ] After a full batch, updated mastery states are printed
- [ ] At least one word demonstrates carry-over across batches (visible in output)
- [ ] At least one foundational word can reach mastery threshold (5 correct) within a session
- [ ] Answering 'q' exits cleanly
- [ ] All data remains in-memory (no files written, no network calls)

## 6. Success Criteria

1. `pnpm test` passes (mapper unit tests)
2. `pnpm run quiz` launches, accepts input, and loops through batches with real Thai content
3. Console output shows mastery progression, phase transitions, and carry-over behaviour
4. No type errors (`pnpm typecheck`)
