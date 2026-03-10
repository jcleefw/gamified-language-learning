# PRD: SRS Learning Path — Gamified Vocabulary Learning

> **Status**: Complete PRD
> **Last updated**: 2026-03-02
> **Scope**: Quiz mechanics, mastery model, spaced repetition, deck system, word entity model, platform delivery, data persistence, audio playback, connectivity
> **Out of scope for this document**: Content pipeline details (see `20260226T140000Z-content-curation.md`), business model, design system tokens, UI wireframes

---

## 1. Problem Statement

Language learners struggle to retain vocabulary long-term. Existing apps either overwhelm users with grammar-heavy curricula or rely on rote memorization without context. Users who travel or casually learn a language need functional word-level communication — not grammatical perfection.

The cost of not solving this: learners forget 80%+ of vocabulary within weeks without spaced repetition. Traditional flashcard apps lack the gamified engagement loop needed to sustain daily practice, and most don't tie vocabulary back to conversational context.

---

## 2. Goals

1. **Retention**: Users retain 80%+ of mastered words when tested at the first ANKI review interval (1 day).
2. **Progression**: Average words mastered per session increases over a user's lifetime.
3. **Engagement**: Users complete an average of ≥ 2 batches (30 questions) per session.
4. **Completion**: < 15% of users abandon a deck before mastering 50% of its words.

---

## 3. Non-Goals

- Grammar instruction or sentence construction teaching
- Conversational AI / chatbot practice
- User-created decks (deferred to later phase)
- Onboarding flow or placement tests (possible future addition)
- Multi-user social features
- Offline mode — not supported in v1 (PWA is always-online per [PWA platform ADR](../architecture/20260227T000000Z-fe-pwa-platform-strategy.md))

---

## 4. Users & Context

**Primary user**: A language learner (tourist, hobbyist, or serious student) who reads English or a Romanic script. They open the app in short sessions (5–15 minutes), pick a conversation topic in their target language, and learn vocabulary through gamified quizzes.

**Secondary users**:

- **Curator**: Creates conversation topics, configures difficulty and formality, reviews AI-generated content.
- **Admin**: Manages users and roles.

**Usage context**: Mobile-first PWA sessions in `display: standalone` mode (installed to home screen). Users engage daily or near-daily for SRS to be effective. Desktop access is available but secondary.

---

## 5. Requirements

### 5.1 Quiz Batch Structure

1. Each quiz batch consists of **15 questions** (configurable).
2. Question types are distributed as follows (pre-foundational-depletion): **70% multiple choice, 20% word block selection, 10% audio recognition**. All percentages configurable.
3. Post-foundational-depletion distribution shifts to: **60% MC, 20% word block (including native writing), 15% audio, 5% foundational revision**. All percentages configurable.
4. Word block selection with native writing is **locked** until the user completes the entire foundational deck.
5. If audio is not available for a word, that question slot is redistributed to other types.

### 5.2 Active Word Management

6. A maximum of **8 words** may be active (unmastered) at any time across a deck (configurable).
7. A maximum of **4 new words** may be introduced in a single batch (configurable).
8. Words are introduced via a **sliding window**: a new word enters only when an existing word reaches mastery.
9. **Batch 1** of a new deck: 4 new words are presented, followed by 11 questions mixing those 4 words plus foundational words.
10. **Subsequent batches**: carry over unmastered words, introduce new words up to caps, include 20% foundational allocation.

### 5.3 Batch Composition Priority

11. When building a batch of 15 questions, words are selected in this priority order:
    1. Carry-over words (unmastered from prior batches)
    2. Foundational revision words (mastered foundational words due for ANKI review)
    3. New words to learn (up to the 4-per-batch / 8-active caps)
    4. Foundational learning words (from the active set of 3)

### 5.4 Mastery Model — Phase 1: Learning

12. Curated words reach mastery at **10 correct answers** (configurable). Each correct answer adds +1. Each mistake subtracts -1, with a minimum of 0 (no negative values).
13. Foundational words reach mastery at **5 correct answers** (configurable). Same +1/-1 mechanics.
14. During the learning phase, a word lives in the active 8-word window. No time-based intervals — the word appears within the same session/batch.
15. Each word is tested with a combination of native writing, romanized phonetic, English translation, and audio.

### 5.5 Mastery Model — Phase 2: Review (ANKI)

16. When a word hits its mastery threshold, it **graduates to the ANKI review system**. The mastery count system no longer applies.
17. ANKI controls scheduling: intervals grow on correct answers (1d → 3d → 7d → etc.), shrink on wrong answers. Per-word ease factor adjusts difficulty.
18. **Fallback rule**: If a word lapses **3 times** in ANKI review (configurable), it re-enters Phase 1 with mastery count reset to 0 and returns to the active word window.

