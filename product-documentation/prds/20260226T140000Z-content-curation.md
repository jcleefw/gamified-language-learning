# PRD: Admin Path — Content Curation

> **Status**: Complete PRD
> **Last updated**: 2026-02-26
> **Scope**: Conversation curation workflow, foundational deck curation, TTS audio generation, system prompt management, content lifecycle, curator collaboration
> **Out of scope for this document**: User management & auth (separate PRD), learner-facing UI, SRS learning engine (see `PRD-srs-learning-path.md`), platform/UI framework/storage decisions

---

## 1. Problem Statement

Gamified language learning apps depend on high-quality, contextual vocabulary content. Without a structured curation workflow, content creation is ad-hoc, inconsistent across languages, and unscalable. Curators need tools to generate AI-assisted conversations, extract word breakdowns, produce TTS audio, and manage content lifecycle — all without touching code.

Currently no curation tool exists for this product. Without one, no content reaches learners.

---

## 2. Goals

1. **Curation speed**: A curator can produce a publish-ready conversation deck (conversation + breakdown + audio) in under 15 minutes.
2. **Language coverage**: The workflow supports any language without code changes — only language-specific system prompts and nuance detection modules are needed.
3. **Content quality**: Every published conversation has curator-reviewed breakdowns (no unreviewed AI output reaches learners).
4. **Curator autonomy**: Curators can create, edit, publish, and unpublish content without admin approval.

---

## 3. Non-Goals

- Learner-facing quiz UI or SRS mechanics (covered in `PRD-srs-learning-path.md`)
- User management, authentication, or role assignment (separate PRD)
- Automated content quality scoring or AI-based verification
- User-generated content (learners creating their own decks)
- Offline curation workflow
- Real-time collaborative editing (e.g., Google Docs-style concurrent editing)

---

## 4. Users & Context

**Primary user**: **Curator** — a language-knowledgeable content creator who uses a web-based admin interface to generate, review, and publish vocabulary content. They work on desktop in sessions of 15–60 minutes, curating one or more conversation decks per session.

**Secondary user**: **Admin** — a super user who manages users and roles. Admins can also curate content if they choose to — they have full curator capabilities in addition to admin-specific functions. Admin-specific capabilities (user management, role assignment) are deferred to a separate PRD.

**Usage context**: Web-only interface. Curators may work across multiple languages. They rely on AI generation but always manually review and edit output before publishing.

---

## 5. Requirements

### 5.1 Multi-Step Conversation Generation

1. Curator provides a **freeform topic** as the seed for a conversation.
2. Curator configures generation parameters:
   - **Line count**: 1, 2, 4, or 6 conversation lines
   - **Difficulty**: beginner, intermediate, or advanced
   - **Register/formality**: formal, informal, or mixed
3. Curator selects a **target language**. Each conversation belongs to exactly one language.
4. **Step 1 — Conversation generation**: AI (Gemini API) generates conversation lines, each containing: speaker label, target language text, and English translation.
5. Curator can **edit, add, or remove** generated conversation lines before proceeding.
6. Curator can **save as draft** after Step 1 (with empty breakdown).
7. **Step 2 — Word breakdown generation**: Curator triggers breakdown generation on a reviewed conversation. AI generates per-line word-by-word breakdowns. Each word component contains: target language text, English meaning, and part of speech (noun, verb, adjective, etc.).
8. **Unique words** are derived from all line breakdowns. If the same word appears in multiple lines, it is stored as a single word entity in the database — no duplicate word records are created. The word is linked back to each line it appears in.
9. Curator can **edit breakdowns** — add, remove, or modify word components.
10. Saving after Step 2 updates the existing conversation record.

### 5.2 TTS Audio Generation

11. **Step 3 — Audio generation** is optional and can be performed after Step 2.
12. Three audio scopes are targeted: **full conversation, per sentence, per word**.
13. **Multi-speaker support** with distinct voices per speaker in the conversation.
14. **Per-speaker gender selection** (male/female) — required for gendered languages.
15. **Style prompt** for tone, pace, and accent — configurable default with per-generation UI override.
16. Audio is **stored separately**, linked to the conversation by ID.
17. Audio management actions: **generate, play, download, delete, regenerate**.
18. **Provider abstraction layer** — TTS provider is swappable via configuration (starting with Gemini TTS).
19. Word-level and sentence-level TTS are **contingent on cost review** before committing to MVP scope. [Assumed: full-conversation TTS is MVP, per-sentence and per-word TTS may be deferred based on cost analysis]

### 5.3 Language-Specific Nuance Detection

20. System **auto-detects language-specific attributes** from conversation content (e.g., Thai speaker gender from gendered particles).
21. Detection runs **after generation or load**, auto-populating relevant UI fields (e.g., TTS gender dropdowns).
22. Curator can **always override** auto-detected values manually.
23. Each language has its own **nuance detection module** — extensible per language.

### 5.4 System Prompt Management

