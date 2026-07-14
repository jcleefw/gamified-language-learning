<script setup lang="ts">
import { ref } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import { uploadDeckAudio } from '../composables/useStore';

// Curator audio-upload page (EP42-DS02, ST09). Env-gated by env.curationMode in
// App.vue — never rendered in a production build. Reuses the decks already
// fetched at boot; pairs a local .mp3 with a deck via the gated server endpoint.
const props = defineProps<{ decks: AppDeckPayload[] }>();
const emit = defineEmits<{ back: []; uploaded: [] }>();

const selectedDeckId = ref<string>('');
const selectedFile = ref<File | null>(null);
const status = ref<{ kind: 'ok' | 'error'; message: string } | null>(null);
const busy = ref(false);

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
}

async function onUpload() {
  if (!selectedDeckId.value || !selectedFile.value) return;
  busy.value = true;
  status.value = null;
  try {
    const key = await uploadDeckAudio(selectedDeckId.value, selectedFile.value);
    status.value = { kind: 'ok', message: `✓ Paired: ${key}` };
    // Refresh App.vue's deck list so the new audioUrl propagates without reload.
    emit('uploaded');
  } catch (err) {
    status.value = { kind: 'error', message: (err as Error).message };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="curate-audio">
    <button class="btn-back" @click="emit('back')">← Back</button>
    <h1>Curate Deck Audio</h1>
    <p class="hint">
      Pair a conversation <code>.mp3</code> with a deck. The file is stored and
      a current <code>audio</code> row is written in one step.
    </p>

    <label class="field">
      <span>Deck</span>
      <select v-model="selectedDeckId">
        <option value="" disabled>Choose a deck…</option>
        <option v-for="deck in props.decks" :key="deck.id" :value="deck.id">
          {{ deck.topic }}
        </option>
      </select>
    </label>

    <label class="field">
      <span>Audio file</span>
      <input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" @change="onFileChange" />
    </label>

    <button
      class="btn-primary"
      :disabled="!selectedDeckId || !selectedFile || busy"
      @click="onUpload"
    >
      {{ busy ? 'Uploading…' : 'Upload' }}
    </button>

    <p v-if="status" class="status" :class="status.kind" role="status">
      {{ status.message }}
    </p>
  </div>
</template>

<style scoped>
.curate-audio {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: sans-serif;
}
.btn-back {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
}
.hint {
  color: #6b7280;
  font-size: 0.9rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 16px 0;
}
.field > span {
  font-weight: 600;
  color: #374151;
}
.field select,
.field input {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}
.btn-primary {
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: white;
  font: inherit;
  cursor: pointer;
}
.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}
.status {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
}
.status.ok {
  background: #ecfdf5;
  color: #065f46;
}
.status.error {
  background: #fef2f2;
  color: #991b1b;
}
</style>
