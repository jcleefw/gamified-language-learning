<template>
  <ReviewHub
    :review-unlocked="reviewSession.reviewUnlocked.value"
    :due-count="reviewSession.dueReviewCount.value"
    :badge-error="reviewSession.badgeError.value"
    @due="goDue"
    @anytime="goAnytime"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import ReviewHub from '../components/ReviewHub.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useReviewSession } from '../composables/useReviewSession';

const reviewSession = inject<ReturnType<typeof useReviewSession>>('reviewSession')!;
const router = useRouter();

async function goDue() {
  const outcome = await reviewSession.onReview();
  if (outcome === 'entered')
    router.push({ name: ROUTE_NAMES.REVIEW_SESSION, query: { mode: 'due' } });
}

async function goAnytime() {
  const outcome = await reviewSession.onAnytimeReview();
  if (outcome === 'entered')
    router.push({ name: ROUTE_NAMES.REVIEW_SESSION, query: { mode: 'anytime' } });
}
</script>