### 5.6 Foundational Deck

19. **3 foundational words** are selected at a time and inserted into curated content batches as 20% of questions (= 3 questions in a 15-question batch).
20. The same 3 words persist across batches until all 3 reach mastery (of 5), then the next 3 are introduced.
21. The foundational deck is always available to all users. Users **cannot skip ahead** in the foundational deck.
22. Foundational mastery is tracked separately from curated content mastery.
23. **Continuous wrong rule**: 3 wrong answers in a row on a foundational word resets its mastery count to 0 and schedules it for top priority in the next batch (configurable).
24. After full foundational deck depletion: allocation shifts from 20% active learning to 5% spaced review. Native writing word blocks are unlocked.
25. **Foundational revision** occurs in two scenarios: (1) user deliberately chooses to revise all foundational words (15 questions per deck), (2) foundational revision words appear occasionally in conversational decks per ANKI scheduling.

### 5.7 Wrong Answer Handling

26. On a wrong answer, the **correct answer is shown**. No explanation is provided.
27. The user can refer to the source conversation as context (outside the quiz).
28. The word **reappears in the same session**.

### 5.8 Conversation Context & Peek

29. Users can view the full conversation and play its audio **before starting a quiz**.
30. The conversation is **not viewable during a quiz**.
31. A **"Peek" button** is available during the quiz. Using it shows the conversation, but that answer **does not count** toward mastery — no +1 or -1. Treated as a skip.

### 5.9 Stuck Words

32. If a word has not progressed toward mastery after **3 batches** of attempting it, it is **shelved for 1 day** (batch threshold configurable).
33. Shelved words **count toward the 8 active word slots**.
34. A maximum of **2 words** may be shelved at any time (configurable).
35. If the shelved quota is full, no further words can be shelved — the user must continue answering them even if repeatedly incorrect.
36. When a shelved word returns (after 1 day), it re-enters as a **carry-over word** (highest batch composition priority).

### 5.10 Word Entity Model

37. A word is a **single global entity** regardless of how many decks it appears in.
38. Deck association is stored as **metadata** — a list of which decks the word belongs to.
39. Mastery count and SRS intervals are **per-word, not per-deck**.
40. If a word is already mastered when encountered in a new deck, it slots into the **revision deck**, not the active learning window. It does not consume an active word slot.

### 5.11 Deck Types

41. **Curated deck**: Words from a conversation, active learning. Users can skip ahead to a different curated deck.
42. **Revision deck**: Mastered words from a specific conversation, scheduled for spaced review via ANKI.
43. **Word pool deck**: All learned words across all conversations, user-initiated review. No graduation — user can repeat as desired.
    - **Sandbox mode**: Word pool reviews do **not** affect ANKI scheduling — no interval updates, no ease factor changes, no lapse counting.
    - **Analytics tracking**: Every word pool attempt is recorded in quiz result history with source = `wordPool` (word ID, question type, correct/incorrect, timestamp).
    - **Soft signal**: If a word is answered wrong **3 times (all-time)** in word pool, its ANKI `next_review_at` is pulled forward to now. The wrong counter resets to 0 after firing. This does not modify lapse count, ease factor, or mastery — it only accelerates when the word next appears in a structured review.
    - **Question type distribution**: Same as curated batches (70% MC, 20% word block, 10% audio). Future consideration: challenge modes with different distributions.
    - **Batch composition**: 15 questions, words selected randomly from all mastered words. No minimum pool size — if fewer than 15 mastered words, words repeat within the batch.
44. **Custom deck**: User-created decks (implement last, out of scope for this PRD).
45. **Foundational deck**: Consonants, vowels, tones for specific languages (e.g., Chinese, Thai). Cannot skip ahead. Separate mastery tracking.

### 5.12 Content Ordering

46. Within a curated deck, words are ordered by: **curator-defined order** (if provided) → **difficulty** → **user-chosen**.

### 5.13 Session Flow

47. User sees a **dashboard** with stats, ongoing decks, and progress indicators.
48. User selects a deck and can either **play the conversation audio** or **start the quiz**.
49. Words graduate from a curated deck when **all words** in that deck are mastered.

### 5.14 Configurability

50. **All numeric game parameters** must be configurable, not hardcoded. This includes but is not limited to: batch size, question type percentages, mastery thresholds, active word limits, new word limits, shelved word quota, lapse thresholds, continuous wrong thresholds, and foundational allocation percentages.

