# CODEMAP.md — `e2e/features/`

Gherkin feature specs, compiled by `playwright-bdd` (see `playwright.config.ts`)
against step definitions in `../steps/`.

---

## Files

| File | Scenarios |
|---|---|
| `api-error-handling.feature` | Error banner shown when server unreachable on load, and when clicking Resume (2 scenarios) |
| `sentence-question.feature` | Sentence (word-block) questions appear in batch when words are pre-seeded as seen — uses `minimal-sentence-ready` fixture (1 scenario) |
| `session-mastery.feature` | Mastering words across batches, session persistence/resume, mastered words excluded from active pool on re-entry (1 scenario) |
| `shelving.feature` | Word shelved after N stagnant batches; shelved word excluded from quiz (2 scenarios) |
| `word-question.feature` | MCQ prompt+4 choices; correct answer advances; wrong answer re-presented later in same batch, cheat-hint driven (3 scenarios) |
