# Recent Decisions

**Branch**: feature/EP05-srs-active-window-stuck-words

| Date | Decision | Related |
|------|----------|---------|
| 20260306T130000Z | Active window marker = `srsM2_review` phase; avoids adding `isActive` flag to WordState | EP05-ST01 |
| 20260306T130000Z | Pre-add `batchesSinceLastProgress` and `shelvedUntil` to WordState in ST01 for ST02 consistency | EP05-ST01 |
| 20260306T130000Z | Newest stuck word shelved when 2-shelved cap hit; 3rd word simply waits | EP05 Design |
| 20260307T000000Z | Distributed CODEMAP into per-folder files; each non-`__tests__` folder owns its CODEMAP.md; root is index with pointers | Governance |
| 20260307T000000Z | `__tests__/` folders excluded from CODEMAP; integration test files self-document via file-level doc comments instead | Governance |

## Details

### Active window uses srsM2_review as marker
Words entering `srsM2_review` (i.e. past mastery threshold) are counted as "active". Natural entry point — no extra boolean flag on WordState. activeWordLimit caps how many words can be in this state simultaneously.

### Shelve cap decision
When 2 words are already shelved and a 3rd becomes stuck: the 3rd simply waits (is not shelved). The cap is hard at 2. Displacement of already-shelved words does not occur.
