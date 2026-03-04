# Archived: Expected `src/` Directory Structure

**Status**: Archived (from CODEMAP.md — removed for token savings)
**Date**: 2026-03-05
**Purpose**: Reference for when implementation begins. Not a binding decision — structure may evolve.

---

```
src/
├── server/
│   ├── api/                    # API routes (Nitro / Cloudflare Workers)
│   │   ├── auth/               # Login, OAuth, session handlers
│   │   ├── conversations/      # Content curation API endpoints
│   │   ├── quiz/               # Quiz batch assembly, answer submission
│   │   ├── tts/                # TTS generation request handlers
│   │   └── users/              # User management (admin)
│   ├── db/
│   │   ├── schema.ts           # D1 table definitions ⚠️ sensitive
│   │   └── migrations/         # Schema migrations ⚠️ sensitive
│   └── services/
│       ├── ttsService.ts       # Rate-limited TTS generation
│       ├── srsService.ts       # ANKI algorithm, mastery tracking
│       ├── quizBatchService.ts # Batch composition, active window
│       └── geminiService.ts    # Gemini API client (conv + breakdown)
│
├── components/
│   ├── quiz/                   # QuizBatch, QuizQuestion, MultipleChoice, WordBlock
│   ├── curation/               # ConversationEditor, WordBreakdown, PublishControls
│   ├── auth/                   # LoginForm, OAuthButton
│   └── ui/                     # Shared UI (buttons, cards, inputs — from Ark UI)
│
├── composables/
│   ├── useQuizBatch.ts         # Quiz batch state + answer submission
│   ├── useWordMastery.ts       # Mastery tracking, phase transitions
│   ├── useActiveWindow.ts      # 8-word active window management
│   ├── useTTSAudio.ts          # Audio playback, status polling
│   └── useAuth.ts              # Session state, role checks
│
├── pages/
│   ├── index.vue               # Dashboard / deck list
│   ├── quiz/[deckId].vue       # Quiz session
│   ├── curation/               # Curator interface
│   └── admin/                  # Admin user management
│
└── assets/
    ├── tokens/                 # PandaCSS design tokens
    └── styles/                 # Global styles
```
