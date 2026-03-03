# CONTEXT.md

Agent reference: tech stack, architecture, domain model, key patterns.
Human product docs → [product-documentation/PRODUCT-BRIEF.md](product-documentation/PRODUCT-BRIEF.md)

**For dev setup → [SETUP.md](./SETUP.md)** | **For navigation → [CODEMAP.md](./CODEMAP.md)**

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | Vue 3 + Nuxt | PWA, SSR, routing, auth utilities |
| **Styling** | PandaCSS | Design tokens, atomic styles, mobile-first |
| **UI Components** | Ark UI | Headless atomic components |
| **Backend Runtime** | Cloudflare Workers | Serverless, globally distributed |
| **Database** | Cloudflare D1 (SQLite) | Relational data, structured queries |
| **File Storage** | Cloudflare R2 | Audio files (TTS output) |
| **Async Processing** | Cloudflare Queues | TTS generation pipeline |
| **Auth** | nuxt-auth-utils | Google OAuth + credentials, JWT sessions |
| **AI / TTS** | Gemini API | Conversation generation, word breakdown, TTS audio |
| **Package Manager** | pnpm | Monorepo-friendly |
| **Deployment** | Cloudflare Pages | PWA hosting |

**ADRs (accepted decisions)**:
- [FE Framework](product-documentation/architecture/20260226T133833Z-fe-framework-toolchain.md) — Vue 3 + Nuxt + PandaCSS
- [PWA Strategy](product-documentation/architecture/20260227T000000Z-fe-pwa-platform-strategy.md) — No app store, URL distribution
- [Monorepo Tooling](product-documentation/architecture/20260227T022513Z-engineering-monorepo-tooling.md)
- [Cloudflare Infra](product-documentation/architecture/20260301T161844Z-infra-cloudflare-platform.md)

---

## System Architecture

Four subsystems, each with its own PRD:

```
┌─────────────────────────────────────────┐
│         User Management & Auth          │
│    Google OAuth + Credentials + JWT     │
└───────────────────┬─────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│ Content Curation │   │  SRS Learning    │
│  (Curator Path)  │   │  (Learner Path)  │
│                  │   │                  │
│ - AI conv. gen.  │   │ - Quiz batches   │
│ - Word breakdown │   │ - Mastery track  │
│ - TTS + publish  │   │ - ANKI review    │
└────────┬─────────┘   └────────┬─────────┘
         └──────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │  Gemini TTS System    │
        │  (Shared Infra)       │
        │                       │
        │  10 RPD free tier     │
        │  Queue → R2 storage   │
        └───────────────────────┘
```

---

## Domain Model (Key Concepts)

### Word Entity
- **Global word**: Mastery is per-word, not per-deck
- If a word already mastered when encountered in new deck → goes to revision deck (no active slot)
- Word entity has: `id`, `text`, `language`, `masteryCount`, `phase`, `lapseCount`, `srsState`

### Learning Phases

**Phase 1: Learning (Active Window)**
- Curated words: 10 correct to master
- Foundational words: 5 correct to master
- Wrong: mastery−1, word reappears in session

**Phase 2: Review (ANKI)**
- Graduated words follow intervals: 1d → 3d → 7d → ...
- Lapse rule: 3 ANKI failures → reset to Phase 1 with mastery count 0

### Active Window (8-word limit)
- Max 8 unmastered curated words at any time
- 4 new words enter per batch when slots freed
- Carry-over: unmastered words from prior batch get highest priority
- Stuck words: no progress after 3 batches → shelved 1 day (counts toward 8-word limit, max 2 shelved)

### Foundational Deck
- 3 words active at a time, mixed into curated batches (20% of 15 questions = 3 questions)
- Cannot skip; same 3 persist until all mastered
- Post-depletion: 20% → 5% allocation; native writing unlocked

### Batch Composition (15 questions per batch)
- Question type split: 70% multiple choice, 20% word block, 10% audio recognition
- Type shifts post-foundational-depletion (native writing word blocks added)
- Audio questions only served when word audio status = `available`

