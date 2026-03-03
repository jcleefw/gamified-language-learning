# Product Brief: Gamified Language Learning Platform

> **Status**: Complete Brief
> **Last Updated**: 2026-03-02
> **Product Vision**: A mobile-first gamified vocabulary learning platform that helps language learners retain functional vocabulary through spaced repetition, contextual conversations, and zero grammar overhead.

---

## Executive Summary

This platform solves the vocabulary retention crisis in language learning. Traditional apps overwhelm learners with grammar or rely on rote memorization without context. We focus on **functional word-level communication** for travelers, hobbyists, and casual learners who need to speak and understand real conversations—not pass grammar exams.

**Core Innovation**: Every vocabulary word is learned within the context of a real conversation. Words are tested through gamified quiz mechanics powered by a proven spaced repetition algorithm (ANKI). Learners retain 80%+ of mastered words, engage daily, and see measurable progress without the cognitive burden of grammar instruction.

**Platform Delivery**: Progressive Web App (PWA) with mobile-first design, deployed on Cloudflare infrastructure (Workers, D1, R2). No app store dependency—distributed via URL with home screen install.

---

## Product Architecture

The platform consists of four major subsystems, each detailed in its own PRD:

```
┌─────────────────────────────────────────────────────────────┐
│                     User Management & Auth                  │
│              (Google OAuth + Credentials)                   │
│  PRD: 20260226T150000Z-user-management-auth.md             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   Content Curation       │    │   SRS Learning Path      │
│   (Admin/Curator Path)   │    │   (Learner Path)         │
│                          │    │                          │
│  - Conversation creation │    │  - Quiz batches          │
│  - Word breakdown        │    │  - Mastery tracking      │
│  - TTS generation        │    │  - ANKI review           │
│  - Publishing workflow   │    │  - Active word window    │
│                          │    │  - Foundational deck     │
│  PRD: 20260226T140000Z-  │    │  PRD: 20260226T100000Z-  │
│  content-curation.md     │    │  srs-learning-path.md    │
└──────────────────────────┘    └──────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Gemini TTS Audio System     │
              │   (Shared Infrastructure)     │
              │                               │
              │  - Rate-limited generation    │
              │  - Quota management (10 RPD)  │
              │  - Graceful degradation       │
              │  - R2 audio storage           │
              │                               │
              │  PRD: 20260302T000000Z-       │
              │  gemini-tts-generation.md     │
              └───────────────────────────────┘
```

---

## System Components

### 1. User Management & Authentication
**PRD**: [20260226T150000Z-user-management-auth.md](prds/20260226T150000Z-user-management-auth.md)

**Purpose**: Secure access control with three user roles—admin, curator, learner.

**Key Features**:
- Google OAuth one-click sign-in (auto-creates learner accounts)
- Credential-based authentication for admin-managed accounts
- Role-based access: admin > curator > learner (hierarchical capabilities)
- JWT-based sessions (7-day expiry)
- Admin CRUD for all users (create, deactivate, role assignment)

**User Roles**:
- **Learner**: Accesses quiz/SRS learning path only
- **Curator**: Learner capabilities + content creation tools
- **Admin**: Curator capabilities + user management

---

### 2. Content Curation (Admin/Curator Path)
**PRD**: [20260226T140000Z-content-curation.md](prds/20260226T140000Z-content-curation.md)

**Purpose**: Curator workflow to generate, review, and publish conversation-based vocabulary decks.

**Workflow**:
1. **Conversation Generation**: AI-generated dialogue (1–6 lines) from a freeform topic, configurable by difficulty/formality
2. **Word Breakdown**: AI extracts per-line word-by-word translations with parts of speech
3. **TTS Audio**: Optional multi-speaker audio generation (full conversation + per-word)
4. **Publishing**: Draft → Published → Unpublished lifecycle (no approval gate)

**Key Features**:
- Language-specific nuance detection (e.g., Thai gender particles)
- System prompt management (generic + language-specific layers)
- Foundational deck curation (consonants/vowels/tones—fixed word sets, not AI-generated)
- Curator collaboration toggle (allow others to edit)
- Non-destructive editing after publishing (minor edits propagate, destructive changes create new word entities)