---

## 6. Success Metrics

All targets are starting points. To be validated after **Gate 1** (solo user × 7 days).

| Category               | Metric                                                | Target                 | Type    |
| ---------------------- | ----------------------------------------------------- | ---------------------- | ------- |
| Learning Effectiveness | Mastered words correct on first ANKI review           | ≥ 80%                  | Leading |
| Learning Effectiveness | Average words mastered per session trend              | Increasing             | Lagging |
| Learning Effectiveness | Foundational deck completion rate (10+ session users) | > 70%                  | Lagging |
| Engagement             | Average batches per session                           | ≥ 2                    | Leading |
| Engagement             | Deck abandonment before 50% mastery                   | < 15%                  | Lagging |
| Engagement             | Shelved word quota hit rate                           | < 10% of batches       | Leading |
| System Health          | ANKI fallback rate (3-lapse words)                    | < 5% of mastered words | Lagging |
| System Health          | Stuck word shelving trigger rate                      | < 20% of sessions      | Leading |
| System Health          | Peek button usage rate                                | < 25% of questions     | Leading |

**Review gates**:

- **Gate 1**: Solo user × 7 days — gut-check all metrics, adjust obvious problems.
- **Gate 2**: 200 active users × 30 days — statistically meaningful validation.
- **Gate 3**: Quarterly thereafter.

---

## 7. Platform & Delivery

The learner path is delivered as a **Progressive Web App (PWA)** built with **Vue 3 + Nuxt**, styled with **PandaCSS**, using **Ark UI** headless components. Component structure follows atomic design (atoms → molecules → organisms).

1. **Mobile-first layout**: Quiz screens are designed for portrait mobile viewports. Desktop is supported but not optimized.
2. **Standalone mode**: The PWA manifest uses `display: standalone` to remove browser chrome. Quiz sessions feel native when installed to the home screen.
3. **No app store**: Distribution is via URL + home screen install prompt. No Xcode/Android Studio dependency.
4. **Capacitor upgrade path**: If native APIs (haptics, iOS audio edge cases) are required, Capacitor wraps the existing Vue app without rewrite. Trigger criteria: iOS audio failures or user haptic feedback complaints.
5. **iOS audio strategy (Hybrid)**: Quiz start screen requires a tap ("Start Quiz" / "Ready?") which creates an `AudioContext` and calls `.resume()`, unlocking audio for the session. Each audio recognition question attempts autoplay via `audio.play()` — if the promise rejects (iOS suspended the context), the play button shows in "tap to play" state. A visible play/replay button is always rendered on every audio question regardless of autoplay success. This degrades gracefully across all browsers.

---

## 8. Data Persistence

All SRS data is stored in **Cloudflare D1** (SQLite). Audio files are stored in **Cloudflare R2**. See [infra ADR](../architecture/20260301T161844Z-infra-cloudflare-platform.md) for platform details.

### 8.1 SRS Data Requirements

1. **Per-word mastery state**: Current mastery count, phase (learning or review), active/shelved status, shelved timestamp.
2. **ANKI review schedule**: Next review timestamp, interval, ease factor, lapse count — per word.
3. **Quiz result history**: Per-question records — word ID, question type, correct/incorrect, timestamp, peek used (boolean), source (`curated` | `revision` | `wordPool` | `foundational`).
4. **Deck progress**: Per-user per-deck state — active word IDs, mastered word count, current batch number.
5. **Foundational progress**: Per-user foundational deck state — current active 3 words, mastery per word, deck depletion flag.
6. **Stuck word tracking**: Per-word batch attempt counter, shelved status, shelve expiry timestamp.
7. **Word pool wrong counter**: Per-word integer, increments on word pool wrong answers, resets to 0 when soft signal fires (threshold: 3).

### 8.2 Data Retention

7. Quiz result history is retained indefinitely for analytics (success metrics in Section 6).
8. ANKI review schedules are updated in place — no historical schedule versioning.
9. Mastery count resets (from ANKI fallback or continuous wrong rule) overwrite the current value.

### 8.3 Query Performance

10. The ANKI review query (`SELECT words WHERE next_review_at < now()`) is the hottest query in the system. Must be indexed on `next_review_at`.
11. Batch composition (Section 5.3) requires querying active words, due-for-review words, and available new words in a single batch build. Target: < 100ms for batch assembly.

---

## 9. Audio Playback in Quizzes

Audio files are generated during content curation (see [content curation PRD](20260226T140000Z-content-curation.md)) and served from **Cloudflare R2**.

