<script setup lang="ts">
defineProps<{
  // Local unlock gate (any word mastered). Distinct from due count.
  reviewUnlocked: boolean;
  // Due-card count from GET /api/reviews; null when unknown (not fetched or fetch failed).
  dueCount: number | null;
  // True when the due-count fetch failed — surfaced instead of a false "0 / caught up".
  badgeError: boolean;
}>();

const emit = defineEmits<{ learn: []; review: [] }>();
</script>

<template>
  <div class="home-dashboard">
    <h1>SRS Demo</h1>
    <p class="subtitle">Choose how you want to study today.</p>

    <div class="mode-cards">
      <button class="mode-card learn-card" @click="emit('learn')">
        <span class="mode-title">Learn</span>
        <span class="mode-desc">Work through decks and master new words.</span>
      </button>

      <button
        class="mode-card review-card"
        :class="{ locked: !reviewUnlocked }"
        :disabled="!reviewUnlocked"
        @click="reviewUnlocked && emit('review')"
      >
        <span class="mode-title">
          Review
          <span
            v-if="reviewUnlocked && !badgeError && dueCount !== null"
            class="review-badge"
            >{{ dueCount }}</span
          >
          <span v-else-if="reviewUnlocked && badgeError" class="review-badge review-badge--error"
            >—</span
          >
          <span v-else class="review-lock">🔒</span>
        </span>
        <span class="mode-desc">
          <template v-if="!reviewUnlocked"
            >Locked until you master a word.</template
          >
          <template v-else-if="badgeError"
            >Couldn't load due count — open to retry.</template
          >
          <template v-else>Revisit words that are due.</template>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-dashboard {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
}
h1 {
  font-size: 1.8rem;
  margin-bottom: 8px;
}
.subtitle {
  color: #6b7280;
  margin: 0 0 24px;
}
.mode-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mode-card {
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
.mode-card:not(.locked):hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.mode-card.locked {
  cursor: not-allowed;
  opacity: 0.65;
  background: #f9fafb;
}
.mode-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: 600;
}
.mode-desc {
  color: #6b7280;
  font-size: 0.9rem;
}
.review-badge {
  padding: 2px 10px;
  background: #2563eb;
  color: white;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
}
.review-badge--error {
  background: #9ca3af;
}
.review-lock {
  font-size: 0.9rem;
}
</style>
