# Terminal Quiz Runner

Run with `pnpm quiz` (or `tsx scripts/quiz-runner.ts`).

An interactive terminal quiz that exercises the SRS HTTP API end-to-end. This is an **API validation tool** — it proves the full quiz contract works correctly (seed → batch → answers), not a user-facing product.

**Requires the server to be running**: `pnpm dev:server` in a separate terminal before running `pnpm quiz`.

---

## How it works

1. `POST /api/srs/seed` — seeds the server with Thai consonant data and reads `deckId` from the response.
2. `POST /api/srs/batch` — fetches a batch of questions with `a/b/c/d` choices. The correct key is **not** in the response — the server withholds it.
3. Presents one `multiple_choice` question at a time. Press `a`, `b`, `c`, or `d` to answer (no Enter needed). `word_block` and `audio` questions are skipped.
4. `POST /api/srs/answers` — submits all collected `selectedKey` values. The server determines correctness.
5. Prints per-word results: `✓`/`✗`, submitted key, correct key (on wrong answers), and mastery delta.

All state is in-memory on the server. Nothing is persisted between server restarts.

---

## Example session

```
Seeded 44 words (learning)

Batch 1 — 15 questions

─────────────────────────────────────────────

  Batch 1 — Q1 of 15
─────────────────────────────────────────────

  What sound does "ก" make?

  a) ข
  b) ค
  c) ง
  d) ก

  → Your answer (a/b/c/d): d

─────────────────────────────────────────────
  Results
─────────────────────────────────────────────

  ก (ko-kai)               ✓  mastery: 0 → 1
  ข (kho-khai)             ✗  you: a  correct: b   mastery: 0 → 0
  ค (kho-khwai)            ✓  mastery: 0 → 1
```

---

## Question types

| Type | Behaviour |
| --- | --- |
| `multiple_choice` | Displays `targetText`, four labelled choices, collects a keypress |
| `word_block` | Prints `[not yet implemented — skipped]` — no keypress collected |
| `audio` | Prints `[not yet implemented — skipped]` — no keypress collected |

---

## Controls

| Key | Action |
| --- | --- |
| `a` / `b` / `c` / `d` | Select answer and advance |
| Any other key | Reprompts — does not advance |
| `Ctrl+C` | Exit immediately |
