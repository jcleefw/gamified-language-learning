// ── WebVTT timing helpers (EP43 — WebVTT ADR) ────────────────────────────────
// Pure, dependency-free. Shared by the marker tool (build/parse/read) and the
// server VTT-write endpoint (readVttHash for the stamp check). A deck's timing
// is ONE WebVTT track bound to its audio binary: cue-ID = sentenceId; the header
// carries `NOTE audio-sha256:<hash>` binding it to that binary (WebVTT ADR §1/§4).

export interface VttCue {
  id: string; // = sentenceId
  start: number; // seconds
  end: number; // seconds
}

/** seconds → `HH:MM:SS.mmm` (WebVTT timestamp). */
export function secondsToVttTime(t: number): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(millis, 3)}`;
}

/** `HH:MM:SS.mmm` or `MM:SS.mmm` → seconds. */
export function vttTimeToSeconds(ts: string): number {
  const parts = ts.trim().split(':');
  let h = 0,
    m = 0,
    s = 0;
  if (parts.length === 3) [h, m, s] = parts.map(Number) as [number, number, number];
  else if (parts.length === 2) [m, s] = parts.map(Number) as [number, number];
  else s = Number(parts[0]);
  return h * 3600 + m * 60 + s;
}

/**
 * Build a WebVTT track: header + `NOTE audio-sha256` stamp + one cue per range
 * (cue-ID line = sentenceId). Cues are emitted in the order given.
 */
export function buildVtt(cues: VttCue[], audioSha256: string): string {
  const blocks = [`WEBVTT`, `NOTE audio-sha256:${audioSha256}`];
  for (const cue of cues) {
    blocks.push(
      `${cue.id}\n${secondsToVttTime(cue.start)} --> ${secondsToVttTime(cue.end)}\n${cue.id}`,
    );
  }
  return blocks.join('\n\n') + '\n';
}

/**
 * Parse a WebVTT track back to `{ sentenceId: { start, end } }`. Ignores the
 * `WEBVTT` header and any `NOTE` blocks; a cue block is an id line followed by a
 * `start --> end` timing line.
 */
export function parseVtt(text: string): Record<string, { start: number; end: number }> {
  const out: Record<string, { start: number; end: number }> = {};
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue;
    const timingLine = lines.find((l) => l.includes('-->'));
    if (!timingLine) continue;
    const idLine = lines[0].includes('-->') ? null : lines[0];
    if (!idLine) continue; // a cue without an explicit id line isn't a sentence cue
    const [startRaw, endRaw] = timingLine.split('-->');
    out[idLine.trim()] = {
      start: vttTimeToSeconds(startRaw),
      end: vttTimeToSeconds(endRaw),
    };
  }
  return out;
}

/** Read the `NOTE audio-sha256:<hash>` binding from a VTT header (null if absent). */
export function readVttHash(text: string): string | null {
  const m = text.match(/NOTE audio-sha256:([0-9a-fA-F]+)/);
  return m ? m[1] : null;
}
