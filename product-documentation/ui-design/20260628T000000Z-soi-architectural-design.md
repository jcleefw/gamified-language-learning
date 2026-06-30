# Soi — Gamified Language Learning Platform: Architectural Design

**Date:** 2026-06-28  
**Status:** Design Review  
**Author:** Design collaboration session  
**Scope:** UI/UX system design, integration with srs-engine-v2, data architecture

---

## 1. Overview

**Soi** is a gamified vocabulary-retention platform for English speakers learning languages with non-Latin scripts (Thai, Chinese, Japanese, Arabic). It blends three interactive mechanics (Listen & Match, Tile Construction, Boss Conversation) across a single learning session, distributing word repetitions across different modalities to prevent rote-learning fatigue.

### Core Promise

Users learn from **real conversation snippets**, practice words in **three distinct mechanics**, and graduate to **real conversation usability** — all within a single session loop.

### Target Learner

- Functional communication (travelers, hobbyists, casual learners)
- Script literacy (character/syllable recognition as primary skill)
- Daily-habit retention (spaced repetition + streak/heart mechanics)

---

## 2. Three-Mechanic Session Structure

### Session Model: Stage-Level Batching (Model B)

All eligible words progress through all three stages sequentially in a single session:

```
Session Start
├─ Stage 1: Listen & Match (all eligible words)
│  └─ Learner hears word, picks meaning
├─ Stage 2: Tile Construction (all eligible words)
│  └─ Learner rebuilds native word from syllable/character pieces
└─ Stage 3: Boss Conversation (all eligible words)
   └─ Learner navigates a real conversation using learned words
Session End → Recap + Streak/XP/Heart Update
```

**Eligible words** = Active pool − Shelved words (per deck)

### Stage 1: Listen & Match (Sound + Meaning Recognition)

**Goal:** Low-friction introduction; isolate sound and meaning without script burden

**Mechanics:**
- Audio plays (or TTS stub)
- Learner chooses correct English meaning from 4 options
- Distractor options are semantically related (not random)
- Feedback immediate; heart lost on wrong answer

**Engine Integration:**
```typescript
const questions = engine.assembleBatch(eligible, wordPool, {
  excludeIds: shelvedIds,
  shuffle: true,
});
// Questions include multiple-choice vocab items
```

**Word Strength Update:** `mastery → 1` on first correct answer

---

### Stage 2: Tile Construction (Script/Orthography Recognition)

**Goal:** Deep script literacy; hands-on character/syllable assembly

**Mechanics:**
- English prompt (e.g., "Build the Thai word for 'mango'")
- Tiles displayed (syllables for Thai, characters for Chinese, letter-forms for Arabic)
- Learner taps tiles in order to rebuild the word
- Wrong assembly → shake animation, reset, retry (no heart loss on retry)
- Correct assembly → heart preserved, strength +2

**Language-Specific Tokenization:**
- **Thai:** syllable boundaries + tone marks
- **Chinese:** character granularity
- **Japanese:** kana vs. kanji handling
- **Arabic:** connected letter-form positions

**Engine Integration:**
```typescript
const questions = engine.assembleBatch(eligible, wordPool, {
  excludeIds: shelvedIds,
  shuffle: true,
});
// Questions include tile-construction items (custom quiz type)
```

**Word Strength Update:** `mastery → min(3, mastery + 2)` on correct assembly

---

### Stage 3: Boss Conversation (Real Conversation Usability)

**Goal:** Payoff; learner applies all three words in a scripted but realistic exchange

**Mechanics:**
- Conversation unfolds turn-by-turn (vendor asks question, learner responds)
- Learner picks from 3 Thai options (correct + 2 distractors from learned words)
- Wrong answer → brief feedback, correct path shown, conversation continues
- Correct answer → conversation advances naturally
- Completion → recap + XP earned

**Example Flow:**
```
Vendor: "สวัสดีค่ะ" (Hello!)
System: "The vendor holds up a mango. Ask how much it is."
Learner: [Picks เท่าไหร่ (how much?)] ✓
Vendor: "ยี่สิบบาทค่ะ" (Twenty baht.)
System: "You taste a sample. Tell her it's delicious."
Learner: [Picks อร่อย (delicious)] ✓
Vendor: "ขอบคุณค่ะ" (Thank you!)
```

