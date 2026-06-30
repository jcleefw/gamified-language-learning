# Sound Forge — Design Brief

**Product:** Sound Forge (working title)
**Part of:** Soi — gamified Thai script learning for English speakers
**Target user:** Casual learners, travellers, hobbyists wanting functional Thai reading ability
**Platform:** Mobile (iOS/Android first)
**Status:** Concept ready for prototyping

---

## What this is

Sound Forge is a gamified Thai script recognition app built around a single core insight: Thai characters don't just represent sounds in isolation — they interact with vowel forms and tone marks to produce sounds through rules. Most apps teach recognition by rote. Sound Forge teaches it by letting learners *assemble* sounds from parts, so the rule becomes visible and memorable.

The name reflects the mechanic: you forge sounds the way a blacksmith forges metal — combining raw parts under heat until something solid emerges.

---

## The core mechanic

A learner is given a target sound (played as audio, or shown in romanisation). They select a **consonant**, a **vowel form**, and optionally a **tone mark** from their unlocked parts tray, drag them onto the forge anvil, and fire. The app plays back the resulting sound and confirms whether it matches the target.

```
consonant  +  vowel form  +  tone mark  =  sound
   ข       +      า       +  (no mark)  =  khaa (rising)
   ก       +      า       +  (no mark)  =  gaa  (mid)
   ก       +      า       +     ้       =  gâa  (falling)
```

The same vowel + different consonant class = different tone. This is the lesson the mechanic teaches without stating it explicitly.

**Reverse challenge** (unlocked after first correct forge): the recipe flips. The learner sees the Thai script and must identify the sound. Production and recognition alternate each session.

---

## Progression system

Four sequential phases, each unlocking the next:

| Phase | Name | What's learned | Unlock condition |
|---|---|---|---|
| 1 | Consonant forge | 9 core initial consonants, shape + initial sound only | Complete all 9 at 1 star |
| 2 | Vowel lab | 7 vowel forms, short vs long, positional placement | Complete phase 1 |
| 3 | Tone chamber | Consonant classes (low/mid/high) + tone marks, the 5 tones | Complete 8 of 12 vowel recipes |
| 4 | Word anvil | Full syllables, consonant clusters, final consonants, real vocabulary | Complete tone chamber grid |

Parts (consonants, vowels, tone marks) are unlocked gradually within each phase. Locked parts appear greyed out in the tray with a lock icon — visible but not yet usable. This gives learners a sense of what's coming without overwhelming them upfront.

---

## The recipe book

Every combination a learner forges is saved as a **recipe** — a persistent record in their collection. The recipe book is the Pokédex of the app: the thing you're building, protecting, and completing over time.

### Recipe states

| State | Description | Visual |
|---|---|---|
| Not yet forged | Consonant is unlocked but combination hasn't been attempted | Greyed tile with lock icon |
| Forged (1 star) | Correct after seeing the answer revealed | ★☆☆ |
| Forged (2 stars) | Correct after a hint | ★★☆ |
| Forged (3 stars) | Correct on first attempt | ★★★ |
| Cooling | Not reviewed in 2+ days | Orange dot indicator on tile |
| Cold | Not reviewed in 4+ days | Red bar, urgent re-fire needed |

### Recipe detail view

Each recipe contains:
- **Hero display** — large Thai script + romanisation + meaning
- **Play button** — audio playback of the sound
- **Anatomy panel** — each part broken down (consonant, vowel, tone mark), with consonant class tag (mid/low/high)
- **Tone rule** — plain-language explanation of why this combination produces this tone
- **Mastery bar** — star rating + visual history dots (green = correct, red = miss)
- **Re-forge action** — one tap to queue this recipe into the next session

### Forge decay

Recipes cool over time. A 3-star recipe starts cooling after 3 days without review. A 1-star recipe cools after 1 day. Cold recipes (4+ days) are flagged urgently on the home screen. This drives short daily sessions without requiring streaks or artificial pressure.

