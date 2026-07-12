# ADR: Conversation Audio — Marking (Authoring) Architecture

**Status:** Accepted

**Date:** 2026-07-13

**Deciders:** PO (solo founder)

**Scope:** How the per-sentence audio markers get **authored and persisted** — the build architecture for the marking tool, in two passes. This is the *marking* half of audio; it produces what the playback ADR consumes.

**Paired with:** [20260713T140218Z-engineering-audio-playback-model.md](20260713T140218Z-engineering-audio-playback-model.md) — the runtime *playing* contract (`DeckSentence.audioStart/audioEnd`, `decks.audio_key`). **PRD:** [Audio Marker Tool](../prds/20260713T140217Z-audio-marker-tool.md). **Relates:** [20260712T124801Z-infra-mixed-platform-hosting.md](20260712T124801Z-infra-mixed-platform-hosting.md) (R2 in pass 2); the seed/import pipeline.

---

## Context

A single conversation file per deck needs per-sentence `[start, end]` markers (the playback ADR's data contract). Those markers must be **authored** — no automated derivation for the MVP — via a **browser tool** where the PO scrubs the audio and sets in/out points per sentence.

This tool is the **first slice of curation**, which is otherwise greenfield: `packages/api-contract/src/curation.ts` is an empty stub (*"Stage 7 — curation wire types deferred"*) and no curator app exists (`apps/` = `cli-demo-db`, `server`, `srs-demo`). Because audio (an MVP blocker) depends on markers, and markers depend on this tool, **audio pulls the first slice of Stage-7 curation forward**.

The PO chose a **two-pass** build to avoid over-investing before audio ships.

---

## Decision

A phased build. The **playback data contract is identical in both passes** (`DeckSentence.audioStart/audioEnd`, `decks.audio_key`); only the *authoring path and file location* change.

### Pass 1 — Just-enough to unblock audio (MVP)

| Concern | Choice |
| ------- | ------ |
| Where it lives | A **gated route inside `srs-demo`** (curator-only), not a new app |
| Audio source | **Local-served** file; the deck's audio reference (`decks.audio_key`) resolves to a locally-served URL |
| Marker persistence | Tool exports a **JSON marker map** (sentenceId → `{start, end}`); the **seed/import pipeline** ingests it and writes `DeckDoc.sentences[].audioStart/audioEnd` |
| Server writes | **None** — no new mutating content endpoints; the write path stays in seed/import |

Pass 1 deliberately **serves audio locally rather than from R2** — a documented phasing step, not a reversal of the hosting ADR. The GCP/Node server can serve the static conversation files directly; R2 upload-first is a pass-2 concern.

### Pass 2 — The real curator interface

| Concern | Choice |
| ------- | ------ |
| Where it lives | A **separate `apps/curator`** app |
| Audio source | **Upload-first** — the file is uploaded to **R2**; the tool loads it from the R2 URL |
| Marker persistence | Markers written **through the server → DB** (direct `DeckDoc` writes), replacing the JSON-map round-trip |
| Server writes | Content-write endpoints + curator auth introduced here |

### What is NOT decided here

- The **learner-facing** playback (surfaces, `ReviewQuestionType`, engine boundary) — that is the paired playback ADR.
- Word-level marking — deferred with word-level audio.
- Automated marker derivation (forced alignment / silence detection) — out; markers are hand-authored.

---

## Rationale

- **Route-in-`srs-demo` before a curator app.** Pass 1's only job is to unblock audio for ~3 testers. A gated route reuses the existing app, router, and audio player (playback-rate control shared with the learner side) for near-zero scaffolding; a dedicated app is deferred to pass 2 when curation is a real ongoing surface.
- **JSON marker map before server writes.** Exporting a map keeps the DB write-path inside the existing seed/import tooling — no new mutating endpoints, no admin-auth detour on the MVP's critical path. Server-write graduates in pass 2 when the curator app justifies it.
- **Local audio before R2.** Serving files off the app in pass 1 removes the R2-upload dependency from the audio-ship path; R2 upload-first lands with the pass-2 curator app.
- **Stable contract across passes** means pass 2 is a swap of *how markers are produced*, not a data migration.

---

## Consequences

**Positive**

- Audio ships on the shortest path — a gated route + a JSON map fed to tooling that already exists.
- No new content-write endpoints or curator auth on the MVP critical path.
- Pass 2 upgrades the authoring path without reshaping stored data.

**Negative / Risks**

- **Two homes for the tool** over its life (srs-demo route → curator app) — an intended, scoped refactor.
- **Pass 1 audio is local-served**, diverging temporarily from the R2 hosting ADR; must be tracked so it is actually migrated in pass 2.
- Hand-authored markers are labor per deck (≥10 decks); the tool's ergonomics (see PRD) are the mitigation.

---

## Open Questions

| Question | Owner | Target |
| -------- | ----- | ------ |
| JSON marker-map schema + where it lands for seed ingest | Dev | Pass-1 build |
| `decks.audio_key` naming + local static-serving path (pass 1) | Dev | Pass-1 build |
| R2 upload flow + curator auth model | Dev | Pass-2 design |
