import { ref, computed } from 'vue';
import { mintCorrelationId, type CorrelationId } from './useCorrelation';

/**
 * Scoped trace session (EP40-ST02) — the situational start/stop control surface
 * that gates whether the client channels record. Tracing is "situational, not
 * always-on" (ADR Pillar 4): nothing is recorded while inactive. This DS delivers
 * the control surface + record shapes; the channel *wiring* (ST03 API, ST04
 * appearance) that calls `record()` is DS02.
 *
 * OQ2 resolved: entries live in this session's memory and are EXPORTED on stop
 * (once-off diagnosis). No server sink — reconciled offline against the DB
 * transition rows by `correlationId`.
 */

export type TraceChannel = 'api' | 'appearance' | 'transition';

export interface TraceEntry {
  correlationId: CorrelationId | null;
  channel: TraceChannel;
  at: string; // ISO — orders the timeline
  data: unknown; // channel-specific payload
}

// API channel (boundary) — scenario (i). DS02 §3.
export interface ApiChannelData {
  method: string;
  path: string;
  status?: number; // absent if the request threw before a response
  ok?: boolean;
  error?: string; // network throw or non-ok body message
}

// Appearance channel (client orchestration) — scenario (ii). DS02 wiring.
export interface AppearanceChannelData {
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving-decision';
  detail: unknown;
}

export interface TraceSession {
  sessionId: string;
  active: boolean;
  startedAt: string;
  stoppedAt?: string;
  correlationIds: CorrelationId[];
  entries: TraceEntry[];
}

export function useTraceSession() {
  const session = ref<TraceSession | null>(null);
  const active = computed(() => session.value?.active ?? false);

  /** Begin a fresh trace session. Overwrites any prior (stopped) session. */
  function start(): TraceSession {
    session.value = {
      sessionId: mintCorrelationId(),
      active: true,
      startedAt: new Date().toISOString(),
      correlationIds: [],
      entries: [],
    };
    return session.value;
  }

  /** Stop recording and return the buffered session for export. Idempotent. */
  function stop(): TraceSession | null {
    if (session.value && session.value.active) {
      session.value.active = false;
      session.value.stoppedAt = new Date().toISOString();
    }
    return session.value;
  }

  /**
   * Record one channel entry. No-op unless a session is active. Fail-open —
   * tracing is diagnostics, never control flow: this never throws to its caller.
   */
  function record(entry: Omit<TraceEntry, 'at'> & { at?: string }): void {
    try {
      const s = session.value;
      if (!s || !s.active) return;
      const at = entry.at ?? new Date().toISOString();
      s.entries.push({
        correlationId: entry.correlationId ?? null,
        channel: entry.channel,
        at,
        data: entry.data,
      });
      if (entry.correlationId && !s.correlationIds.includes(entry.correlationId)) {
        s.correlationIds.push(entry.correlationId);
      }
    } catch {
      // Diagnostics must never affect the app; drop the entry.
    }
  }

  /**
   * Serialise the session for the once-off diagnostic export (DS02). API +
   * appearance entries ordered by `at`; transition entries are NOT here — they
   * live in the DB and are joined offline by `correlationId`.
   */
  function exportSession(): TraceExport | null {
    const s = session.value;
    if (!s) return null;
    return {
      sessionId: s.sessionId,
      startedAt: s.startedAt,
      stoppedAt: s.stoppedAt ?? new Date().toISOString(),
      correlationIds: [...s.correlationIds],
      // API + appearance only; transition entries live in the DB and are joined
      // offline by correlationId (DS02 §3). The client never emits them, so this
      // filter is belt-and-suspenders against a stray write.
      entries: s.entries
        .filter((e) => e.channel !== 'transition')
        .sort((a, b) => a.at.localeCompare(b.at)),
    };
  }

  return { session, active, start, stop, record, exportSession };
}

export type TraceSessionApi = ReturnType<typeof useTraceSession>;

/** Exported artefact (written on TraceSession stop). Transition entries excluded
 *  — reconciled offline against the DB rows by `correlationId`. */
export interface TraceExport {
  sessionId: string;
  startedAt: string;
  stoppedAt: string;
  correlationIds: CorrelationId[];
  entries: TraceEntry[]; // api + appearance, ordered by `at`
}

// ---------------------------------------------------------------------------
// Shared singleton (DS02) — one buffer reachable from every recording site,
// including the module-scope functions in useStore.ts that Vue provide/inject
// can't reach. Memoised accessor keeps singleton ergonomics while staying
// testable (resetForTests hands a fresh instance to each test).
// ---------------------------------------------------------------------------

let shared: TraceSessionApi | null = null;

/** The process-wide trace session. All channels record into this one buffer. */
export function getTraceSession(): TraceSessionApi {
  return (shared ??= useTraceSession());
}

/** Test hook — drop the shared instance so each test starts from a clean buffer. */
export function __resetTraceSessionForTests(): void {
  shared = null;
}
