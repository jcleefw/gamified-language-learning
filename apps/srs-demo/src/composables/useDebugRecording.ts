import { ref, computed, type Ref, type ComputedRef } from 'vue';

/**
 * The debug-trace recorder (EP40-DS02). One phase-scoped session issues a correlation id
 * per served question, buffers read-only appearance context, and on finalize assembles a
 * self-contained ReplayArtifact (DS01 shape) fetched partly from POST /api/debug/transitions.
 *
 * A module-level singleton so App.vue, useLearningSession and useShelving share one recorder
 * without prop-drilling. Capture is a no-op unless recording, so it costs nothing off the
 * recording path.
 */

export type Phase = 'learning' | 'review';
export type RecordingState = 'idle' | 'recording' | 'finalizing';

export interface AppearanceEvent {
  correlationId: string | null; // the question this decision concerns; null before any serve
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving';
  at: string; // ISO
  data: unknown; // kind-specific payload
}

export interface UseDebugRecording {
  state: Ref<RecordingState>;
  isRecording: ComputedRef<boolean>;
  phase: Ref<Phase | null>;

  start(phase: Phase): void;
  nextCorrelationId(): string;
  currentCorrelationId(): string | null;
  recordAppearance(e: Omit<AppearanceEvent, 'at'>): void;
  /** Fetch the transition slice, assemble + download the artifact, reset to idle. */
  finalizeAndDownload(): Promise<'downloaded' | 'empty' | 'idle'>;
  cancel(): void;

  // Introspection (session-wide ordered id list drives the finalize request;
  // the appearance buffer is merged into the artifact).
  issuedIds(): string[];
  appearanceBuffer(): AppearanceEvent[];
}

// The transition slice POST /api/debug/transitions returns; assembled server-side.
interface TransitionSlice {
  thresholds: unknown | null;
  baseline: unknown[];
  inputs: unknown[];
}

// The self-contained artifact (DS01 ReplayArtifact shape; the client adds meta +
// appearance around the server's transition slice).
interface ReplayArtifact {
  version: 1;
  meta: { createdAt: string; sessionId: string; phase: Phase; originUserId: string };
  thresholds: unknown;
  baseline: unknown[];
  inputs: unknown[];
  appearance: AppearanceEvent[];
}

// --- Singleton state ---
const state = ref<RecordingState>('idle');
const phase = ref<Phase | null>(null);
const sessionId = ref<string | null>(null);
const current = ref<string | null>(null);
const issued: string[] = [];
const appearance: AppearanceEvent[] = [];

const isRecording = computed(() => state.value === 'recording');

function resetBuffers(): void {
  current.value = null;
  issued.length = 0;
  appearance.length = 0;
}

function start(p: Phase): void {
  sessionId.value = crypto.randomUUID();
  phase.value = p;
  state.value = 'recording';
  resetBuffers();
}

function cancel(): void {
  state.value = 'idle';
  phase.value = null;
  sessionId.value = null;
  resetBuffers();
}

function nextCorrelationId(): string {
  if (state.value !== 'recording') return '';
  const id = crypto.randomUUID();
  issued.push(id);
  current.value = id;
  return id;
}

function currentCorrelationId(): string | null {
  return current.value;
}

function recordAppearance(e: Omit<AppearanceEvent, 'at'>): void {
  if (state.value !== 'recording') return;
  appearance.push({ ...e, at: new Date().toISOString() });
}

