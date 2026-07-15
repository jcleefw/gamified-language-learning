<template>
  <div class="curation-landing">
    <h1>Curation</h1>
    <p class="subtitle">Choose a curator tool.</p>

    <div class="mode-cards">
      <button class="mode-card" @click="emit('curate')">
        <span class="mode-title">🎙️ Curate audio</span>
        <span class="mode-desc">Pair a conversation audio file with a deck.</span>
      </button>

      <button class="mode-card" @click="emit('mark')">
        <span class="mode-title">🏷️ Mark audio</span>
        <span class="mode-desc">Mark per-sentence audio segments for a deck.</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ curate: []; mark: [] }>();
</script>

<style scoped>
.curation-landing {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.curation-landing h1 {
  font-size: 1.8rem;
  margin-bottom: 8px;
}
.curation-landing .subtitle {
  color: #6b7280;
  margin: 0 0 24px;
}
.curation-landing .mode-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.curation-landing .mode-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.curation-landing .mode-card:hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.curation-landing .mode-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: 600;
}
.curation-landing .mode-desc {
  color: #6b7280;
  font-size: 0.9rem;
}
</style>
