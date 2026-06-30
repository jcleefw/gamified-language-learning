# Current Focus — EP26 SRS Shelving Policy

**Branch**: `main`
**Last updated**: 20260626T130504Z

---

## Status

**EP26 — Impl-Complete** (ST01–ST05 done on main; ST06 BDD deferred to UI stage)

---

## Completed This Session

| Story | Summary |
| --- | --- |
| ST01 | Purged DS01 stagnation artifacts from `@gll/srs-shelving` — deleted `stagnation.ts`, `MasterySnapshot`, `MasteryHistory` |
| ST02 | Verified `assembleBatch` `excludeIds` filter — 204 engine tests green |
| ST03 | `user_deck_word_tracking` table + `updateStagnationCounters`/`getStagnantWords`/`resetStagnationCounters` |
| ST04 | Deck-scoped `user_shelved_words` (`deck_id` in PK) + all 4 shelving method signatures updated |
| ST05 | Host wiring: server routes, Vue composable, App.vue, CLI runner all DS02-aligned |

---

## Key Technical Notes

- `onWordAnswer` fires **before** `onGetStagnantIds` in `runAdaptiveLoop` — critical ordering for DB state to be current when counters update
- Integration tests require `maxShelved = words.length` when using `StagnationAutoAnswerStrategy` to ensure loop termination (words with `maxShelved < words.length` never all-shelve)
- CLI uses `DECK_ID = 'cli-deck'` as fixed scope (no deck selection in CLI demo)
- Counter starts at 1 on first batch boundary — reaches threshold N after N calls to `updateStagnationCounters`

---

## Next Steps

- ST06: BDD scenarios — deferred to UI stage per RULES.md
- Ready for commit + PR when confirmed complete
