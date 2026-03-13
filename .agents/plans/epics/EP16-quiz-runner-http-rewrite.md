# EP16 - Quiz Runner: HTTP-Based Interactive Quiz

**Created**: 20260313T000000Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP15
**Parallel with**: N/A
**Predecessor**: EP08 (terminal quiz runner — engine-direct version being replaced)

---

## Problem Statement

`scripts/quiz-runner.ts` (delivered in EP08) calls `SrsEngine` directly and bypasses the HTTP API entirely. It reveals the answer in the question text and asks "did you get it right?" — it is a self-assessment tool, not a real quiz. It cannot validate the API contract, and with EP15's `selectedKey` authority model in place, it is structurally incompatible with the new server contract.

The script must be rewritten to exercise the real API: seed the server, fetch a batch with choices, collect a keypress per question, submit `selectedKey` values, and display per-word results.

## Scope

**In scope**:

- Full rewrite of `scripts/quiz-runner.ts` as an HTTP API client:
  1. `POST /api/srs/seed` → capture `deckId` from JSON response
  2. `POST /api/srs/batch` with `{ deckId }` → receive questions with `choices`
  3. Display one question at a time with `a/b/c/d` choices
  4. Collect `selectedKey` from stdin keypress (`a`, `b`, `c`, or `d`)
  5. `POST /api/srs/answers` with all collected `{ wordId, selectedKey }` pairs
  6. Display per-word results: submitted key, correct key (`✓` / `✗`), mastery delta
- Question display format matching ADR spec (batch/question counter, choices, prompt)
- Results display format matching ADR spec (word, result symbol, mastery delta)
- Script exits cleanly after results are printed

**Out of scope**:

- Batch looping / multi-batch sessions — single batch per run
- `word_block` and `audio` question types — display "not yet implemented" and skip keypress
- Persistent state between runs — in-memory server state only
- Unit tests for the script — manual end-to-end verification is sufficient

---

## Stories

### EP16-ST01: Rewrite `scripts/quiz-runner.ts` as HTTP API client

**Scope**: Replace the existing `scripts/quiz-runner.ts` with a complete rewrite that: calls `POST /api/srs/seed` (using the seed file from `apps/server/src/state/seeds/`) and reads `deckId` from the JSON response; calls `POST /api/srs/batch` with the captured `deckId`; renders each question one at a time using the ADR display format (batch header, `targetText`, labelled `choices`, `→ Your answer (a/b/c/d):` prompt); collects a single keypress from stdin per question and records `{ wordId, selectedKey }`; after all questions answered, calls `POST /api/srs/answers` with the collected answers; prints per-word results using the ADR results format showing `✓`/`✗`, submitted key, correct key, and mastery delta. For `word_block` or `audio` question types, print `[not yet implemented — skipped]` and do not collect a keypress.

---

## Overall Acceptance Criteria

- [ ] `npx tsx scripts/quiz-runner.ts` (with server running) completes a full quiz loop without error
- [ ] Each question displays `targetText`, `a/b/c/d` choices, and a prompt — correct answer key is not revealed
- [ ] Pressing a key records the selection and advances to the next question
- [ ] Results screen shows `✓`/`✗` per word with submitted key, correct key, and mastery delta
- [ ] A deliberately wrong answer shows `✗`, displays the correct key, and shows mastery unchanged
- [ ] Script reads `deckId` from `/seed` JSON response — no console-log parsing
- [ ] `pnpm typecheck` green for the script

---

## Dependencies

- EP15 — Quiz contract + server authority (required: `choices` in batch response, `selectedKey` on answers, `deckId` from seed)

## Next Steps

1. Review and approve plan
2. Confirm server is running and EP15 Postman flow passes before starting
3. Implement ST01
4. Manual end-to-end verification: run the script and complete a full quiz
