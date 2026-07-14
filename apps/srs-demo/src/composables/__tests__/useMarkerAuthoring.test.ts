import { describe, it, expect } from 'vitest';
import { parseVtt, readVttHash } from '@gll/api-contract';
import {
  useMarkerAuthoring,
  NUDGE_COARSE,
  NUDGE_FINE,
} from '../useMarkerAuthoring';

// EP43-DS02 ST04 — the marker-authoring flow lives in this composable so it is
// testable without a DOM (the repo tests composables, not .vue files). These
// cover the ST04 acceptance criteria: capture off the play-head, hydrate/round-
// trip an existing VTT, exclude half/inverted markers, and emit a WebVTT track
// (cue-ID = sentenceId, hash-stamped) from complete rows only.

const HASH = 'deadbeefcafef00d';

describe('useMarkerAuthoring', () => {
  it('captures in/out from the play-head and emits a hash-stamped, sentenceId-keyed VTT', () => {
    const a = useMarkerAuthoring();
    a.seed(['s1', 's2']);

    a.setIn('s1', 1.234); // play-head currentTime
    a.setOut('s1', 2.678);

    expect(a.isComplete('s1')).toBe(true);
    const vtt = a.buildVtt(HASH);
    expect(readVttHash(vtt)).toBe(HASH);
    const cues = parseVtt(vtt);
    expect(cues.s1).toEqual({ start: 1.23, end: 2.68 }); // quantised to centisecond
    // s2 was never marked → no cue, not a half-marker.
    expect(cues.s2).toBeUndefined();
  });

  it('hydrates each row from an existing VTT and round-trips it', () => {
    const existing = a0BuildExisting();
    const a = useMarkerAuthoring();
    a.seed(['s1', 's2'], existing);

    expect(a.markers.value.s1).toEqual({ start: 0.5, end: 1.5 });
    expect(a.markers.value.s2).toEqual({ start: null, end: null }); // absent in the VTT

    const cues = parseVtt(a.buildVtt(HASH));
    expect(cues).toEqual({ s1: { start: 0.5, end: 1.5 } });
  });

  it('excludes half markers and inverted/zero-length pairs from the VTT', () => {
    const a = useMarkerAuthoring();
    a.seed(['half', 'inverted', 'zero', 'ok']);

    a.setIn('half', 1.0); // start only
    a.setIn('inverted', 3.0);
    a.setOut('inverted', 2.0); // end < start
    a.setIn('zero', 4.0);
    a.setOut('zero', 4.0); // end == start
    a.setIn('ok', 1.0);
    a.setOut('ok', 2.0);

    for (const id of ['half', 'inverted', 'zero']) {
      expect(a.isComplete(id)).toBe(false);
    }
    expect(parseVtt(a.buildVtt(HASH))).toEqual({ ok: { start: 1.0, end: 2.0 } });
  });

  it('nudges a set edge by the coarse/fine step, clamped at zero', () => {
    const a = useMarkerAuthoring();
    a.seed(['s1']);
    a.setIn('s1', 1.0);

    a.nudge('s1', 'start', NUDGE_COARSE);
    expect(a.markers.value.s1.start).toBe(1.05);
    a.nudge('s1', 'start', -NUDGE_FINE);
    expect(a.markers.value.s1.start).toBe(1.04);

    a.nudge('s1', 'start', -5); // clamp: cannot go below 0
    expect(a.markers.value.s1.start).toBe(0);
  });

  it('nudging an unset edge is a no-op', () => {
    const a = useMarkerAuthoring();
    a.seed(['s1']);
    a.nudge('s1', 'end', NUDGE_COARSE);
    expect(a.markers.value.s1.end).toBeNull();
  });

  it('re-seeding a different deck resets all prior rows', () => {
    const a = useMarkerAuthoring();
    a.seed(['s1']);
    a.setIn('s1', 1.0);
    a.seed(['other']);
    expect(a.markers.value.s1).toBeUndefined();
    expect(a.markers.value.other).toEqual({ start: null, end: null });
  });
});

/** A committed VTT with one cue for s1 — the shape fetchDeckVtt would return. */
function a0BuildExisting(): string {
  const seeder = useMarkerAuthoring();
  seeder.seed(['s1']);
  seeder.setIn('s1', 0.5);
  seeder.setOut('s1', 1.5);
  return seeder.buildVtt(HASH);
}
