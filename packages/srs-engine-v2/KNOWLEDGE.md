---
unit: packages/srs-engine-v2
sources:
  - EP20
updated: 2026-08-03
---

# SRS Engine v2 Knowledge

## batch-composition

A learning session pulls questions from two kinds of material at once — vocabulary words and foundational items (consonants, vowels, tones) — mixed into the same batch rather than run as separate modes. The engine guarantees every word gets fair coverage rather than being shuffled purely at random, so a learner won't see one word five times while another gets skipped. Within a single question, the wrong-answer choices are drawn from the same category as the right answer (a word question won't offer a consonant as a distractor), even though the batch as a whole blends categories.

## learning-session-lifecycle

A session is organized as a deck (all the words and foundational items available) worked through in batches (a fixed-size slice of that deck). Progress through a deck is adaptive rather than a fixed playlist: items move from a waiting queue, into an active in-progress set, and out to "mastered" once retired. Only a limited number of items are in the active set at any time, so a learner isn't juggling too many new things at once. The session keeps running batch after batch automatically until every item in the deck has been mastered and nothing is left waiting.

## mastery-tracking

Each word or item builds up a mastery level (on a 0–5 scale) that rises with correct answers in a row and falls with wrong answers in a row. Getting several right in a row doesn't just cap out at "mastered" — a longer streak keeps pushing the level up (or down, for a wrong streak), so consistent performance is rewarded with faster progress instead of a flat pass/fail. An item retires out of the active rotation once it reaches the mastery ceiling.

If a learner starts a new session with words that were already mastered in a previous one, those words aren't taken on faith — each gets one confirmation check at the start. Answering it correctly confirms the word stays retired; answering it wrong sends the word back into active practice without penalizing its prior mastery record, and normal streak rules apply from there on.

## foundational-content

All three Thai foundational categories — consonants, vowels, and tones — are supported as first-class content, not just consonants. Consonants and vowels are quizzed in all four standard directions (e.g., symbol-to-sound and sound-to-symbol both ways). Tones are deliberately quizzed in only two directions (tone mark to sound name and back), because testing a bare tone mark against other similar marks turned out to be visually confusing on its own — this is a narrower question style by design, not a gap. Standalone tone marks are also rendered with a placeholder base character so they display clearly instead of floating as an unreadable diacritic.
