# Deferred Features — What's Not (Yet) Implemented

This document clarifies which features from the product specification are **not yet implemented** in the SRS engine v2. Use this as a reference when reading the PRD or when planning future work.

---

## Deferred in Current Implementation

### 1. Stuck Word Shelving (PRD 5.9)

**PRD specifies**: Words that haven't progressed toward mastery after 3 batches are shelved for 1 day. Max 2 words shelved at any time; shelved words still consume an active slot.

**Current engine**: No stuck-word detection or shelving logic. Words remain active indefinitely.

**For sentence questions only** (different system): Sentences do shelve after 3 wrong or 3 correct answers, tracked in `SentenceRunState`. This is NOT the vocabulary shelving described in PRD 5.9.

**Planned**: EP?? (Future roadmap)

---

### 2. Batch Composition Priority (PRD 5.3)

**PRD specifies**: When building a 15-question batch, select words in this order:
1. Carry-over words (unmastered from prior batches) — highest priority
2. Foundational revision words (mastered foundational words due for review)
3. New words to learn (up to 4-per-batch / 8-active caps)
4. Foundational learning words (from the active 3)

**Current engine**: No priority ranking or carry-over tracking. `assembleBatch` builds questions from the active pool without explicit prioritization. Foundational and vocabulary items split proportionally by count, but no per-batch ordering rules.

**Planned**: EP?? (Future roadmap)

---

### 3. Continuous Wrong Rule (PRD 5.6, line 23)

**PRD specifies**: 3 consecutive wrong answers on a foundational word resets mastery to 0 and schedules that word for top priority in the next batch.

**Current engine**: `wrongStreak` does decrement mastery when `wrongStreak >= wrongStreakThreshold` (standard rule), but:
- No special reset-to-0 behavior beyond standard mastery decrement
- No "top priority for next batch" scheduling or tracking
- Rule applies globally (all words), not foundational-specific

**Planned**: EP?? (Future roadmap)

---

### 4. Question Type Distribution & Percentages (PRD 5.1)

**PRD specifies**:
- Pre-foundational-depletion: 70% MC, 20% word block, 10% audio
- Post-foundational-depletion: 60% MC, 20% word block, 15% audio, 5% foundational revision
- If audio unavailable, redistribute slots to other types

**Current engine**: Only two question types exist: **word multiple choice** and **sentence word-block**. No audio recognition questions, no percentage-based distribution logic. Composers are registered and called; batch composition is driven by demand, not by percentage targets.

**Planned**: EP?? (Future roadmap — blocked on audio pipeline)

---

### 5. Peek Button Mechanics (PRD 5.8)

**PRD specifies**: A "Peek" button shows the conversation context during a quiz, but the answer doesn't count toward mastery (no +1 or −1; treated as a skip).

**Current engine**: No peek concept. The engine has no idea whether an answer was peeked. This is a UI-layer concern (the quiz application decides whether to show the button and how to filter results before calling engine functions).

**Planned**: Application layer (UI concern, not engine)

---

### 6. ANKI/FSRS Review Phase (PRD 5.5)

**PRD specifies**: Words graduating to mastery enter an ANKI review system with time-based intervals (1d → 3d → 7d → etc.), ease factors, and lapse thresholds. If a word lapses 3 times, it re-enters learning with mastery reset to 0.

**Current engine**: No FSRS / ANKI integration. `ts-fsrs` is declared as a dependency but not used. Mastery is a simple 0–5 counter; no time-based scheduling.

**Planned**: EP21 (SRS Learning → Review Phase Integration)

---

## What IS Implemented

✅ **Sliding window** — new words enter active pool only when a slot opens  
✅ **Streak-driven mastery** — `correctStreak` and `wrongStreak` with configurable thresholds  
✅ **Within-batch retry** — wrong answers re-queue for the same batch  
✅ **Foundational items** — proportional slot allocation for consonants, vowels, tones  
✅ **Sentence questions** — word-block construction with independent shelving  
✅ **Global mastery model** — wordId-based, shared across decks  
✅ **Recheckpending / recheckReentered** — retry penalty suppression + retirement blocking  
✅ **Language config** — space-less script support (Thai, Japanese, etc.)  
✅ **Composer registry** — extensible batch assembly pattern  

---

## How to Use This Document

- **Implementing a deferred feature?** Check here first to understand what the current engine does vs. what the PRD promises.
- **Reading the PRD and confused?** This clarifies the gap between specification and implementation.
- **Planning the next epic?** Each deferred feature points to a potential story or epic.

See `01-stakeholder.md`, `02-concepts.md`, and `03-walkthrough.md` for what the current engine actually does.
