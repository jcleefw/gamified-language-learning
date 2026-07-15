<script setup lang="ts">
import { computed } from 'vue';
import {
  useDebugRecording,
  dumpRecentAndDownload,
} from '../composables/useDebugRecording';
import { env } from '../env';

const props = defineProps<{
  activeNav: 'home' | 'learn' | 'review' | 'curation';
}>();

const emit = defineEmits<{
  error: [message: string];
}>();

const recorder = useDebugRecording();
const isRecording = recorder.isRecording;
// Disable the toggle while a finalize is in flight. During 'finalizing' isRecording
// is false, so without this the button re-arms to "Record" and a second click would
// start() a new session — wiping the buffers the in-flight finalize still reads.
const recorderBusy = computed(() => recorder.state.value === 'finalizing');

// Post-hoc dump: assemble a replayable artifact from the last N answers with no prior
// Record press (EP40). Independent of the armed session — recovers a session after a bug
// was already hit. The dumped artifact has no appearance context (see composable).
async function onDumpRecent() {
  try {
    const outcome = await dumpRecentAndDownload(100);
    if (outcome === 'empty') {
      alert('No recent answers to dump — learn or review a few words first.');
    }
  } catch {
    emit(
      'error',
      'Could not assemble the recent-answers dump. Please check the server and try again.',
    );
  }
}

async function onToggleRecording() {
  if (!recorder.isRecording.value) {
    // Phase is inferred from the current destination; home defaults to Learning
    // (the only replayable phase — Review records the same channels as context).
    recorder.start(props.activeNav === 'review' ? 'review' : 'learning');
    return;
  }
  try {
    const outcome = await recorder.finalizeAndDownload();
    if (outcome === 'empty') {
      alert('Recording stopped — no answers were recorded, so there is nothing to download.');
    }
  } catch {
    emit(
      'error',
      'Could not assemble the recording. Your session is still active — please check the server and try Stop again.',
    );
  }
}
</script>

<template>
  <button
    v-if="env.debugMode"
    class="rec-toggle"
    :class="{ recording: isRecording }"
    :disabled="recorderBusy"
    :title="isRecording ? 'Stop recording and download the artifact' : 'Start a debug-trace recording'"
    @click="onToggleRecording"
  >
    <span class="rec-dot" />
    {{ isRecording ? 'Stop & download' : 'Record' }}
  </button>

  <button
    v-if="env.debugMode && !isRecording"
    class="dump-recent"
    :disabled="recorderBusy"
    title="Download a replayable artifact from the last 100 answers (no prior Record needed)"
    @click="onDumpRecent"
  >
    Dump last 100
  </button>
</template>

<style scoped>
.rec-toggle {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #374151;
  font-family: sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.dump-recent {
  position: fixed;
  bottom: 60px;
  right: 16px;
  z-index: 50;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  color: #6b7280;
  font-family: sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.dump-recent:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rec-toggle .rec-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
}
.rec-toggle.recording {
  border-color: #fca5a5;
  color: #b91c1c;
}
.rec-toggle.recording .rec-dot {
  background: #dc2626;
  animation: rec-pulse 1.2s ease-in-out infinite;
}
@keyframes rec-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
