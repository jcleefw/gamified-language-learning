# EP43-BUG01: Audio Playback Doesn't Track Marker Timing

**Date**: 20260714T222419Z
**Status**: Root cause confirmed via live browser console logs (see §4a)
**Epic**: [EP43 — Audio Playback and Marking](../../plans/epics/EP43-audio-playback-and-marking.md)
**Type**: Bug Report

---

## 1. Problem Statement

Reported while testing deck `73db8f50-a174-433b-93bf-88695038e57c`:

1. Audio playback does not follow the WebVTT marker timing — clicking a sentence (or "Play sentence") does not reliably play the marked `[start, end)` segment for that cue.
2. No debug visibility into player button clicks to diagnose (1) live.
3. Unclear whether audio is streamed directly from the bucket (MinIO/R2) or downloaded into a local/app cache.
4. Unclear what duration is recorded for deck `73db8f50-...`'s audio vs. the expected ~8.6s.

This report covers investigation + debug logging only. **No behavioral/logic changes were made.**

### Reproduction

1. `docker compose up -d`, seed deck `73db8f50-a174-433b-93bf-88695038e57c` with audio + a committed VTT (curator flow).
2. Open the deck in `srs-demo` (DeckOverview or a word-block QuizCard question).
3. Click a sentence / "Play sentence".
4. Observe: playback does not start/stop at the sentence's marked boundaries as expected.

---

## 2. Investigation

### Architecture (confirmed by reading code)

- **Storage**: `apps/server/src/storage/audio-store.ts` — audio binaries are uploaded to an S3-compatible bucket (MinIO locally via `docker-compose.yml`, Cloudflare R2 in prod). `makeResolveAudioUrl` composes a public URL (`GLL_AUDIO_PUBLIC_URL` + content-addressed key); the server never proxies bytes.
- **Client**: `AudioPlayer.vue` renders a plain `<audio :src="audioUrl" crossorigin="anonymous">` with an optional `<track kind="metadata" :src="vttUrl">`. The browser streams directly from the bucket URL — there is **no application-level local cache/download**. `preload="metadata"` only prefetches container metadata, not the full file. The browser's own HTTP cache may retain the bytes because non-VTT objects are written with `Cache-Control: public, max-age=31536000, immutable` (`audio-store.ts` `putObject`); the `.vtt` sidecar is written `no-cache` so it always revalidates.
- **Timing**: `useSegmentPlayer.ts` — the WebVTT `<track>` is parsed by the browser into a `TextTrack`; `playCue(sentenceId)` looks up `track.cues.getCueById(sentenceId)` and calls `playSegment(cue.startTime, cue.endTime)`, which seeks to `start`, plays, and arms a `timeupdate` listener that pauses once playback has entered and then reached `end`.
- **Duration**: `audio.duration_seconds` (packages/db/src/schema.ts:87) exists in the DB schema but **`apps/server/src/routes/curation.ts:131` always inserts `duration_seconds: null`** on upload — it is never computed from the file, and it is not part of the `content.ts` API contract exposed to the client at all. The duration shown in the player UI comes purely from the browser's own parse of the audio file (`durationchange` event on the `<audio>` element), not from any server-sent header/value.

### Initial hypothesis — REFUTED by live logs

Initially suspected a missing CORS config on the MinIO bucket (`minio-init` only runs `mc anonymous set download`, which makes objects publicly readable but does not configure CORS) preventing the `.vtt` `<track>` from loading, causing `playCue()` to silently no-op. **The live console trace below rules this out**: `<track> loaded {cueCount: 4}` and every `playCue()` call reports `found: true` with the correct `startTime`/cue data. The VTT loads and parses correctly.

**Not a bug**: calling `setRate()` while a marker segment is playing intentionally clears the pending auto-pause (`clearPendingSegment()`) — confirmed by the existing test `useSegmentPlayer.test.ts > changing rate mid-segment also disarms the pending auto-pause`. Not implicated in the live trace below (no rate changes occurred during the repro).

### Confirmed root cause (§4a) — `timeupdate`-based stop is unreliable, not the markers

The real defect is in `playSegment()`'s stop-at-`end` mechanism, not in marker authoring or VTT loading.

---

## 3. Debug Logging Added (no logic changes)

All new logs are tagged `[AUDIO]`, matching the existing `console.log('[TAG] ...')` convention (`useLearningSession.ts`, `DeckOverview.vue`).

- **`apps/srs-demo/src/composables/useSegmentPlayer.ts`**: `play()`, `pause()`, `seek()`, `setRate()` (incl. whether it disarmed a pending segment), `playSegment()` (start/end + reached-end pause), `playCue()` (sentenceId, whether the track was loaded, cue count, found cue + its start/end), `durationchange` (element duration as reported by the browser), `cuechange` (resolved active cue id), and track attach (`cueCount` at attach time).
- **`apps/srs-demo/src/components/AudioPlayer.vue`**: click logs for the play/pause toggle, the scrubber, and each speed button; `<track>` `load`/`error` listeners to directly detect VTT fetch/CORS failures.
- **`apps/srs-demo/src/components/QuizCard.vue`**: click log for "Play sentence" (whether `audio` prop / player ref are present, sentenceId, audioUrl, vttUrl).
- **`apps/srs-demo/src/components/DeckOverview.vue`**: click log for a sentence-card click (idx, sentenceId, whether `vttUrl`/player are present).

