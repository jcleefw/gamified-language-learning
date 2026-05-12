<script setup lang="ts">
import { appDecks } from '../data/decks'
import { deckToQuizItems } from '../data/transformer'
import { loadSession } from '../composables/useSession'

const emit = defineEmits<{
  select: [deckId: string]
  resume: []
  clear: []
}>()

const savedSession = loadSession()
</script>

<template>
  <div class="deck-selector">
    <h1>SRS Demo</h1>

    <div v-if="savedSession" class="resume-banner">
      <p>You have a saved session for deck <strong>{{ savedSession.deckId }}</strong>.</p>
      <button class="btn-primary" @click="emit('resume')">Resume session</button>
      <button class="btn-secondary" @click="emit('clear')">Clear &amp; start over</button>
    </div>

    <h2>Choose a deck</h2>
    <ul class="deck-list">
      <li v-for="deck in appDecks" :key="deck.id">
        <button class="deck-btn" @click="emit('select', deck.id)">
          <span class="deck-topic">{{ deck.topic }}</span>
          <span class="deck-count">{{ deckToQuizItems(deck).length }} words</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.deck-selector {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
h1 { font-size: 1.8rem; margin-bottom: 8px; }
h2 { font-size: 1.1rem; margin: 24px 0 12px; color: #555; }
.resume-banner {
  background: #f0f7ff;
  border: 1px solid #b3d4ff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}
.resume-banner p { margin: 0 0 12px; }
.btn-primary, .btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-right: 8px;
}
.btn-primary { background: #2563eb; color: white; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover { background: #d1d5db; }
.deck-list { list-style: none; padding: 0; margin: 0; }
.deck-list li { margin-bottom: 10px; }
.deck-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 1rem;
  text-align: left;
}
.deck-btn:hover { border-color: #2563eb; background: #f0f7ff; }
.deck-topic { font-weight: 500; }
.deck-count { color: #6b7280; font-size: 0.85rem; }
</style>
