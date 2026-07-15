<template>
  <HomeDashboard
    :due-count="reviewSession.dueReviewCount.value"
    :badge-error="reviewSession.badgeError.value"
    :review-unlocked="reviewSession.reviewUnlocked.value"
    @learn="goLearn"
    @review="goReview"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import HomeDashboard from '../components/HomeDashboard.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useReviewSession } from '../composables/useReviewSession';

const reviewSession = inject<ReturnType<typeof useReviewSession>>('reviewSession')!;
const router = useRouter();

function goLearn() {
  router.push({ name: ROUTE_NAMES.DECK_SELECT });
}
function goReview() {
  router.push({ name: ROUTE_NAMES.REVIEW_HUB });
}
</script>