24. Two prompt types per generation step: **conversation prompt** and **breakdown prompt**.
25. Each prompt has two layers: **generic requirements** (same across all languages) + **language-specific prompts** (stored separately per language).
26. Prompts are **stored in the database** with defaults per language.
27. Curators can **customize prompts per generation** — edits do not overwrite the stored default.
28. Curators can **save custom prompts for reuse**.
29. Prompts are **resettable to defaults**.

### 5.5 Saved Curations Management

30. Curator can **browse all saved curated conversations**, sorted by creation date (newest first).
31. Each conversation exposes: topic, conversation preview, difficulty, and stage indicators (breakdown ✅/⬜, audio 🔊/⬜).
32. Curator can **load** a saved conversation for viewing or editing.
33. Curator can **delete** saved conversations (with confirmation).
34. **Unsaved changes guard** — system warns when navigating away with unsaved edits.

### 5.6 Conversation Duplication for Translation

35. Curator can **duplicate a conversation** to translate it to another language.
36. Duplication copies: **topic + summary** of what the conversation is about.
37. Conversation lines are **cleared** — never direct translation. Context is more important than literal translation because language sentence structures differ.
38. Curator then generates a new conversation in the target language using the copied topic/summary.

### 5.7 Content Lifecycle

39. Three content states: **Draft → Published → Unpublished**.
40. **Draft**: Saved but not published. Visible only to the creator and curators with edit permission.
41. **Published**: Available to learners. Requires an explicit **Publish button** (save ≠ publish).
42. **Unpublished (soft-removed)**: Deck disappears from the learner's topic list. Words already in the active 8-word learning window **finish their mastery cycle** naturally. Mastered words **remain in the global word pool** for revision.
43. **No admin approval step** is required before publishing. Curators can publish directly.

### 5.8 Content Editing After Publishing

44. **MVP (solo user)**: Edits to published content **propagate immediately**. Learner mastery progress is preserved. No versioning system.
45. **Multi-user (Gate 2+)**: Minor edits (English meaning, romanization, notes, audio) propagate immediately with mastery unaffected. **Destructive changes** (target language text itself) are treated as a **new word entity** — old word retains its progress, new word enters as unlearned. System **warns the curator** before applying destructive changes. Simple `editedAt` + `editHistory` fields for audit trail.

### 5.9 Curator Collaboration

46. Per-conversation toggle: **"Allow others to edit this conversation"**.
47. When enabled, **any curator** can edit the conversation.
48. When disabled, **only the creator** can edit.
49. Default: **disabled** (own content only).

### 5.10 Foundational Deck Curation

50. **Separate workflow** from conversational curation.
51. Curator uploads/provides a **JSON file** with all characters for a language.
52. Foundational decks are **fixed word sets** (not AI-generated).
53. Base structure shared with curated words: **id, character, name, romanization, language, type**.
54. Additional **language-specific metadata fields** vary by character type:
    - Consonants: class (middle/high/low), soundClass, IPA, pronunciation, associatedWords, notes
    - Vowels: vowelPosition (before/after/above/below/around), soundClass
    - Tones: soundClass
55. Each language **defines its own foundational character set** and metadata schema.

### 5.11 Curated Conversation Data Model

56. Each conversation record contains:
    - ID (UUID), topic, summary, language (language code)
    - Conversation lines (speaker + target language text + English translation)
    - Word breakdown per line (target language word + English meaning + part of speech)
    - Unique words (deduplicated from breakdowns)
    - Difficulty (beginner/intermediate/advanced)
    - Register (formal/informal/mixed)
    - Line count (1/2/4/6)
    - Status (draft/published/unpublished)
    - Allow others to edit (boolean, default false)
    - Creator ID
    - Timestamps: created, published (nullable), edited (nullable)

---

## 6. Success Metrics

All targets are starting points. To be validated after **Gate 1** (solo user × 7 days).

| Category | Metric | Target | Type |
|---|---|---|---|
| Curation Speed | Time to publish-ready deck (conversation + breakdown + audio) | < 15 minutes | Leading |
| Content Quality | Published conversations with complete breakdowns | 100% | Leading |
| Content Volume | Decks published per curator per week | ≥ 5 [Assumed] | Leading |
| Language Coverage | Languages with at least 10 published decks | ≥ 2 within 30 days of launch [Assumed] | Lagging |
| Content Health | Published decks subsequently unpublished | < 10% | Lagging |
| Collaboration | Conversations with collaboration enabled | Tracking only (no target) | Leading |

---

## 7. Open Questions

| # | Question | Owner | Target Date |
|---|---|---|---|
| 1 | TTS cost analysis — is word-level and sentence-level TTS viable for MVP? | User | DONE |
| 2 | TTS audio consistency — how consistent are separately generated audio segments (full conversation vs. per-sentence vs. per-word)? | User | TBD (implementation spike) | DONE
| 3 | Foundational deck JSON schema — what is the formal schema for languages beyond Thai? | User | TBD (per-language) |

---

*This PRD covers the admin/curator content curation workflow. For learner-facing quiz and SRS mechanics, see `PRD-srs-learning-path.md`. User management & auth will be covered in a separate PRD.*
