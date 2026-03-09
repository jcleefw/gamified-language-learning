# EP08 — Recent Decisions

## 2026-03-08: DS01 Review Decisions

1. **Language-agnostic types over Thai-specific** — `FoundationalCharacter` with `Record<string, unknown>` metadata instead of typed `ThaiCharacterMetadata`. Rationale: PRD §5.10 says each language defines its own metadata schema; don't lock to Thai in Stage 1.

2. **`slugifyWord` not `slugifyThai`** — function name is language-agnostic since it operates on `romanization` field which all languages have.

3. **5 consonants only** — ก ข ค ง จ (ko-kai, kho-khai, kho-khwai, ngo-ngu, cho-chan). Enough to prove foundational mechanics.

4. **Diacritic stripping for IDs only** — `slugifyWord` strips diacritics from romanization to produce ASCII-safe word IDs. Display romanization (with diacritics) stays intact in source data.

5. **Keep `thai` field name** — conversation sample JSON uses `thai` for target-language text. Keep as-is for Stage 1; rename to `text` when DB schema designed (Stage 2+).

6. **No EP11 needed** — EP08-ST01 absorbs real seed data work. No separate epic for content types.
