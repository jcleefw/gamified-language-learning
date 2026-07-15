<template>
  <QuizCard
    v-if="reviewSession.reviewQuestion.value && reviewSession.reviewBatchState.value"
    :key="reviewSession.reviewQuestionKey.value"
    :question="reviewSession.reviewQuestion.value"
    :index="reviewSession.reviewBatchState.value.results.length"
    :total="reviewSession.reviewBatchState.value.initialCount"
    :active-items="[]"
    :queue="[]"
    :mastered-deck="[]"
    :feedback-dwell="true"
    :audio="reviewQuestionAudio"
    @answered="reviewSession.onReviewAnswered"
    @exit="goReviewHub"
  />
  <ReviewSummary
    v-else-if="reviewSession.reviewBatchState.value"
    :caught-up="reviewSession.reviewCaughtUp.value"
    :mode="reviewSession.reviewMode.value"
    :reviewed="reviewSession.reviewSummary.value.reviewed"
    :advanced="reviewSession.reviewSummary.value.advanced"
    :next-due="reviewSession.reviewSummary.value.nextDue"
    @home="goReviewHub"
  />
</template>

<script setup lang="ts">
import { inject, onMounted } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QuizCard from '../components/QuizCard.vue';
import ReviewSummary from '../components/ReviewSummary.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useReviewSession } from '../composables/useReviewSession';
import type { DeckAudio } from '../composables/useAudio';

const reviewSession = inject<ReturnType<typeof useReviewSession>>('reviewSession')!;
const reviewQuestionAudio =
  inject<Ref<(DeckAudio & { sentenceId: string }) | undefined>>('reviewQuestionAudio')!;
const route = useRoute();
const router = useRouter();

function goReviewHub() {
  router.push({ name: ROUTE_NAMES.REVIEW_HUB });
}

// Deep-link support: a direct visit (no prior ReviewHubPage click) arrives with
// no batch started. `?mode=` picks the entry point; default 'due' matches the
// hub's primary CTA. A 'stayed' outcome (fetch error) is surfaced via apiError
// elsewhere — nothing further to do here but leave the batch unset.
onMounted(async () => {
  if (reviewSession.reviewBatchState.value) return;
  if (route.query.mode === 'anytime') {
    await reviewSession.onAnytimeReview();
  } else {
    await reviewSession.onReview();
  }
});
</script>
