<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  // True when there was nothing due on entry (caught-up state, no session run).
  caughtUp: boolean;
  // Number of cards reviewed this session.
  reviewed: number;
  // Nearest next-due ISO date across the cards advanced this session; null if none.
  nextDue: string | null;
}>();

const emit = defineEmits<{ home: [] }>();

// Human horizon for the next-due date. Derived from the server-returned `due`s
// (no extra fetch); the client never computes a schedule of its own.
const nextDueLabel = computed(() => {
  if (!props.nextDue) return null;
  const due = new Date(props.nextDue);
  if (Number.isNaN(due.getTime())) return null;
  const ms = due.getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
});
</script>

<template>
  <div class="review-summary">
    <template v-if="caughtUp">
      <div class="caught-up">
        <p class="caught-up-msg">All caught up — nothing due! 🎉</p>
        <p class="caught-up-sub">Check back later for more reviews.</p>
      </div>
    </template>

    <template v-else>
      <h2 class="score">Review complete</h2>
      <p class="summary-line">
        You reviewed <strong>{{ reviewed }}</strong>
        {{ reviewed === 1 ? 'word' : 'words' }}.
      </p>
      <p v-if="nextDueLabel" class="summary-line next-due">
        Next review due <strong>{{ nextDueLabel }}</strong>.
      </p>
    </template>

    <div class="summary-actions">
      <button class="btn-primary" @click="emit('home')">Back to home</button>
    </div>
  </div>
</template>

<style scoped>
.review-summary {
  max-width: 480px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: sans-serif;
  text-align: center;
}
.score {
  font-size: 1.6rem;
  margin-bottom: 16px;
}
.summary-line {
  font-size: 1.05rem;
  color: #374151;
  margin: 0 0 8px;
}
.next-due {
  color: #6b7280;
}
.caught-up {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  padding: 28px 20px;
  margin-bottom: 24px;
}
.caught-up-msg {
  font-size: 1.3rem;
  font-weight: 600;
  color: #15803d;
  margin: 0 0 8px;
}
.caught-up-sub {
  color: #6b7280;
  margin: 0;
}
.summary-actions {
  margin-top: 24px;
}
.btn-primary {
  padding: 10px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
}
.btn-primary:hover {
  background: #1d4ed8;
}
</style>
