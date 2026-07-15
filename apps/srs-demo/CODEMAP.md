# apps/srs-demo CODEMAP

Package: `@gll/srs-demo`
Purpose: Vue 3 web app demonstrating the SRS learning engine. Quiz flow, deck management, and audio playback for language learners.

## Files

| File | Purpose |
|---|---|
| `src/main.ts` | Vite entry point. Mounts App.vue to `#app`. |
| `src/App.vue` | Root component. Routing hub for decks, quizzes, audio curation, and markers. |
| `src/types.ts` | Local types (e.g., `QuizState`, `BatchResponse`). |
| `src/env.ts` | Environment variable validation and exports. |
| `package.json` | Package manifest for `@gll/srs-demo`. |
| `vite.config.ts` | Vite config for Vue 3 development and build. |
| `tsconfig.json` | TypeScript config extending `tsconfig.base.json`. |

## Composables (`src/composables/`)

State management and reusable logic as Vue 3 composition functions.

| File | Purpose |
|---|---|
| `useStore.ts` | Central store: decks, current deck, word state, session metadata. Communicates with `/api/decks` and `/api/srs/answers`. |
| `useLearningSession.ts` | Quiz state machine: fetch batch, advance through answers, track UI state. |
| `useReviewSession.ts` | Review flow state: fetch words by difficulty, track review progress. |
| `useShelving.ts` | Shelving UI: compute shelf boundaries (easy/okay/hard), display word distributions. |
| `useSegmentPlayer.ts` | Audio playback controller (wavesurfer.js backend). Play, pause, seek, segment playback, cue resolution from VTT. |
| `useAudio.ts` | Audio metadata state: track current audio file, VTT URL, deck audio availability. |
| `useMarkerAuthoring.ts` | Marker authoring state: build WebVTT cues, draft and save markers. |
| `useDebugRecording.ts` | Dev tool: record quiz/session state snapshots for debugging. |
| `useTestSentenceConfig.ts` | Dev tool: override deck settings for testing (playback speed, difficulty presets). |

## Components (`src/components/`)

Vue 3 single-file components (`.vue`).

| Component | Purpose |
|---|---|
| `HomeDashboard.vue` | Entry page: deck selector, session type (quiz/review), start button. |
| `DeckSelector.vue` | Dropdown or list to select active deck. Filters by topic/difficulty. |
| `DeckOverview.vue` | Deck stats: word count, shelving distribution, audio status. |
| `QuizCard.vue` | Single quiz card: word prompt (native + romanization), response input, feedback. |
| `BatchResults.vue` | Post-batch summary: correctness, shelving changes, next steps. |
| `ReviewHub.vue` | Hub for review sessions: select difficulty tier, word list. |
| `ReviewSummary.vue` | Summary after review: words reviewed, time spent. |
| `PoolDebugPanel.vue` | Dev tool: inspect word pool state, current batch. |
| `AudioPlayer.vue` | Playback UI: waveform, play/pause, seek bar, timing display. |
| `CurateAudio.vue` | Audio import & validation: upload/fetch audio, verify duration and format. |
| `MarkAudio.vue` | Marker authoring UI: scrub audio, author WebVTT cues, preview and save. |
| `NavMenu.vue` | Top navigation: tab selection (quiz/review/audio), help links. |

## Integration Points

| Target | Used By | Purpose |
|---|---|---|
| `@gll/srs-engine-v2` | `useLearningSession`, `useReviewSession` | SRS state machine: quiz batches, answer application, word state. |
| `@gll/srs-shelving` | `useShelving` | Compute shelving boundaries and stats. |
| `@gll/api-contract` | All composables | Type contracts for HTTP API and VTT parsing. |
| `/api/decks` | `useStore` | Fetch deck list with word metadata. |
| `/api/srs/batch` | `useLearningSession` | Request quiz batch for a deck. |
| `/api/srs/answers` | `useLearningSession` | Submit quiz answers and retrieve updated word state. |
| `wavesurfer.js` | `useSegmentPlayer` | Audio engine: playback, seeking, segment-precise control. |

## Test Locations

Tests are in `src/**/__tests__/` and excluded from CODEMAP per code-map-guide.
- Unit tests: composables, utilities
- E2E tests: full flows (quiz, review, audio authoring)
