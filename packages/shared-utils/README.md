# @gll/shared-utils

Small, pure, dependency-free utility functions shared across apps that would otherwise have no common package to live in. Not a types package (see `@gll/api-contract` for wire-format types) and not a home for domain/engine logic — each engine package (`srs-engine`, `srs-review`, `srs-shelving`) keeps its own internals. This package is for cross-cutting helpers with zero runtime dependencies, used identically by more than one app.

## Public API

```ts
import { buildVtt, parseVtt, readVttHash, secondsToVttTime, vttTimeToSeconds } from '@gll/shared-utils';
import type { VttCue } from '@gll/shared-utils';
```

- **WebVTT helpers** (`vtt.ts`) — build/parse a deck's WebVTT timing track and read its `audio-sha256` binding. Used by `srs-demo` (marker authoring, segment playback) and `server` (VTT-write endpoint's stamp check).
