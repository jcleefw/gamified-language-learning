# ADR: Conversation Audio — Playback Model & Data Contract

**Status:** Accepted

**Date:** 2026-07-13

**Deciders:** PO (solo founder)

**Scope:** How pronunciation audio is **consumed at runtime** — the data contract for a per-deck conversation file plus per-sentence markers, how it reaches the client, where it plays, and how it attaches to the quiz loop. This is the *playing* half of audio.

**Paired with:** [20260713T140219Z-engineering-audio-marking-authoring.md](20260713T140219Z-engineering-audio-marking-authoring.md) — the *marking* (authoring) half, which **produces** the markers this ADR **consumes**. **Relates:** [20260712T124801Z-infra-mixed-platform-hosting.md](20260712T124801Z-infra-mixed-platform-hosting.md) (R2 audio storage). **Preserves the library boundary:** `@gll/srs-engine-v2` stays a pure engine (see `.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md`).

---

## Context

Audio pronunciation is a PO-declared MVP-release blocker, and the codebase has **zero audio support today**: no column in `packages/db/src/schema.ts`, no field in `@gll/api-contract`, no `<audio>` in `srs-demo`, and `ReviewQuestionType` is exactly `'mcq' | 'word-block'`.

The PO's authoring model is decisive for the data shape: **audio is supplied as one conversation file per deck**, not as per-word clips. Playback is by **sentence** — each sentence maps to a `[start, end]` time range *within* the single deck file; word-level audio is deferred. Learners must also be able to **slow the audio down**.

Existing structures this builds on:

- **`decks`** (`id, name, language, …, doc`) — the conversation is the deck; the audio file is a property of the deck.
- **`DeckDoc.sentences[]`** (`DeckSentence`: `sentenceId, native, english, romanization, position, components[]`) — the per-sentence unit; markers attach here.
- **`AppDeckPayload` / `AppLinePayload`** (GET `/api/decks`) — the wire shapes the demo consumes to build questions.
- **`QuizCard.vue`** — the single quiz component shared by Learning and Review; the **word-block** branch renders sentence questions.
- **`DeckOverview.vue`** — the deck browsing surface.
- **`SentenceQuestion`** (`kind: 'word-block'`, `sentenceId`, `tiles[]`) in `srs-engine-v2`.

---

## Decision

### 1. Audio is per-deck; markers are per-sentence

- The deck owns the conversation file reference:

  ```
  decks.audio_key TEXT   -- reference to the deck's single conversation audio file; NULL = no audio
  ```

- Each sentence carries a time range into that file. Extend `DeckSentence` (in `DeckDoc`):

  ```
  audioStart?: number   // seconds (float) into decks.audio file
  audioEnd?:   number   // seconds (float); play stops here
  ```

  Absence of markers ⟹ that sentence has no playable segment. Word-level audio is **out of scope** (deferred).

### 2. Store a reference, serve a URL

The DB holds the file reference; the **server resolves it to a playable URL** on read (base location + key in server config) and emits it on the wire. This keeps the client dumb and lets the file's *location* change without touching stored data — which the paired authoring ADR relies on (local-served in pass 1, R2 in pass 2). Wire additions:

```
AppDeckPayload.audioUrl?: string    // absent ⟺ decks.audio_key IS NULL
AppLinePayload.audioStart?: number  // seconds
AppLinePayload.audioEnd?:   number  // seconds
```

### 3. Two playback surfaces, one marker source

- **DeckOverview** — play the whole conversation; clicking a sentence seeks to its `audioStart` and plays to `audioEnd`.
- **Word-block sentence question** (in `QuizCard.vue`) — a control plays *that sentence's* segment.
- **MCQ word questions get no audio** (word-level audio deferred).

Both surfaces read the **same** `audioStart/audioEnd` off the deck payload — one authored source, two consumers.

### 4. Segment playback + slow-down

The player uses one `<audio>` element per surface: set `currentTime = audioStart`, play, and pause when `currentTime >= audioEnd`. A **playback-rate control** (e.g. 1× / 0.75× / 0.5×) sets `audio.playbackRate`; the same control is reused by the marking tool.

### 5. Audio is an adornment, not a question type; the engine stays audio-free

`ReviewQuestionType` stays `'mcq' | 'word-block'` — **no `audio-recognition` member** for the MVP. Audio plays *alongside* the existing word-block question, it is not a distinct tested skill. `QuizQuestion` / `SentenceQuestion` remain pure text (no URLs in the engine); the Vue client resolves `sentenceId → (audioUrl, audioStart, audioEnd)` from the `AppDeckPayload` it already holds.

### 6. Missing audio degrades silently

No `audioUrl` (or no markers) ⟹ no play control rendered; the question and overview work unchanged. Audio never gates answering.

### 7. Cache aggressively — files are immutable per key

A deck's conversation file is fetched **repeatedly** across a session (both playback surfaces re-request the same `audioUrl`) and **across testers** (every tester of the same deck fetches the same key). The never-overwrite rule is enforced structurally: keys are **content-addressed** — `decks/<deckId>/<sha256-of-bytes>.<ext>` (`ext` ∈ {`mp3`, `wav`}, chosen by the uploaded file's magic bytes). Identical bytes resolve to the identical key (a true no-op re-upload); a re-recording has different bytes, hence a **new** key and a new `audioUrl` — never an in-place overwrite. So each object is safe to cache forever once written:

- The object is written with `Cache-Control: public, max-age=31536000, immutable` at upload time (the curator/upload path — `putObject` — sets this header; the read path stays pure string composition and does not touch it).
- This makes the browser cache the file after first play (no re-fetch on segment replays or slow-down toggles) and lets the bucket's edge (R2's Cloudflare CDN in production) serve repeat cross-tester requests without hitting bucket egress.
- Because the header is `immutable`, correctness depends on the **never-overwrite-a-key** rule holding: if a key's bytes ever changed post-upload, caches would keep serving the stale file. This is the same constraint the paired authoring ADR already establishes for markers; audio content follows it too.

---

## Consequences

**Positive**

- Additive schema (`decks.audio_key` + two optional `DeckSentence` fields) and optional wire fields; no migration of existing rows.
- `srs-engine-v2` and the `ReviewQuestionType` contract are untouched — no ripple into FSRS/recording.
- The contract is **stable across the two authoring passes** — the client reads markers identically whether pass 1 seeded them from JSON or pass 2 wrote them via server.

**Negative / deferred**

- Word-level pronunciation needs a later seam; not designed here.
- Precise stop-at-`audioEnd` depends on marker accuracy — a quality dependency on the marking tool.

---

## Open Questions (→ audio epic / paired ADR)

| Question | Owner |
| -------- | ----- |
| Marker units confirmed as seconds-float; ms rounding at edges? | Dev |
| Segment UX: autoplay vs tap-to-play on the word-block question; iOS session-unlock | Dev |
| ~~Audio file format + `decks.audio_key` naming convention~~ **Resolved**: MP3 or WAV (validated by magic bytes, not filename); content-addressed key `decks/<deckId>/<sha256>.<ext>` (§7) | Dev (marking ADR) | ✅ 2026-07-14 |
| ~~Repeat-play egress cost~~ **Resolved**: `Cache-Control: public, max-age=31536000, immutable` on upload (§7) | PO | ✅ 2026-07-13 |
