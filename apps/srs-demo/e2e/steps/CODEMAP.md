# CODEMAP.md — `e2e/steps/`

Playwright-BDD step definitions, one file per `../features/*.feature`.

---

## Files

| File | Purpose |
|---|---|
| `api-error-handling.steps.ts` | Steps for `api-error-handling.feature`: route-abort simulation, seeding a saved session via direct POST |
| `sentence-question.steps.ts` | Steps for `sentence-question.feature`: configuring sentence-scheduling test overrides via `/api/test/config/sentence`, asserting word-block question presence |
| `session-mastery.steps.ts` | Steps for `session-mastery.feature`: `answerBatchCorrectly()` helper driving the quiz UI to completion via cheat-hint parsing; mastery/resume assertions |
| `shelving.steps.ts` | Steps for `shelving.feature`: `answerMCQIncorrectly()` helper, scenario loading via `loadScenario`, shelving-state assertions |
| `word-question.steps.ts` | Steps for `word-question.feature`: MCQ cheat-hint parsing (`parseMCQCheatHint`), prompt/answer assertions |
