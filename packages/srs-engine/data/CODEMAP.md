# packages/srs-engine/data/

Content types, seed data mappers, and sample language data for the SRS engine.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | `FoundationalCharacter`, `ConversationWord`, `Conversation`, `ConversationLine` — content-layer types (not exported from `@gll/srs-engine`) |
| `mappers.ts` | `characterToWordState()`, `conversationWordsToWordStates()` — pure functions mapping content types → `WordState[]` |

## Directories

| Directory | Purpose |
|-----------|---------|
| `samples/` | Real seed data files (Thai consonants, conversation JSON) |
| `__tests__/` | Unit tests for mappers |