**Content Lifecycle**:
- **Draft**: Visible only to creator/editors
- **Published**: Available to all learners
- **Unpublished**: Hidden from learners; active words finish naturally, mastered words remain in global pool

**Success Target**: < 15 minutes to create a publish-ready deck (conversation + breakdown + audio)

---

### 3. SRS Learning Path (Learner Path)
**PRD**: [20260226T100000Z-srs-learning-path.md](prds/20260226T100000Z-srs-learning-path.md)

**Purpose**: Gamified quiz system with spaced repetition (ANKI algorithm) to maximize vocabulary retention.

**Core Mechanics**:

#### Quiz Structure
- **Batch size**: 15 questions per session (configurable)
- **Question types**: Multiple choice (70%), word block selection (20%), audio recognition (10%)
- **Type distribution shifts** post-foundational-depletion to include native writing word blocks

#### Active Word Management
- **8-word active window**: Maximum unmastered words at any time (configurable)
- **4 new words per batch**: Sliding window—new words enter when old ones reach mastery
- **Carry-over priority**: Unmastered words from prior batches get top priority

#### Two-Phase Mastery Model

**Phase 1: Learning** (in active window)
- Curated words: 10 correct answers to mastery (configurable, +1/-1 per answer)
- Foundational words: 5 correct answers to mastery
- Wrong answers: Correct answer shown, word reappears in same session, mastery -1 (min 0)

**Phase 2: Review** (ANKI)
- Graduated words follow ANKI intervals (1d → 3d → 7d → etc.)
- Lapse rule: 3 ANKI failures → returns to Phase 1 with reset mastery count

#### Foundational Deck
- **3 foundational words active** at a time, mixed into curated batches (20% of questions = 3/15)
- Cannot skip ahead; same 3 persist until all mastered
- Post-depletion: 20% → 5% allocation, native writing unlocked
- Continuous wrong rule: 3 wrong in a row → reset to 0, top priority next batch

#### Stuck Words
- No progress after 3 batches → shelved for 1 day (max 2 shelved words at once)
- Shelved words count toward 8-active limit

#### Word Entity Model
- **Global word entity**: Mastery and SRS state are per-word, not per-deck
- If a word is already mastered when encountered in a new deck → slots into revision deck (no active slot consumed)

**Deck Types**:
- **Curated deck**: Active learning from a conversation (can skip ahead)
- **Revision deck**: Mastered words from a conversation, ANKI-scheduled
- **Word pool deck**: All learned words across all conversations (user-initiated review)
- **Foundational deck**: Consonants/vowels/tones (cannot skip, separate mastery tracking)

**Success Metrics**:
- ≥ 80% retention on first ANKI review
- ≥ 2 batches per session (average)
- < 15% deck abandonment before 50% mastery

---

### 4. Gemini TTS Audio Generation System
**PRD**: [20260302T000000Z-gemini-tts-generation.md](prds/20260302T000000Z-gemini-tts-generation.md)

**Purpose**: Centralized rate-limited TTS audio generation shared between content curation and SRS quiz.

**Strategy**: Free Tier + Hard Limit + Lazy Per-Word Generation
- **Free tier limits**: 10 requests per day (RPD), 3 requests per minute (RPM)
- **Quota allocation**: Shared pool—5 RPD for content curation + 5 RPD for SRS active words (first-come-first-served)
- **Lazy generation**: Audio generated only when a word enters the 8-active learning window
- **Graceful degradation**: When quota exhausted, audio status = `pending`, quiz redistributes question types, no user-facing error

**Audio Scopes**:
- Full conversation audio (content curation)
- Per-word audio (SRS quiz—active window only)
- _(Per-sentence audio deferred pending cost review)_

**Technical Design**:
- Centralized `TTSService` with pre-flight quota check
- D1 quota counter table (`tts_quota`) with UTC daily reset
- Cloudflare Queue for async generation (Worker → Gemini API → R2 storage)
- Audio status tracking: `available`, `pending`, `failed`

**Graceful Degradation**:
- **Quiz**: If word audio unavailable → redistribute audio question slots to MC/word block (no error shown)
- **Curation**: If conversation audio unavailable → hide player, show "Audio generation in progress"

