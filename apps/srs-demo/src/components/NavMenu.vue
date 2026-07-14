<script setup lang="ts">
defineProps<{
  // Which top-level destination is active: highlights the matching item.
  active: 'home' | 'learn' | 'review' | 'curation';
  // Review unlock gate (any word mastered) — reused from App.vue (ST05).
  reviewUnlocked: boolean;
  // Due-card count for the Review badge; null when unknown (not fetched).
  dueCount: number | null;
  // True when the due-count fetch failed — show a dash rather than a false 0.
  badgeError: boolean;
  // EP43-ST08: the Curation tab replaces the old floating curator toggle
  // buttons — same env.curationMode gate, now surfaced as a nav destination.
  curationMode: boolean;
}>();

const emit = defineEmits<{ home: []; learn: []; review: []; curation: [] }>();
</script>

<template>
  <nav class="nav-menu">
    <span class="nav-brand">SRS Demo</span>
    <ul class="nav-items">
      <li>
        <button
          class="nav-item"
          :class="{ active: active === 'home' }"
          @click="emit('home')"
        >
          Home
        </button>
      </li>
      <li>
        <button
          class="nav-item"
          :class="{ active: active === 'learn' }"
          @click="emit('learn')"
        >
          Learn
        </button>
      </li>
      <li>
        <button
          class="nav-item nav-review"
          :class="{ active: active === 'review', locked: !reviewUnlocked }"
          :disabled="!reviewUnlocked"
          @click="reviewUnlocked && emit('review')"
        >
          Review
          <span
            v-if="reviewUnlocked && !badgeError && dueCount !== null"
            class="nav-badge"
            >{{ dueCount }}</span
          >
          <span
            v-else-if="reviewUnlocked && badgeError"
            class="nav-badge nav-badge--error"
            >—</span
          >
          <span v-else class="nav-lock">🔒</span>
        </button>
      </li>
      <li v-if="curationMode">
        <button
          class="nav-item"
          :class="{ active: active === 'curation' }"
          @click="emit('curation')"
        >
          Curation
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav-menu {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-family: sans-serif;
}
.nav-brand {
  font-weight: 700;
  font-size: 1rem;
  color: #111827;
}
.nav-items {
  display: flex;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
}
.nav-item:not(.locked):hover {
  background: #f0f7ff;
  color: #1d4ed8;
}
.nav-item.active {
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 600;
}
.nav-item.locked {
  cursor: not-allowed;
  color: #9ca3af;
}
.nav-badge {
  padding: 1px 8px;
  background: #2563eb;
  color: white;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}
.nav-badge--error {
  background: #9ca3af;
}
.nav-lock {
  font-size: 0.8rem;
}
</style>