All existing unit tests (`useSegmentPlayer.test.ts`, `useAudio.test.ts`, `useMarkerAuthoring.test.ts` — 15 tests) still pass with the added logging.

---

## 4. Live Console Trace (deck `73db8f50-a174-433b-93bf-88695038e57c`)

Captured directly from the browser after adding the logging in §3. Full trace on file with this report; summarized findings:

- `durationchange {duration: 8.6}` — matches the expected 8.6s exactly. **Not a bug** (see 4a-Q4 below).
- `<track> loaded {cueCount: 4}` — the VTT parses into exactly 4 cues, one per sentence, spanning the deck's 4 lines contiguously: `[0, 2.17) [2.17, 4.56) [4.56, 6.45) [6.45, 8.6)`.
- `playCue()` always finds the right cue (`found: true`) with the correct `startTime`/`endTime` for the clicked sentence — the marker data itself and the lookup are both correct.
- **But the stop-at-`end` behavior is broken**, and inconsistently so:

  | Sentence clicked | Requested segment | Actual pause `currentTime` | Overshoot |
  |---|---|---|---|
  | `532d209d...` (idx 1) | `[2.17, 4.56)` | `4.781968` | **+0.22s** — bleeds slightly into cue 2 |
  | `a1ad421b...` (idx 2) | `[4.56, 6.45)` | `8.6` | **+2.15s** — plays straight through cue 3, all the way to the end of the file |
  | `007d0efb...` (idx 3) | `[6.45, 8.6)` | `8.6` | 0s (this cue's `end` IS the file's natural end, so it can't overshoot) |

### 4a. Root cause

`playSegment()` (`useSegmentPlayer.ts`) stops a segment purely via a `timeupdate` listener:

```ts
if (t >= start && t < end) entered = true;
if (entered && t >= end) pause();
```

`timeupdate` is a low/irregular-frequency native event (spec says "roughly 4Hz", but real firing cadence varies by browser and by media type). For the `a1ad421b` cue, no `timeupdate` landed close enough to `6.45` before the pause check triggered — the code only actually re-checks whenever the browser happens to fire the event next, and evidently didn't fire again until the file's natural end (`8.6`), well past the next sentence's entire marked range. The `532d209d` cue only overshot by ~0.22s, showing the failure mode is not constant — it depends entirely on when `timeupdate` happens to land relative to `end`, which for this WAV file (see existing code comments: `useSegmentPlayer.ts`'s `seek()` already flags WAV `duration`/timing as harder for the browser to measure than compressed formats) is unreliable.

This is the actual bug: **markers and their times are correct; the mechanism that's supposed to stop playback at a marker's `end` is not precise enough and can fail arbitrarily badly** (from a fraction of a second to multiple seconds, up to running through subsequent markers entirely).

Also observed but not investigated further: `cuechange` fires multiple times in quick succession around a `seek()` (e.g., briefly reporting the previous/next cue as active before settling) — consistent with normal `TextTrack` engine behavior around seeks, not a separate defect.

---

## 5. Answers to Open Questions

1. **Marker timing bug**: confirmed — see §4/§4a. Not a CORS/VTT-loading issue (that hypothesis is refuted); the WebVTT markers and cue lookup are correct. The bug is `playSegment()`'s reliance on native `timeupdate` to detect crossing a cue's `end`, which fires too infrequently/irregularly to reliably stop in time — observed overshoot ranged from 0.22s to 2.15s (through an entire subsequent cue) in the same session.
2. **Debug logs for player button clicks**: added (§3) and used to capture the trace in §4.
3. **Streamed vs. downloaded**: streamed directly from the bucket URL by the `<audio>` element (no app-level local cache). The browser's own HTTP cache may retain bytes due to the `immutable` `Cache-Control` set on non-VTT uploads.
4. **Duration for `73db8f50-...`'s audio**: confirmed via live `durationchange` log — `8.6`s, matching the expected 8.6s exactly. The DB's `duration_seconds` column is still always `null` (never computed/exposed server-side) — this particular number came from the browser parsing the file directly, not from any server value, but it is correct.

---

## 6. Next Steps (not done here per instruction — logging only)

- Fix `playSegment()`'s stop mechanism to not depend solely on `timeupdate` cadence — options to evaluate: a tighter poll (e.g. `requestAnimationFrame` while a segment is armed) alongside/instead of `timeupdate`, or driving the stop off the WebVTT `cuechange`/`exit` transition (the track already fires `cuechange` reliably in this trace) rather than a manually-computed `end`.
- Decide whether `duration_seconds` should be computed at upload time and exposed via the API, even though it's not the cause of this bug.
- No CORS change needed — that hypothesis was disproven.