**Tier Migration Path**: Environment variables for RPM/TPM/RPD—no code changes to upgrade from free to paid tier

---

## Platform & Technology Stack

### Frontend
- **Framework**: Vue 3 + Nuxt
- **Styling**: PandaCSS
- **Components**: Ark UI (headless, atomic design structure)
- **Platform**: Progressive Web App (PWA) with `display: standalone`
- **Mobile-first**: Portrait mobile viewports optimized, desktop supported but secondary
- **Distribution**: URL + home screen install prompt (no app store)

**Capacitor Upgrade Path**: If native APIs needed (haptics, iOS audio edge cases), wrap Vue app without rewrite

### Backend
- **Platform**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (audio files)
- **Queues**: Cloudflare Queues (async TTS generation)
- **Authentication**: `nuxt-auth-utils` (Google OAuth + credentials, JWT sessions)

### AI Services
- **Conversation generation**: Gemini API
- **Word breakdown**: Gemini API
- **TTS audio**: Gemini TTS (rate-limited, quota-managed)

### Deployment
- **Infra ADR**: [20260301T161844Z-infra-cloudflare-platform.md](architecture/20260301T161844Z-infra-cloudflare-platform.md)
- **Always-online**: No offline mode in v1 (PWA is online-only)
- **Mid-quiz connection loss**: Answers stored in memory, synced on reconnect (discarded if app closed)

---

## User Personas & Journeys

### Primary User: Learner
**Profile**: Tourist, hobbyist, or serious student learning a language. Reads English or Romanic script. Engages in short sessions (5–15 minutes), often mobile.

**Journey**:
1. Sign in via Google OAuth (one click, auto-creates learner account)
2. View dashboard with ongoing decks and progress stats
3. Select a curated deck (e.g., "Ordering Coffee")
4. Play conversation audio (optional) before starting quiz
5. Complete quiz batch (15 questions, mix of MC/word block/audio)
6. Words progress through learning → mastery → ANKI review
7. Return daily/near-daily for spaced repetition effectiveness

### Secondary User: Curator
**Profile**: Language expert creating content. Works on desktop in 15–60 minute sessions. Curates one or more decks per session.

**Journey**:
1. Sign in (Google OAuth or credentials)
2. Create conversation: provide topic, configure difficulty/formality
3. Review/edit AI-generated conversation lines
4. Trigger word breakdown generation
5. Review/edit word-by-word translations
6. Generate TTS audio (optional)
7. Publish deck → immediately available to learners

### Tertiary User: Admin
**Profile**: Super user managing the platform. All curator capabilities + user management.

**Admin-Specific Actions**:
- Create credential-based accounts with temporary passwords
- Assign/change user roles
- Deactivate users (with content handling prompt if curator has published decks)
- View user activity summaries (learning progress, curation activity)

---

## Key Differentiators

1. **Context-First Learning**: Every word learned within a real conversation, not isolated flashcards
2. **Zero Grammar Overhead**: Functional vocabulary only—no conjugation tables, no syntax drills
3. **Proven SRS Science**: ANKI algorithm adapted for mobile sessions—80%+ retention validated
4. **Active Window Design**: 8-word concurrent limit prevents overwhelm, forces focused practice
5. **Global Word Mastery**: Learn once, retain everywhere—word mastery persists across decks
6. **Foundational Integration**: Language-specific fundamentals (consonants/vowels/tones) seamlessly mixed into conversational learning
7. **Graceful Degradation**: App remains fully functional even when TTS quota exhausted
8. **No App Store Dependency**: PWA distribution—install to home screen, feels native, updates instantly

---

## Success Metrics (Cross-System)

### Learning Effectiveness
- Mastered words correct on first ANKI review: **≥ 80%**
- Foundational deck completion rate (10+ session users): **> 70%**

### Engagement
- Average batches per session: **≥ 2**
- Deck abandonment before 50% mastery: **< 15%**

### Curation Health
- Time to publish-ready deck: **< 15 minutes**
- Published conversations with complete breakdowns: **100%**

### System Health
- TTS quota rejection rate: **< 5%**
- ANKI fallback rate (3-lapse words): **< 5% of mastered words**

