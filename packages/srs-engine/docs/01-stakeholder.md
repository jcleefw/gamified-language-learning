# How the SRS Engine Works — Product View

> For: Product owners, stakeholders, non-technical readers  
> Depth: What it does and why, no code

---

## The whole journey

A word goes through three stages:

1. **Learn** — introduced, quizzed, tracked until it reaches mastery.
2. **Shelve** (as needed) — if a learner gets stuck, the word is temporarily pulled out of rotation instead of grinding them down.
3. **Review** — once mastered, the word moves to long-term spaced review, resurfacing at increasing intervals.

All three stages live in this engine. None of them touch a database, the network, or the screen — they're rules only. Whatever wraps around the engine (app, server) is responsible for saving progress and showing questions.

---

## The core idea

Think of the engine as a personal vocabulary trainer that learns how *you* learn.

When you start a deck, the engine doesn't dump all 50 words on you at once. It introduces a small group — say 2 or 3 — and keeps quizzing you on them until your performance shows you've actually absorbed them. Only then does it retire those words and bring in fresh ones. This is the **sliding window**: the practice group never grows too large, and new words only enter when a slot opens up.

---

## How it decides you've learned something

The engine doesn't just count right answers — it watches for *consistency*.

Answer a word correctly enough times in a row and your mastery level goes up. Miss it enough times in a row and it drops back down. (How many in a row is a configurable setting, not a fixed rule.) This streak-based model is more honest than simple counting: a word you got right a dozen times last week but fumble today is not a word you truly know.

Every word carries a mastery score that climbs and falls with your streaks. Cross the mastery threshold (also configurable) and the word graduates — it leaves the active practice group and a new word steps in from the queue. When every word in your deck has graduated, the session is complete.

---

## What happens when you get something wrong

A wrong answer doesn't just reduce your score — the question comes back to you again later in the same batch. But the engine is forgiving about the first re-try: a single unlucky mis-tap doesn't immediately tank your streak. The penalty only kicks in if you continue to struggle.

## When a learner gets stuck

If a word keeps getting missed for enough batches in a row (a configurable setting), repeating it endlessly doesn't help — it just frustrates the learner. Instead, the engine temporarily sets the word aside ("shelves" it) and keeps the practice session moving with other words. Only so many words can be shelved at once (also configurable) — shelving is a relief valve, not an escape hatch. Shelved words aren't gone — they come back into rotation later, and a new session always brings previously shelved words back in.

## Script fundamentals come first

Before vocabulary, the engine teaches the building blocks of the script — consonants, vowels, and tones. These **foundational items** are woven into every session alongside vocabulary words. They follow the same streak-and-mastery rules, but they're always tracked separately so a learner's progress on script basics never gets mixed up with their vocabulary progress.

## Two types of questions

**Word questions** (multiple choice) — you see a word and pick from a set of choices in different languages. These feed your word mastery score.

**Sentence questions** (word blocks) — you see a sentence and arrange shuffled word tiles in the correct order. These test production and grammar, not just recognition. Sentence performance is tracked separately — getting a sentence right doesn't directly boost your word mastery, and getting it wrong doesn't penalize you. They're a different skill being measured.

A sentence only becomes available after you've seen all its words at least twice. Once you nail a sentence 3 times in a row, it graduates and moves to long-term review.

---

## After mastery: long-term review

Graduating a word doesn't mean you're done with it — it means daily drilling is done. From here, the word switches to occasional check-ins, spaced further apart each time you recall it correctly, and pulled closer together if you forget. This is how long-term retention is built, without needing to re-drill a word you already know.

---

## What the engine is not

The engine covers the full word lifecycle — learning, shelving, and review — but it is pure logic. It has no database, no network, no UI. It takes in word states, applies the rules, and hands back updated states. Everything else — showing questions on screen, saving progress, picking a deck — is handled by whatever wraps around it. This keeps it clean, portable, and testable in complete isolation.

---

## The lifecycle at a glance

```
You start a deck
  → Engine introduces first small group of words
  → Quizzes you until each word crosses the mastery threshold
    (a word that keeps getting missed is shelved, then returns later)
  → Graduates mastered words, pulls in new ones
  → Continues until queue is empty and all words are mastered
  → Graduated words move into long-term review, resurfacing on a schedule
```