**Engine Integration:**
```typescript
const questions = engine.assembleBatch(eligible, wordPool, {
  excludeIds: shelvedIds,
  shuffle: true,
});
// Questions include conversation-turn items (custom quiz type)
```

**Word Strength Update:** `mastery → max(current, 3)` on correct conversation turn

---

## 3. Architectural Fit with srs-engine-v2

### Layering Model

```
srs-engine-v2 (pure scheduler)
    ↓ uses
@gll/srs-shelving (policy types + cap enforcement)
    ↓ uses
@gll/db (stagnation detection + persistence via LearningStore)
    ↓ uses
Soi App Layer (mechanics UI, session orchestration, deck loading)
```

### What Each Layer Owns

| Layer | Responsibility | Does NOT own |
|---|---|---|
| **srs-engine-v2** | Word scheduling (FSRS/SM-2), batch assembly, `excludeIds` filter | Mechanics, UI, persistence, detection |
| **@gll/srs-shelving** | Shelving policy types, `evaluateShelving` cap enforcement | Detection logic (DB's job) |
| **@gll/db** | Stagnation counter tracking, shelving state persistence | Scheduling algorithms |
| **Soi** | Mechanic presentation, session flow, deck loading, language tokenizers | Scheduling, shelving logic, persistence details |

### Engine Communication

**On Session Start:**
```typescript
const wordStates = store.getAllWordStates(userId);
const shelvedIds = store.getShelvedWords(userId, deckId);

// First batch
const s1Questions = engine.assembleBatch(eligible, wordPool, {
  excludeIds: shelvedIds,
  shuffle: true,
});
```

**After Each Answer:**
```typescript
const result = engine.recordAnswer(wordId, correct);

// At batch boundary, check stagnation
const stagnantIds = store.updateStagnationCounters(userId, deckId, activeIds);
const shelveDecision = evaluateShelving(stagnantIds, currentlyShelved, config);

if (shelveDecision.toShelve.length > 0) {
  for (const id of shelveDecision.toShelve) {
    store.shelveWord(userId, deckId, id, batchNum);
  }
}
```

**At Session End:**
```typescript
// Unshelve all words for next session (session-scoped unshelving)
store.unshelveAllWords(userId, deckId);
// Stagnation counters persist; reset on new session start
store.resetStagnationCounters(userId, deckId);
```

### Key Constraint: Mechanic-Agnostic Scheduling

**The engine does NOT track which mechanic a word was last seen in.** It only cares about `correct`/`wrong` feedback.

- Engine says: "Review word มะม่วง now"
- Soi decides: "Present it as Tile Construction" (vs. Listen & Match or Boss Conversation)
- Both choices feed back the same `correct`/`wrong` — scheduling is unaffected

This keeps srs-engine-v2 pure and allows Soi full freedom in mechanic orchestration.

---

## 4. Session Flow

### Initialization
```typescript
async function startSession(userId: string, deckId: string) {
  // 1. Load deck definition (Soi asset, from DB)
  const deck = await store.getDeck(deckId);
  
  // 2. Load user's progress (from DB)
  const wordStates = store.getAllWordStates(userId);
  
  // 3. Get shelved words for this deck
  const shelvedIds = store.getShelvedWords(userId, deckId);
  
  // 4. Determine eligible words
  const eligible = deck.words.filter(w => !shelvedIds.has(w.id));
  
  // 5. Initialize session state
  const sessionState = {
    batchNum: 0,
    currentStage: STAGE_LISTEN,
    hearts: 3,
    xp: 0,
    strengths: {},
  };
  
  return playStages(deck, eligible, sessionState);
}
```

### Stage Execution (Pseudo-code)
```typescript
async function playStages(deck, eligible, sessionState) {
  for (const stage of [STAGE_LISTEN, STAGE_BUILD, STAGE_BOSS]) {
    sessionState.currentStage = stage;
    const stageQuestions = assembleBatchForStage(stage, eligible);
    
    for (const question of stageQuestions) {
      const answer = await presentQuestion(question);
      const correct = checkAnswer(answer, question.answer);
      
      // Feed back to engine
      engine.recordAnswer(question.wordId, correct);
      
      // Update UI state
      sessionState.strengths[question.wordId] = computeStrength(correct);
      if (!correct) sessionState.hearts--;
    }
    
    // At each stage boundary: check stagnation
    const stagnant = store.updateStagnationCounters(userId, deckId, eligible);
    if (stagnant.length > 0) {
      const decision = evaluateShelving(stagnant, currentlyShelved, config);
      applyShelving(decision);
    }
  }
  
  // Session complete
  return showRecap(sessionState);
}
```

---

## 5. Deck Storage & Import Strategy

### Design: Normalize Deck JSON into DB

**Source of Truth:** Deck JSON files (can be shipped, versioned, or uploaded)

**Persistent Store:** SQLite via @gll/db (same schema as cli-demo-db)

**Schema:**

```sql
-- Deck metadata
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  name TEXT,
  language TEXT,
  difficulty TEXT,
  register TEXT,
  created_at TEXT
);

-- Sentences (lines of conversation)
CREATE TABLE sentences (
  id TEXT PRIMARY KEY,
  deck_id TEXT,
  language TEXT,
  text TEXT,
  english TEXT,
  romanization TEXT,
  speaker TEXT,
  position INTEGER,
  FOREIGN KEY (deck_id) REFERENCES decks(id)
);

-- Words (vocabulary items)
CREATE TABLE words (
  id TEXT PRIMARY KEY,
  language TEXT,
  text TEXT,
  senses JSON, -- [{romanization, english, type}]
);

-- Deck-word association
CREATE TABLE deck_words (
  deck_id TEXT,
  word_id TEXT,
  PRIMARY KEY (deck_id, word_id)
);

-- Word positions within sentences (for tile construction)
CREATE TABLE sentence_components (
  id TEXT PRIMARY KEY,
  sentence_id TEXT,
  word_id TEXT,
  position INTEGER,
  romanization TEXT,
  english TEXT,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id),
  FOREIGN KEY (word_id) REFERENCES words(id)
);
```

### Import Flow (One-Time Operation)

```bash
# 1. Define deck JSON
# mango-stall.json:
{
  "id": "deck-mango",
  "topic": "The Mango Stall",
  "difficulty": "beginner",
  "register": "informal",
  "lines": [
    {
      "speaker": "vendor",
      "thai": "สวัสดีค่ะ",
      "english": "Hello!",
      "romanization": "sa-wat-dee kah"
    },
    ...
  ],
  "breakdown": [
    {
      "thai": "สวัสดี",
      "romanization": "sa-wat-dee",
      "english": "hello",
      "components": [
        { "thai": "สว", "romanization": "sa", "english": "auspicious" },
        { "thai": "สดี", "romanization": "wat-dee", "english": "good" }
      ]
    },
    ...
  ]
}

# 2. Run import (once)
npx tsx apps/cli-demo-db/src/import-curriculum.ts --deck mango-stall.json

# 3. Deck permanently stored in DB; JSON can be archived
# Runtime queries DB only:
const deck = store.getDeck('deck-mango');
```

### Runtime (Always from DB)

```typescript
// Session initialization never loads JSON
const deck = await store.getDeck(deckId); // DB query, not file I/O
```

---

## 6. Language Tokenization Interface

### Design Pattern

Deck import includes pre-computed tile breakdowns (stored in `sentence_components`). At runtime, Soi retrieves them from DB.

**For new languages, define a tokenizer:**

```typescript
interface LanguageTokenizer {
  language: string;
  tokenize(word: string): string[]; // word → [syllables] or [characters]
}

// Thai tokenizer
const thaiTokenizer: LanguageTokenizer = {
  language: 'th',
  tokenize: (word) => {
    // Split at syllable + tone-mark boundaries
    // มะม่วง → ["มะ", "ม่วง"]
    return syllableSplit(word);
  },
};

// Chinese tokenizer
const chineseTokenizer: LanguageTokenizer = {
  language: 'zh',
  tokenize: (word) => {
    // Split by character
    // 芒果 → ["芒", "果"]
    return word.split('');
  },
};
```

**Deck import uses tokenizer to pre-compute tiles:**

```typescript
function importDeckWithTokenization(deck, tokenizer) {
  for (const sentence of deck.breakdown) {
    for (const component of sentence.components) {
      const tiles = tokenizer.tokenize(component.thai);
      insertSentenceComponent(component, tiles);
    }
  }
}
```

**At runtime, tiles come pre-computed from DB:**

```typescript
const component = store.getSentenceComponent(componentId);
// { word: "มะม่วง", tiles: ["มะ", "ม่วง"] }
```

---

## 7. Strength Meter & Habit Loop

### Per-Word Strength Tracking

**Strength Levels:** 0-3 bars

| Level | Meaning | Earned By |
|---|---|---|
| 0 | Never seen | Initial state |
| 1 | Recognized (sound + meaning) | Listen & Match correct |
| 2 | Can spell (script) | Tile Construction correct (+2 from 0, +1 from 1) |
| 3 | Can use (conversation) | Boss Conversation correct |

**Strength Update Logic:**
```typescript
function updateStrength(wordId, stage, correct) {
  const current = strengths[wordId] || 0;
  
  if (!correct) return; // No strength gain on wrong answer
  
  switch (stage) {
    case STAGE_LISTEN:
      strengths[wordId] = Math.max(current, 1);
      break;
    case STAGE_BUILD:
      strengths[wordId] = Math.min(3, current + 2);
      break;
    case STAGE_BOSS:
      strengths[wordId] = 3;
      break;
  }
}
```

### Session Recap

**Display per-word progress:**

```
Words You Can Now Use
┌─────────────────────────────────┐
│ มะม่วง (má-mûang)                │
│ mango                           │
│ ███░ (strength: 3/3)            │
├─────────────────────────────────┤
│ เท่าไหร่ (tâo-rài)               │
│ how much                        │
│ ██░░ (strength: 2/3)            │
└─────────────────────────────────┘
```

### Habit Mechanics

- **Streak:** Incremented on session completion; reset on missed day
- **Hearts:** 3 per session; 1 lost per wrong answer; session fails if hearts = 0 before stage 3
- **XP:** +10 for Listen & Match correct, +15 for Tile Build correct, +20 for Boss Conversation correct

---

## 8. Shelving Integration

### Stagnation Detection (DB Layer Responsibility)

At each batch boundary, @gll/db tracks:
- `stagnation_count`: increments if mastery unchanged since last batch
- `last_boundary_mastery`: mastery value at previous boundary

```typescript
// After batch
const stagnant = store.getStagnantWords(userId, deckId, threshold: 3);
// Returns word IDs where stagnation_count >= 3
```

### Shelving Policy (srs-shelving Layer)

```typescript
import { evaluateShelving, DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving';

const decision = evaluateShelving(
  stagnant,           // [wordId1, wordId2, ...]
  currentlyShelved,   // Set<wordId>
  DEFAULT_SHELVING_CONFIG // { stagnationBatchWindow: 3, maxShelved: 2 }
);

// decision = { toShelve: [wordId1], toUnshelve: [] }
```

### Soi Session Orchestration

```typescript
// During session, after each batch:
if (batchNum % batchesPerBoundary === 0) {
  const stagnant = store.updateStagnationCounters(userId, deckId, activeIds);
  const decision = evaluateShelving(stagnant, currentlyShelved, config);
  
  for (const id of decision.toShelve) {
    store.shelveWord(userId, deckId, id, batchNum);
  }
}

// On next session, unshelve + reset counters
store.unshelveAllWords(userId, deckId);
store.resetStagnationCounters(userId, deckId);
```

### UX Impact

- Shelved words are excluded from batches (filtered by `excludeIds`)
- Shelved words still hold an active slot (no queue refill)
- Learner sees progress focusing on unshelved words
- Shelved words automatically return next session (fresh perspective)

---

## 9. Visual Design Principles

### Palette

Inspired by Thai street market at dusk:
- **Night:** `#14202b` (background)
- **Teal:** `#2a9d8f` / `#3ec9b8` (active states, progress)
- **Mango:** `#f4a017` / `#f7c873` (accents, UI highlights)
- **Coral:** `#e8624a` (errors, losses)
- **Cream:** `#f5ece0` (text, UI details)

### Typography

- **Display (Fraunces):** Headlines, badges
- **Thai (Sarabun):** All Thai text
- **UI (Space Grotesk):** Buttons, labels, navigation

### Layout

- Mobile-first (460px max-width)
- Sticky topbar (crumb, streak, hearts)
- Smooth transitions (rise animation on screen change)
- Card-based stages (visual separation per stage)

---

## 10. Data Model Summary

### User State (from LearningStore)

```typescript
interface WordState {
  wordId: string;
  userId: string;
  mastery: number;      // 0-5 (FSRS interval-based)
  correct: number;      // lifetime correct counts
  wrong: number;        // lifetime wrong counts
  lapses: number;       // review failures
  lastReviewDate: string;
  nextReviewDate: string;
}

interface ShelvedWord {
  wordId: string;
  shelvedAtBatch: number;
}
```

### Deck Content (from LearningStore)

```typescript
interface DeckDefinition {
  id: string;
  name: string;
  language: string;
  difficulty?: string;
  register?: string;
  
  sentences: Sentence[];
  words: Word[];
}

interface Sentence {
  id: string;
  text: string;
  english: string;
  romanization: string;
  speaker?: string;
  components: SentenceComponent[];
}

interface SentenceComponent {
  id: string;
  wordId: string;
  position: number;
  tiles: string[]; // Pre-tokenized [syllables] or [characters]
}

interface Word {
  id: string;
  text: string;
  romanization: string;
  english: string;
  type: string;
}
```

### Session State (UI-local)

```typescript
interface SessionState {
  userId: string;
  deckId: string;
  currentStage: Stage;
  batchNum: number;
  
  hearts: number;
  xp: number;
  strengths: Record<wordId, 0 | 1 | 2 | 3>;
  
  activeWords: Word[];
  shelvedIds: Set<string>;
}
```

---

## 11. Implementation Roadmap

### Phase 1: Core Three-Mechanic UI (Optional)

- [ ] Scaffold React/Vue component structure
- [ ] Implement Listen & Match stage UI
- [ ] Implement Tile Construction stage UI
- [ ] Implement Boss Conversation stage UI
- [ ] Session flow orchestration

### Phase 2: Integration with srs-engine-v2

- [ ] Wire engine.assembleBatch() calls
- [ ] Integrate feedback loop (recordAnswer)
- [ ] Connect strength tracking to mastery updates
- [ ] Unshelving/stagnation reset on session start

### Phase 3: Deck Storage & Import

- [ ] Extend LearningStore for getDeck()
- [ ] Write deck import CLI tool
- [ ] Seed demo decks (mango stall, noodle cart, tuk-tuk)

### Phase 4: Language Tokenizers

- [ ] Thai syllable tokenizer
- [ ] Chinese character tokenizer
- [ ] Japanese kana/kanji handler
- [ ] Arabic letter-form handler

### Phase 5: Shelving & Stagnation (Reuse EP26)

- [ ] Integrate evaluateShelving from @gll/srs-shelving
- [ ] Wire stagnation counter updates at batch boundaries
- [ ] Test shelving + unshelving flow

### Phase 6: Habit Loop & Analytics

- [ ] Streak persistence
- [ ] Heart system
- [ ] XP progression
- [ ] Session recap screen

---

## 12. Key Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| **Mechanic Scope** | Stage-level (all words in all stages) | Prevents learner burnout; distributes practice across modalities; natural payoff arc |
| **Shelving Scope** | Deck-scoped (not global) | Stagnation is contextual; deck A struggle ≠ deck B struggle |
| **Deck Storage** | Normalized DB (like cli-demo-db) | One-time import; efficient queries; reuses existing schema |
| **Strength Levels** | 0-3 bars | Simple UX; maps to three mechanics; fast visual feedback |
| **Unshelving Policy** | Session-scoped (not time-based) | Keeps engine pure; simpler session semantics; fresh perspective each day |
| **Engine Integration** | Mechanic-agnostic | Engine doesn't care which stage delivered the answer; full UI freedom |

---

## 13. Future Enhancements

- **User-Generated Decks:** Allow learners to upload conversation snippets → auto-generate decks
- **Adaptive Difficulty:** Deck difficulty selected based on learner level (tracked via mastery)
- **Social Features:** Deck sharing, leaderboards, challenge modes
- **Pronunciation Grading:** Integrate speech recognition for tone validation (Thai-specific)
- **Offline Mode:** Cache decks locally; sync state on reconnect
- **Analytics:** Trajectory analysis (mastery progression, preferred mechanics)

---

## References

- [srs-engine-v2 Architecture](../architecture/20260520T000000Z-engineering-srs-engine-v2-core.md)
- [SRS Shelving Policy (EP26)](../architecture/20260626T000000Z-engineering-shelving-stagnation-policy.md)
- [Database Schema](../architecture/20260620T000000Z-engineering-database-schema.md)
- [Mastery Is Global (ADR)](../architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md)
- [Prototype: thai-quest.html](https://claude.ai/share/33605a02-295a-4992-8457-ed6a6d0140fc)