**Review Gates**:
- **Gate 1**: Solo user × 7 days (gut-check all metrics)
- **Gate 2**: 200 active users × 30 days (statistical validation)
- **Gate 3**: Quarterly thereafter

---

## Out of Scope for V1

- Grammar instruction or sentence construction
- Conversational AI / chatbot practice
- User-created custom decks (deferred to later phase)
- Onboarding flow / placement tests
- Multi-user social features (leaderboards, sharing)
- Offline mode (PWA is always-online)
- Self-service password reset
- Multi-factor authentication
- Batch TTS generation
- Cross-user audio sharing (optimization deferred)
- Fallback TTS providers

---

## Dependencies & ADRs

| Document | Purpose | Status |
|---|---|---|
| [User Management PRD](prds/20260226T150000Z-user-management-auth.md) | Auth & roles | Complete |
| [Content Curation PRD](prds/20260226T140000Z-content-curation.md) | Curator workflow | Complete |
| [SRS Learning Path PRD](prds/20260226T100000Z-srs-learning-path.md) | Quiz & mastery engine | Complete |
| [Gemini TTS PRD](prds/20260302T000000Z-gemini-tts-generation.md) | Audio generation system | Complete |
| [PWA Platform ADR](architecture/20260227T000000Z-fe-pwa-platform-strategy.md) | PWA delivery strategy | Accepted |
| [FE Framework ADR](architecture/20260226T133833Z-fe-framework-toolchain.md) | Vue 3 + Nuxt + PandaCSS | Accepted |
| [Engineering ADR](architecture/20260227T022513Z-engineering-monorepo-tooling.md) | Monorepo tooling | Accepted |
| [Infra ADR](architecture/20260301T161844Z-infra-cloudflare-platform.md) | Cloudflare platform | Accepted |

---

## Open Questions (Cross-Cutting)

| Question | Owner | Target | PRD Reference |
|---|---|---|---|
| ~~iOS audio autoplay UX—does tap-to-play feel natural?~~ | ~~Dev~~ | ~~First quiz prototype~~ — **Resolved**: Hybrid approach (session-level unlock + autoplay attempt + tap fallback). See PWA ADR. | SRS Learning Path |
| Mid-quiz connection loss—is discarding in-progress batch acceptable? | Product | Gate 1 review | SRS Learning Path |
| ANKI parameters—use defaults or tune for mobile sessions? | Product | Gate 1 review | SRS Learning Path |
| Foundational deck content creation—who owns per-language decks? | Curator/Product | Before language launch | Content Curation |
| D1 batch assembly performance—< 100ms achievable at scale? | Dev | Before Gate 2 | SRS Learning Path |
| TTS quota exhaustion timing—acceptable to hit limit before end of day? | Product | Post-launch monitoring | Gemini TTS |

---

## Next Steps

### Phase 1: Foundation (Weeks 1–2)
- User management & auth (Google OAuth + credentials)
- D1 schema for users, roles, sessions
- Basic admin UI for user CRUD

### Phase 2: Content Curation (Weeks 3–4)
- Curator UI (conversation generation, breakdown, editing)
- Gemini API integration (conversation + breakdown generation)
- Publishing workflow (draft → published → unpublished)
- TTS infrastructure (rate limiter, quota counter, R2 storage)

### Phase 3: SRS Learning Path (Weeks 5–7)
- Quiz batch assembly engine (active window, batch composition priority)
- Mastery tracking (Phase 1 learning, Phase 2 ANKI)
- Foundational deck integration (3-word active set, 20% allocation)
- Stuck word shelving logic
- Learner dashboard and quiz UI

### Phase 4: Integration & Testing (Week 8)
- End-to-end flows (curator creates deck → learner completes quiz → words mastered)
- TTS lazy generation on active window entry
- Audio question type redistribution
- Gate 1 solo user testing (7 days)

### Phase 5: Observability & Launch Prep (Week 9)
- Metrics instrumentation (learning effectiveness, engagement, curation speed)
- Logging and monitoring (TTS quota, ANKI fallback rate, stuck words)
- PWA manifest and install prompt
- Documentation and runbook

---

**For detailed technical requirements, data models, and acceptance criteria, refer to the individual PRDs linked above.**

---

*Last Updated: 2026-03-02*
