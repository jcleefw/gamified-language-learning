<script setup lang="ts">
import type { QuizItem } from '@gll/srs-engine-v2';

defineProps<{
  activeItems: QuizItem[];
  queue: QuizItem[];
  masteredDeck: QuizItem[];
  masteredGlobal?: QuizItem[];
  shelvedItems?: QuizItem[];
  maxMastery?: number;
}>();
</script>

<template>
  <div class="pool-panel">
    <div class="pool-col">
      <p class="pool-label">Active ({{ activeItems.length }})</p>
      <ul>
        <li v-for="item in activeItems" :key="item.id" class="pool-item">
          <span class="pool-native">{{ item.native }}</span>
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
        <li v-if="activeItems.length === 0" class="pool-empty">—</li>
      </ul>
    </div>
    <div class="pool-col">
      <p class="pool-label">Queue ({{ queue.length }})</p>
      <ul>
        <li v-for="item in queue" :key="item.id" class="pool-item">
          <span class="pool-native">{{ item.native }}</span>
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
        <li v-if="queue.length === 0" class="pool-empty">empty</li>
      </ul>
    </div>
    <div class="pool-col">
      <p class="pool-label">Shelved ({{ shelvedItems?.length ?? 0 }})</p>
      <ul>
        <li
          v-for="item in shelvedItems ?? []"
          :key="item.id"
          class="pool-item"
        >
          <span class="pool-native">{{ item.native }}</span>
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
        <li v-if="!shelvedItems || shelvedItems.length === 0" class="pool-empty">none</li>
      </ul>
    </div>
    <div class="pool-col">
      <p class="pool-label">Mastered ({{ masteredDeck.length }})</p>
      <ul>
        <li v-for="item in masteredDeck" :key="item.id" class="pool-item">
          <span class="pool-native">{{ item.native }}</span>
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
        <li v-if="masteredDeck.length === 0" class="pool-empty">none yet</li>
      </ul>
    </div>
  </div>

  <!-- Test data carrier: hidden from UI; e2e reads .pool-id here -->
  <div class="pool-debug-hidden" style="display: none">
    <div class="pool-section">
      <p class="pool-label">Active</p>
      <ul>
        <li v-for="item in activeItems" :key="item.id">
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
      </ul>
    </div>
    <div class="pool-section">
      <p class="pool-label">Queue</p>
      <ul>
        <li v-for="item in queue" :key="item.id">
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
      </ul>
    </div>
    <div class="pool-section">
      <p class="pool-label">Shelved</p>
      <ul>
        <li v-for="item in shelvedItems ?? []" :key="item.id">
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
      </ul>
    </div>
    <div class="pool-section">
      <p class="pool-label">Mastered</p>
      <ul>
        <li v-for="item in masteredDeck" :key="item.id">
          <span class="pool-id">{{ item.romanization }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.pool-panel {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  padding: 12px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  font-size: 0.78rem;
  color: #6b7280;
}
.pool-col {
  flex: 1;
}
.pool-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pool-panel .pool-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.pool-panel .pool-native {
  font-weight: 500;
  color: #111827;
}
.pool-panel .pool-id {
  color: #9ca3af;
  font-size: 0.7rem;
}
.pool-panel .pool-empty {
  color: #9ca3af;
  font-style: italic;
}
</style>
