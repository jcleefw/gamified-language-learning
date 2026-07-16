<template>
  <BatchResults
    :summary="learningSession.summary.value"
    :batch-score="learningSession.batchScore.value"
    :active-items="learningSession.activeItems.value"
    :queue="learningSession.queue.value"
    :mastered-deck="learningSession.masteredDeck.value"
    :mastered-global="learningSession.masteredGlobal.value"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :next-deck-id="learningSession.nextDeckId.value"
    :shelved-items="learningSession.shelvedItems.value"
    @next="learningSession.onNext"
    @select-deck="goDeckSelect"
    @next-deck="learningSession.onNextDeck"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import BatchResults from '../components/BatchResults.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useLearningSession } from '../composables/useLearningSession';
import type { ConfigType } from '../types';

const learningSession = inject<ReturnType<typeof useLearningSession>>('learningSession')!;
const CONFIG = inject<Ref<ConfigType>>('CONFIG')!;
const router = useRouter();

function goDeckSelect() {
  router.push({ name: ROUTE_NAMES.DECK_SELECT });
}
</script>
