<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { RunState } from '@gll/srs-engine-v2';
import type { AppDeckPayload, AppWordPayload } from '@gll/api-contract';
import { loadShelvedWords, unshelveWord, resetStagnationCountersForWords } from '../composables/useShelving.js';

const props = defineProps<{
  deck: AppDeckPayload;
  runState: RunState;
  shelvedSet: Set<string>;
  maxMastery: number;
}>();

const emit = defineEmits<{
  back: [];
  startQuiz: [deckId: string];
  unshelveWord: [deckId: string, wordId: string];
}>();

// Index of highlighted sentence (from word click); null = none
const highlightedSentenceIndex = ref<number | null>(null);
const sentenceRefs = ref<HTMLElement[]>([]);

// Local shelved set — union of prop + freshly fetched for this deck
const localShelvedSet = ref<Set<string>>(new Set(props.shelvedSet));

onMounted(async () => {
  try {
    const words = await loadShelvedWords(props.deck.id);
    const ids = new Set(words.map(w => w.wordId));
    localShelvedSet.value = ids;
  } catch {
    // Non-fatal: fall back to prop
  }
});

// Map: wordId → list of sentence indices it appears in
const sentenceWordMap = computed(() => {
  const map = new Map<string, number[]>();
  props.deck.lines.forEach((line, idx) => {
    for (const wordId of line.wordIds) {
      if (!map.has(wordId)) map.set(wordId, []);
      map.get(wordId)!.push(idx);
    }
  });
  return map;
});

// Map: wordId → AppWordPayload
const wordById = computed(() => {
  const map = new Map<string, AppWordPayload>();
  for (const w of props.deck.words) map.set(w.id, w);
  return map;
});

// Words appearing in each sentence line
function lineWords(wordIds: string[]): AppWordPayload[] {
  return wordIds.map(id => wordById.value.get(id)).filter(Boolean) as AppWordPayload[];
}

function onWordClick(wordId: string) {
  const indices = sentenceWordMap.value.get(wordId);
  if (!indices || indices.length === 0) return;
  const targetIdx = indices[0];
  highlightedSentenceIndex.value = targetIdx;
  const el = sentenceRefs.value[targetIdx];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Clear highlight after 1.5s
  setTimeout(() => { highlightedSentenceIndex.value = null; }, 1500);
}

async function onTryNow(wordId: string) {
  // Optimistic: remove from local set immediately
  const next = new Set(localShelvedSet.value);
  next.delete(wordId);
  localShelvedSet.value = next;

  try {
    await Promise.all([
      unshelveWord({ deckId: props.deck.id, wordId }),
      resetStagnationCountersForWords({ deckId: props.deck.id, wordIds: [wordId] }),
    ]);
    emit('unshelveWord', props.deck.id, wordId);
  } catch {
    // Restore on error
    const restored = new Set(localShelvedSet.value);
    restored.add(wordId);
    localShelvedSet.value = restored;
  }
}

function masteryDots(wordId: string): { filled: boolean }[] {
  const ws = props.runState.get(wordId);
  const mastery = ws?.mastery ?? 0;
  return Array.from({ length: props.maxMastery }, (_, i) => ({ filled: i < mastery }));
}
</script>

<template>
  <div class="deck-overview">
    <div class="overview-header">
      <button class="btn-back" @click="emit('back')">← Back</button>
      <h2 class="overview-title">{{ deck.topic }}</h2>
    </div>

    <section class="overview-section">
      <h3 class="section-label">Conversation</h3>
      <div
        v-for="(line, idx) in deck.lines"
        :key="line.sentenceId"
        :ref="(el) => { if (el) sentenceRefs[idx] = el as HTMLElement; }"
        class="sentence-card"
        :class="{ highlighted: highlightedSentenceIndex === idx }"
      >
        <div class="sentence-native">{{ line.native }}</div>
        <div class="sentence-english">{{ line.english }}</div>
        <div class="sentence-words">
          <span
            v-for="word in lineWords(line.wordIds)"
            :key="word.id"
            class="word-chip"
            @click="onWordClick(word.id)"
          >{{ word.native }}</span>
        </div>
      </div>
    </section>

    <section class="overview-section">
      <h3 class="section-label">Words in this deck</h3>
      <table class="word-table">
        <thead>
          <tr>
            <th>Word</th>
            <th>English</th>
            <th>Mastery</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="word in deck.words"
            :key="word.id"
            class="word-row"
            :class="{ 'row-shelved': localShelvedSet.has(word.id) }"
          >
            <td class="word-native" @click="onWordClick(word.id)">{{ word.native }}</td>
            <td>{{ word.english }}</td>
            <td>
              <span class="mastery-dots">
                <span
                  v-for="(dot, i) in masteryDots(word.id)"
                  :key="i"
                  class="dot"
                  :class="{ filled: dot.filled }"
                />
              </span>
            </td>
            <td class="status-cell">
              <template v-if="localShelvedSet.has(word.id)">
                <span class="status-shelved">Shelved</span>
                <button class="btn-try-now" @click="onTryNow(word.id)">Try now</button>
              </template>
              <span v-else class="status-active">Active</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="overview-actions">
      <button class="btn-sentence-learn" disabled>Learn sentence by sentence (coming soon)</button>
      <button class="btn-primary" @click="emit('startQuiz', deck.id)">Start full quiz →</button>
    </div>
  </div>
</template>

<style scoped>
.deck-overview {
  max-width: 560px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
.overview-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.btn-back {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #e5e7eb;
  color: #374151;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}
.btn-back:hover {
  background: #d1d5db;
}
.overview-title {
  font-size: 1.3rem;
  margin: 0;
}
.overview-section {
  margin-bottom: 28px;
}
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
  margin: 0 0 12px;
}
.sentence-card {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: background 0.2s, border-color 0.2s;
}
.sentence-card.highlighted {
  border-color: #2563eb;
  background: #f0f7ff;
}
.sentence-native {
  font-size: 1.05rem;
  font-weight: 500;
  margin-bottom: 4px;
}
.sentence-english {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 8px;
}
.sentence-words {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.word-chip {
  font-size: 0.8rem;
  padding: 2px 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 99px;
  cursor: pointer;
}
.word-chip:hover {
  background: #e5e7eb;
}
.word-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
th,
td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
th {
  color: #6b7280;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
}
.word-native {
  font-weight: 500;
  cursor: pointer;
}
.word-native:hover {
  color: #2563eb;
}
.row-shelved {
  background: #fafafa;
  color: #9ca3af;
}
.mastery-dots {
  display: inline-flex;
  gap: 3px;
  vertical-align: middle;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  display: inline-block;
}
.dot.filled {
  background: #16a34a;
}
.status-shelved {
  font-size: 0.8rem;
  color: #92400e;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: 99px;
}
.status-active {
  font-size: 0.8rem;
  color: #6b7280;
}
.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-try-now {
  padding: 2px 10px;
  font-size: 0.78rem;
  border: 1px solid #d97706;
  border-radius: 99px;
  background: white;
  color: #92400e;
  cursor: pointer;
  white-space: nowrap;
}
.btn-try-now:hover {
  background: #fef3c7;
}
.overview-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.btn-sentence-learn {
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f3f4f6;
  color: #9ca3af;
  font-size: 0.95rem;
  cursor: not-allowed;
}
.btn-primary {
  padding: 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.btn-primary:hover {
  background: #1d4ed8;
}
</style>
