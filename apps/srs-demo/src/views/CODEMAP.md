# CODEMAP.md — `src/views/`

Thin route-component wrappers: each `inject()`s state provided by `App.vue`
and forwards to the matching `components/` presentational component, wiring
emits to `router.push()`/composable methods. None hold logic beyond deep-link
boot handling.

---

## Files

| File | Purpose |
|---|---|
| `HomePage.vue` | Wraps `HomeDashboard`; injects `reviewSession`; `learn`→`select`, `review`→`review-hub` |
| `DeckSelectPage.vue` | Wraps `DeckSelector`; injects `appDecks` + `learningSession`; `overview`→`overview/:deckId` |
| `QuizPage.vue` | Wraps `QuizCard`; injects `learningSession` + `currentQuestionAudio` + `configReady`. Deep-link: if no batch active on mount, waits for `configReady` then calls `initSession(deckId, false)` for `route.params.deckId` |
| `ResultsPage.vue` | Wraps `BatchResults`; injects `learningSession` + `CONFIG`; `selectDeck`→`select` |
| `OverviewPage.vue` | Wraps `DeckOverview`; injects `appDecks`, `wordPool`, `CONFIG`, `learningSession`; resolves `deck` from `route.params.deckId`; `back`→`select` |
| `ReviewHubPage.vue` | Wraps `ReviewHub`; injects `reviewSession`; `due`/`anytime` call `onReview()`/`onAnytimeReview()` then push to `review` with `?mode=` |
| `ReviewSessionPage.vue` | Wraps `QuizCard` (feedback-dwell mode) or `ReviewSummary`; injects `reviewSession` + `reviewQuestionAudio` + `configReady`. Deep-link: if no batch active on mount, waits for `configReady` then starts due or anytime review per `?mode=` query |
| `CurationLandingPage.vue` | Wraps `CurationLanding`; `curate`/`mark` push to those routes |
| `CurateAudioPage.vue` | Wraps `CurateAudio`; injects `appDecks` + `refreshDecks`; `back`→`curation` |
| `MarkAudioPage.vue` | Wraps `MarkAudio`; injects `appDecks` + `refreshDecks`; `back`→`curation` |