// Download a JSON object as a file via a Blob object URL. Behind an injectable
// seam (`downloader`) so tests assert the download without a DOM environment.
function domDownload(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

let downloader: (filename: string, obj: unknown) => void = domDownload;

/** Test seam: override the file-download side effect. */
export function setDownloaderForTest(fn: (filename: string, obj: unknown) => void): void {
  downloader = fn;
}

async function finalizeAndDownload(): Promise<'downloaded' | 'empty' | 'idle'> {
  if (state.value !== 'recording') return 'idle';
  state.value = 'finalizing';
  try {
    const res = await fetch('/api/debug/transitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correlationIds: [...issued] }),
    });
    if (!res.ok) throw new Error(`POST /api/debug/transitions failed: ${res.status}`);
    const body = (await res.json()) as
      | { success: true; data: TransitionSlice }
      | { success: false; error: { message: string } };
    if (!body.success) throw new Error(body.error.message);

    const slice = body.data;
    // A recording with no transitions has nothing to replay: no file, just reset.
    if (slice.inputs.length === 0 || slice.thresholds == null) {
      cancel();
      return 'empty';
    }

    downloadArtifact(
      slice,
      phase.value ?? 'learning',
      sessionId.value ?? crypto.randomUUID(),
      [...appearance],
    );
    cancel();
    return 'downloaded';
  } catch (err) {
    // Surface nothing here — restore the recording so the tester can retry rather
    // than lose the session to a transient failure.
    state.value = 'recording';
    throw err;
  }
}

// Build the DS01 ReplayArtifact around a server transition slice and download it. Shared
// by the armed finalize path (with buffered appearance) and the post-hoc dump (empty
// appearance) so both emit byte-identical artifact shapes.
function downloadArtifact(
  slice: TransitionSlice,
  phase: Phase,
  sessionId: string,
  appearanceEvents: AppearanceEvent[],
): void {
  const artifact: ReplayArtifact = {
    version: 1,
    meta: {
      createdAt: new Date().toISOString(),
      sessionId,
      phase,
      originUserId: 'demo-user', // informational; replay injects its own userId
    },
    thresholds: slice.thresholds,
    baseline: slice.baseline,
    inputs: slice.inputs,
    appearance: appearanceEvents,
  };
  downloader(`${artifact.meta.sessionId}.json`, artifact);
}

/**
 * Post-hoc dump (EP40): assemble + download a replayable artifact from the last `lastN`
 * answers WITHOUT a prior recording. Independent of the armed-session state — every
 * `/api/answer` already persisted its transition server-side. The artifact has an empty
 * `appearance[]` (that context is only buffered while armed); replay parity doesn't use it.
 * Returns 'empty' when there are no recent transitions to assemble.
 */
export async function dumpRecentAndDownload(
  lastN = 100,
): Promise<'downloaded' | 'empty'> {
  const res = await fetch('/api/debug/transitions-recent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastN }),
  });
  if (!res.ok) throw new Error(`POST /api/debug/transitions-recent failed: ${res.status}`);
  const body = (await res.json()) as
    | { success: true; data: TransitionSlice }
    | { success: false; error: { message: string } };
  if (!body.success) throw new Error(body.error.message);

  const slice = body.data;
  if (slice.inputs.length === 0 || slice.thresholds == null) return 'empty';

  downloadArtifact(slice, 'learning', `posthoc-${crypto.randomUUID()}`, []);
  return 'downloaded';
}

const singleton: UseDebugRecording = {
  state,
  isRecording,
  phase,
  start,
  nextCorrelationId,
  currentCorrelationId,
  recordAppearance,
  finalizeAndDownload,
  cancel,
  issuedIds: () => [...issued],
  appearanceBuffer: () => [...appearance],
};

export function useDebugRecording(): UseDebugRecording {
  return singleton;
}

/**
 * Whether a navigation must soft-confirm + finalize the active recording before leaving
 * (EP40-ST08). A recording is finalized rather than silently dropped when the target
 * crosses the Learning↔Review phase boundary, or when it leaves an in-progress quiz batch.
 * Not recording ⇒ never — navigation behaves exactly as before.
 */
export function shouldFinalizeOnNav(
  isRecording: boolean,
  recordingPhase: Phase | null,
  targetPhase: Phase,
  isMidQuiz: boolean,
): boolean {
  if (!isRecording) return false;
  const crossesPhase = recordingPhase !== null && recordingPhase !== targetPhase;
  return crossesPhase || isMidQuiz;
}