---

## The tone chamber

The tone chamber is the mechanic for Phase 3 — where consonant class interacts with tone marks to produce the 5 Thai tones.

### The 5 tones

| Tone | Pitch shape | Description |
|---|---|---|
| Mid | flat, level | Neutral, no movement |
| Low | flat, low | Stays at the bottom of range |
| Falling | drops | Voice starts high and falls |
| High | elevated, slight rise | Tense, upper range |
| Rising | dips then climbs | Voice falls then rises |

### Tone rules (open syllable, long vowel)

| | No mark | mai ek ่ | mai tho ้ | mai tri ๊ | mai jattawa ๋ |
|---|---|---|---|---|---|
| Mid class (ก) | Mid | Low | Falling | High | Rising |
| Low class (น) | Mid | Falling | High | High | Rising |
| High class (ข) | Rising | Low | Falling | High | Rising |

### Chamber mechanic

1. Learner picks a consonant class representative (ก / น / ข)
2. Learner picks a tone mark (or no mark)
3. App fires the combination and shows:
   - Animated pitch curve (the visual shape of the tone)
   - Tone name and label
   - Example word using this combination
   - Insight card explaining the rule behind this result
4. Each fired combination fills in a **discovery grid** — a 3×5 table the learner completes over time

**Discovery mechanic:** the grid starts blank. Learners fill it by experimenting. The patterns (mai tri always = high, low-class reacts differently to mai ek) emerge through play rather than being stated upfront.

**Reverse challenge (post-grid):** App shows a target tone. Learner must find all class + mark combinations that produce it. Multiple valid answers exist — finding all of them earns bonus stars.

---

## Home screen

The home screen is the daily entry point. It answers one question immediately: *what should I do today?*

### Key components

**Session card (top, prominent)**
- Title: summarises today's session in one line ("3 recipes need re-firing")
- Three line items: cooling recipes / new combinations / tone chamber challenge
- Estimated time (~5 min)
- Single CTA: "Start session"

**Cooling recipes strip**
- Shows up to 3 cooling/cold recipes with temperature bars
- Tap to open recipe detail
- Cold recipes (red bar) shown first

**Phase progress strip**
- Four phase rows: completed (checkmark), in progress (partial bar + X/Y count), locked (lock icon)
- Informational only — no nudges or prompts

**Streak indicator (top right)**
- Day count + flame icon
- Low-key — visible but not the primary motivator

### Session flow

Sessions are assembled automatically from:
1. Cold and cooling recipes (re-forge priority)
2. New unlocked combinations (first forge)
3. Tone chamber challenges (if Phase 3 is active)

Session length is capped at ~7 items to keep it under 5 minutes. After a session, a summary screen shows: items fired, accuracy %, streak update, and one specific recipe that was upgraded (e.g. ★☆☆ → ★★☆ on ขา).

---

## UX principles

**1. The rule before the label**
Never state the rule upfront. Let the learner encounter the unexpected result first (e.g. "wait, same vowel but different tone?"), then surface the insight card that resolves it. Confusion before clarity is the learning hook.

**2. Anatomy over mnemonics**
Show the parts of every recipe — consonant class, vowel position, tone mark name. The goal is for learners to understand *why* a sound works, not just recognise it by shape.

**3. Pitch curves, not just tone names**
"Falling tone" is abstract. A curve that arcs downward is immediate. Always pair tone names with their pitch shape.

**4. Specific feedback, not generic praise**
Post-session: don't say "great job." Say "ขา went from ★☆☆ to ★★☆." Learners need to know what specifically got better.

**5. Forge decay as the daily hook**
Don't rely on streaks or push notifications. A cooling recipe book is intrinsically motivating — it's something the learner built that they don't want to let decay.

**6. Reverse challenge as the real test**
Forging (production) is the learning phase. Recognition (reverse) is the retention test. Both are required for a recipe to hit 3 stars.

