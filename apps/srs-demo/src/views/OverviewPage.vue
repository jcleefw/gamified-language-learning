<template>
  <DeckOverview
    v-if="deck"
    :deck="deck"
    :run-state="learningSession.globalRunState.value"
    :shelved-set="learningSession.shelvedSet.value"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :word-pool="wordPool"
    @back="goDeckSelect"
    @start-quiz="(id) => learningSession.initSession(id, false)"
    @unshelve-word="learningSession.onUnshelveWord"
    @update-shelved-set="learningSession.onUpdateShelvedSet"
    @update-word-states="learningSession.onUpdateWordStates"
  />
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AppDeckPayload } from '@gll/api-contract';
import type { QuizItem } from '@gll/srs-engine-v2';
import DeckOverview from '../components/DeckOverview.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useLearningSession } from '../composables/useLearningSession';
import type { ConfigType } from '../types';

const appDecks = inject<Ref<AppDeckPayload[]>>('appDecks')!;
const wordPool = inject<Ref<QuizItem[]>>('wordPool')!;
const CONFIG = inject<Ref<ConfigType>>('CONFIG')!;
const learningSession = inject<ReturnType<typeof useLearningSession>>('learningSession')!;
const route = useRoute();
const router = useRouter();

const deck = computed(() =>
  appDecks.value.find((d) => d.id === route.params.deckId),
);

function goDeckSelect() {
  router.push({ name: ROUTE_NAMES.DECK_SELECT });
}
</script>
