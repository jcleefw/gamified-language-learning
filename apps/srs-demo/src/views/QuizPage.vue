<template>
  <QuizCard
    v-if="learningSession.currentQuestion.value && learningSession.batchState.value"
    :key="learningSession.questionKey.value"
    :question="learningSession.currentQuestion.value"
    :index="learningSession.batchState.value.results.length"
    :total="learningSession.batchState.value.initialCount"
    :active-items="learningSession.activeItems.value"
    :queue="learningSession.queue.value"
    :mastered-deck="learningSession.masteredDeck.value"
    :shelved-items="learningSession.shelvedItems.value"
    :audio="currentQuestionAudio"
    @answered="learningSession.onAnswered"
    @exit="learningSession.onExitBatch"
  />
</template>

<script setup lang="ts">
import { inject, onMounted } from 'vue';
import type { Ref } from 'vue';
import { useRoute } from 'vue-router';
import QuizCard from '../components/QuizCard.vue';
import type { useLearningSession } from '../composables/useLearningSession';
import type { DeckAudio } from '../composables/useAudio';

const learningSession = inject<ReturnType<typeof useLearningSession>>('learningSession')!;
const currentQuestionAudio =
  inject<Ref<(DeckAudio & { sentenceId: string }) | undefined>>('currentQuestionAudio')!;
const route = useRoute();

// Deep-link support: a direct visit to /learn/quiz/:deckId (no prior
// DeckSelectPage selection) arrives with no batch started. Resume that deck's
// session — matches DeckOverview's "start quiz" wiring (initSession(id, false)).
onMounted(() => {
  if (learningSession.batchState.value) return;
  const deckId = route.params.deckId;
  if (typeof deckId === 'string') {
    void learningSession.initSession(deckId, false);
  }
});
</script>