---

## Data structure (per recipe)

```json
{
  "id": "kha-aa",
  "thai": "ขา",
  "romanisation": "khaa",
  "meaning": "leg / value / white",
  "audio_key": "khaa_rising",
  "parts": {
    "consonant": { "char": "ข", "sound": "kh", "class": "high" },
    "vowel": { "char": "า", "sound": "aa", "length": "long", "position": "trailing" },
    "tone_mark": null
  },
  "tone": "rising",
  "phase": 2,
  "mastery": {
    "stars": 1,
    "attempts": [
      { "date": "2026-06-25", "correct": false },
      { "date": "2026-06-26", "correct": true },
      { "date": "2026-06-27", "correct": false }
    ],
    "last_fired": "2026-06-27"
  }
}
```

---

## Package compatibility assessment

Assessment conducted 2026-06-29 against existing packages in `packages/`.

**Direct reuse (high confidence):**

| Sound Forge concept | Package | What maps |
|---|---|---|
| Parts: consonant/vowel/tone mark | `@gll/srs-engine-v2` | `ThaiConsonant` (with `class`), `ThaiVowel` (with `position`, `length`), `ThaiTone` — exact structural match |
| Mock consonant data | `@gll/srs-engine-v2` | `mockConsonants` already includes ก (middle), ข (high), ค (low) with class tags |
| Recipe mastery (stars) | `@gll/srs-engine-v2` | `WordState` — `mastery: 0–5`, `correctStreak`, `lapses`, `seen`, `correct` |
| Forge result → mastery update | `@gll/srs-engine-v2` | `updateRunState()` — pure, immutable, handles streak thresholds |
| Daily session curation | `@gll/srs-engine-v2` | `assembleBatch` / `initAdaptiveSession` — handles cooling-first priority |
| Forge decay scheduling | `@gll/srs-shelving` | Shelving policy for due items |
| Persistent storage | `@gll/db` | SQLite + Drizzle ORM, multi-user schema already in place |

**Must build fresh:**
- `ForgeQuestion` type (select parts → compose sound; engine has MCQ and sentence tiles, not composition)
- Audio playback
- Phase progression gating logic
- Tone chamber discovery grid state
- All UI (anvil, parts tray, recipe book, home screen)

**Conclusion:** Reuse packages. The SRS core (scheduling, mastery, storage) is already tested and models Thai foundational types exactly. The novel work is the forge mechanic UI and the ForgeQuestion type.

---

## Open questions for next phase

1. **Audio source** — recorded native speaker audio per syllable, or TTS? Native is more accurate for tones; TTS is cheaper to scale.
2. **Romanisation system** — RTGS (official) vs phonemic (more intuitive for English speakers)? RTGS has ข = kh but also ค = kh, which can confuse. Consider a hybrid with colour-coding by class.
3. **Consonant class labelling** — show class tag (mid/low/high) from day one, or introduce it only in Phase 3? Showing early sets up the Tone Chamber payoff; hiding it keeps Phase 1 simpler.
4. **Vowel position teaching** — vowels appear above, below, before, and after consonants. This spatial rule needs its own introductory moment before Phase 2 combinations begin.
5. **Connection to Soi topic packs** — recipes forged in Sound Forge should map directly to vocabulary in Soi phrase scenarios, so the forge becomes the training room and the phrase scenario becomes the field test.

---

## What's been designed (reference)

| Screen | Status |
|---|---|
| Home screen | Designed + interactive mockup |
| Session flow (question + feedback + summary) | Designed + interactive mockup |
| Recipe book (grid + detail view) | Designed + interactive mockup |
| Tone chamber (forge + discovery grid + patterns) | Designed + interactive mockup |
| Sound Forge core mechanic (anvil + parts tray) | Designed + interactive mockup |

All mockups built in conversation with Claude (claude.ai, June 2026). Ready for Figma translation or direct-to-code prototyping.
