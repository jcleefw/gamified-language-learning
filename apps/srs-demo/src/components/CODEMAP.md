# CODEMAP.md — `src/components/`

Presentational Vue 3 single-file components. Consumed by `src/views/`.

---

## Files

| File | Props / Emits | Purpose |
|---|---|---|
| `AudioPlayer.vue` | Props: `src`, `vttUrl?`, `showWaveform?`. Exposes the `SegmentPlayer` API | Wavesurfer-backed playback widget: waveform (togglable), transport controls, speed control. Thin view over `useSegmentPlayer` |
| `BatchResults.vue` | Exports `BatchSummary`. Props: `summary`, `batchScore`, `activeItems`, `queue`, `masteredDeck`, `masteredGlobal`, `maxMastery`, `nextDeckId`, `shelvedItems?`. Emits: `next`, `selectDeck`, `nextDeck` | Post-batch summary table (per-word seen/correct/mastery/streak), deck-complete banner with next-deck CTA, embeds `PoolDebugPanel` |
| `CurateAudio.vue` | Props: `decks`. Emits: `back`, `uploaded` | Curator UI: pick a deck + audio file, `uploadDeckAudio()`, success/error status |
| `CurationLanding.vue` | Emits: `curate`, `mark` | Landing page with two mode cards (Curate audio / Mark audio) |
| `DebugRecordingControls.vue` | Props: `activeNav`. Emits: `error` | Floating debug-only (`env.debugMode`) controls: Record/Stop-and-download toggle (`useDebugRecording`), "Dump last 100" button |
| `DeckOverview.vue` | Props: `deck`, `runState`, `shelvedSet`, `maxMastery`, `wordPool`. Emits: `back`, `startQuiz`, `unshelveWord`, `updateShelvedSet`, `updateWordStates` | Deck detail screen: transcript with clickable sentence/word chips (audio cue via embedded `AudioPlayer`), word table with mastery dots + unshelve action, inline sentence-by-sentence mini-quiz mode (embeds `QuizCard`, runs its own local assemble/answer/shelving pipeline). Largest/most complex component in the folder |
| `DeckSelector.vue` | Props: `decks`, `hasSavedSession`, `savedDeckId`, `savedDeckName`, `completedDeckIds`. Emits: `select`, `resume`, `clear`, `overview` | Deck list with word counts / "Complete" badges, resume-session banner |
| `HomeDashboard.vue` | Props: `reviewUnlocked`, `dueCount`, `badgeError`. Emits: `learn`, `review` | Home landing: Learn/Review mode cards, review badge/lock states |
| `MarkAudio.vue` | Props: `decks`. Emits: `back`, `committed` | Marker-authoring tool: deck picker, waveform + `wavesurfer.js/plugins/regions` drag-to-mark regions (synced with `useMarkerAuthoring`), keyboard nudge, preview/commit/download `.vtt`/reset |
| `NavMenu.vue` | Props: `active`, `reviewUnlocked`, `dueCount`, `badgeError`, `curationMode`. Emits: `home`, `learn`, `review`, `curation` | Top nav bar: Home/Learn/Review(badge)/Curation(conditional) tabs |
| `PoolDebugPanel.vue` | Props: `activeItems`, `queue`, `masteredDeck`, `masteredGlobal?`, `shelvedItems?`, `maxMastery?` | Dev/debug panel showing active/queue/shelved/mastered word pools; also renders a hidden block read by e2e tests |
| `QuizCard.vue` | Props: `question`, `index`, `total`, `activeItems`, `queue`, `masteredDeck`, `shelvedItems?`, `feedbackDwell?`, `audio?`. Emits: `answered`, `exit` | Core quiz-question renderer for both MCQ and word-block (sentence tile drag/drop) kinds; cheat-mode hints; embeds `AudioPlayer` + `PoolDebugPanel` (cheat mode). Shared by Learning (`QuizPage.vue`) and Review (`ReviewSessionPage.vue`); also embedded by `DeckOverview.vue`'s mini-quiz mode |
| `ReviewHub.vue` | Props: `reviewUnlocked`, `dueCount`, `badgeError`. Emits: `due`, `anytime` | Review entry hub: Due-Review card + Practice-Anytime card |
| `ReviewSummary.vue` | Props: `caughtUp`, `mode`, `reviewed`, `advanced`, `nextDue`. Emits: `home` | Post-review-session summary (or "caught up" empty state) |