---

## SRS (ANKI) Algorithm

```
Correct answer  → mastery++ (cap at MASTERY_THRESHOLD)
Wrong answer    → mastery-- (floor at 0), word reshown in session

Mastery reached → Phase 2 (ANKI)
  ANKI correct  → extend interval (1d → 3d → 7d → ...)
  ANKI wrong    → lapseCount++
  3 lapses      → back to Phase 1, mastery reset to 0

Foundational words have lower MASTERY_THRESHOLD (5 vs 10)
```

---

## TTS Audio System

**Rate limits (Gemini free tier)**:
- 10 RPD (requests per day), 3 RPM (per minute)

**Quota allocation**:
- 5 RPD for content curation, 5 RPD for SRS active window (first-come-first-served)

**Generation strategy** (lazy):
- Audio generated when word enters 8-word active window (not on deck creation)
- Async: Worker queues request → Gemini API → R2 storage

**Audio status enum**: `available` | `pending` | `failed`

**Graceful degradation**:
- Quiz: audio unavailable → redistribute those question slots to MC/word block; no error shown
- Curation: audio unavailable → hide player, show "Audio generation in progress"

**Tier migration**: `RPD`/`RPM`/`TPM` via environment variables — no code changes to upgrade

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Learner** | Quiz, SRS learning, dashboard |
| **Curator** | Learner + create/edit/publish conversations |
| **Admin** | Curator + user management (CRUD, role assignment, deactivation) |

**Auth**: Google OAuth one-click (auto-creates learner) + credential-based (admin-managed accounts)
**Sessions**: JWT, 7-day expiry, via `nuxt-auth-utils`

---

## Content Lifecycle

```
Draft → Published → Unpublished
```

- **Draft**: Visible to creator/editors only
- **Published**: Available to all learners
- **Unpublished**: Hidden from learners; active words finish naturally; mastered words remain in global pool

**Editing rules**:
- Minor edits: propagate (existing learner state preserved)
- Destructive edits (word entity changes): create new word entities (existing mastery unaffected)

---

## Key Patterns

### Composables (not class inheritance)
```ts
// ✅ Composable pattern
const { activeWords, masteryCount, recordAnswer } = useWordMastery(wordId)
const { batchQuestions, submitBatch } = useQuizBatch(deckId)

// ❌ Avoid
class BaseQuizComponent extends QuizMixin { }
```

### Domain-specific naming
```ts
// ✅
const isWordMastered = mastery.count >= MASTERY_THRESHOLD
const hasActiveLearnedWords = activeWindow.length > 0
const lapseWord = (word: Word): Word => ({ ...word, lapseCount: word.lapseCount + 1 })

// ❌
const flag = x >= THRESHOLD
const check = arr.length > 0
const update = (w) => ({ ...w, lapseCount: w.lapseCount + 1 })
```

### Explicit types (no `any`)
```ts
// ✅
function recordAnswer(answer: QuizAnswer): MasteryUpdate { }

// ❌
function recordAnswer(answer: any): any { }
```

### Immutable state mutations
```ts
// ✅
const updatedWord: Word = { ...word, masteryCount: word.masteryCount + 1 }

// ❌
word.masteryCount++
```

---

## Out of Scope (V1)

- Grammar instruction
- Conversational AI / chatbot
- User-created custom decks
- Offline mode
- Multi-user social features (leaderboards, sharing)
- Self-service password reset / MFA
- Batch TTS generation
- Fallback TTS providers

---

## Open Questions

| Question | PRD |
|----------|-----|
| ~~iOS audio autoplay UX~~ — **Resolved**: Hybrid approach (session-level unlock + per-question tap fallback) | SRS Learning Path |
| Mid-quiz connection loss — discard batch acceptable? | SRS Learning Path |
| ANKI defaults vs. tuned parameters for mobile? | SRS Learning Path |
| Foundational deck content ownership per language? | Content Curation |
| D1 batch assembly < 100ms at scale? | SRS Learning Path |