1. **Audio recognition questions**: Play a word or phrase audio clip. The user selects the correct written form from multiple choices.
2. **Conversation audio**: Full conversation audio is playable on the deck detail screen before starting a quiz. Not playable during the quiz (except via Peek, which voids the answer).
3. **Audio unavailability fallback**: If audio is not available for a word, audio recognition question slots are redistributed to other question types (already specified in 5.1, requirement 5).
4. **Latency expectation**: Audio clips should begin playback within 1 second of user tap. R2 serves directly via Cloudflare CDN — no Worker proxy needed for public audio.
5. **iOS gesture requirement**: First audio playback in a session requires a user gesture (tap). The quiz UI must handle this — e.g., a "Start Quiz" button that triggers audio context initialization.

---

## 10. Connectivity

The app is **always-online** in v1. No offline caching, no service worker data sync.

1. **Mid-quiz connection loss**: If the connection drops during a quiz, answers are stored locally in memory and synced when the connection resumes. If the user closes the app before reconnection, the in-progress batch is discarded — no partial batch persistence in v1.
2. **SRS timing integrity**: ANKI review timestamps are server-side (D1). Client clock manipulation does not affect scheduling.
3. **Future consideration**: If offline support is added later, the SRS state sync strategy (conflict resolution for mastery counts updated offline) will require a separate design.

---

## 11. Authentication & Access

Learners authenticate via **Google OAuth** or **email/password credentials** using `nuxt-auth-utils`. See [user management PRD](20260226T150000Z-user-management-auth.md) and [infra ADR](../architecture/20260301T161844Z-infra-cloudflare-platform.md).

1. **Learner role**: All SRS learning path features are available to users with the `learner` role. No feature gating within the learner experience in v1.
2. **Session persistence**: Quiz progress is tied to the authenticated session. Logging out mid-quiz discards in-progress batch state.
3. **New user default**: Google OAuth sign-in auto-creates users with `learner` role. They can immediately begin learning.

---

## 12. Dependencies

| Dependency                                                                  | Document                                                                            | Status   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Content curation pipeline (provides conversation decks and word breakdowns) | [Content Curation PRD](20260226T140000Z-content-curation.md)                        | Complete |
| User management & authentication                                            | [User Mgmt PRD](20260226T150000Z-user-management-auth.md)                           | Complete |
| Gemini TTS audio generation                                                 | [Gemini TTS PRD](20260302T000000Z-gemini-tts-generation.md)                         | Draft    |
| PWA platform strategy                                                       | [PWA ADR](../architecture/20260227T000000Z-fe-pwa-platform-strategy.md)             | Accepted |
| Frontend framework & toolchain                                              | [FE ADR](../architecture/20260226T133833Z-fe-framework-toolchain.md)                | Accepted |
| Monorepo & engineering tooling                                              | [Engineering ADR](../architecture/20260227T022513Z-engineering-monorepo-tooling.md) | Accepted |
| Infrastructure (D1, R2, Workers)                                            | [Infra ADR](../architecture/20260301T161844Z-infra-cloudflare-platform.md)          | Accepted |

---

## 13. Open Questions

| Question                                                                                                                                                                                                                                                                                                                              | Owner             | Target                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~iOS audio autoplay — does tap-to-play UX feel natural in quiz flow?~~                                                                                                                                                                                                                                                               | Dev               | ~~First quiz prototype~~ — **Resolved**: Hybrid approach (session-level `AudioContext` unlock + per-question autoplay attempt + visible tap-to-play fallback). See PWA ADR. |
| ~~Mid-quiz connection loss~~ — **Resolved**: Discard in-progress batch if app closed before reconnection. No localStorage persistence in v1. Revisit at Gate 2 with real usage data.                                                                                                                                                  | Product           | ~~Gate 1 review~~ Resolved                                                                                                                                                  |
| ~~ANKI algorithm parameters — use Anki defaults or tune for shorter mobile sessions?~~ — **Resolved**: FSRS defaults (desired retention 0.90) + 90-day max interval cap. Tuning knobs: raise retention to 0.92–0.95 if first-review accuracy < 80%; lower max interval if ANKI fallback rate > 5%. Both configurable via `SrsConfig`. | Product           | ~~Gate 1 review~~ Resolved                                                                                                                                                  |
| Foundational deck content — who creates the initial consonant/vowel/tone decks per language?                                                                                                                                                                                                                                          | Curator / Product | Before first language launch                                                                                                                                                |
| Batch assembly performance — is < 100ms achievable with D1 at scale?                                                                                                                                                                                                                                                                  | Dev               | Before Gate 2                                                                                                                                                               |
