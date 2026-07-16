<template>
  <DeckSelector
    :decks="appDecks"
    :has-saved-session="learningSession.hasSavedSession.value"
    :saved-deck-id="learningSession.deckId.value"
    :saved-deck-name="learningSession.savedDeckName.value"
    :completed-deck-ids="learningSession.completedDeckIds.value"
    @select="learningSession.onSelect"
    @resume="learningSession.onResume"
    @clear="learningSession.onClear"
    @overview="goOverview"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import type { AppDeckPayload } from '@gll/api-contract';
import DeckSelector from '../components/DeckSelector.vue';
import { ROUTE_NAMES } from '../routeNames';
import type { useLearningSession } from '../composables/useLearningSession';

const appDecks = inject<Ref<AppDeckPayload[]>>('appDecks')!;
const learningSession = inject<ReturnType<typeof useLearningSession>>('learningSession')!;
const router = useRouter();

function goOverview(deckId: string) {
  router.push({ name: ROUTE_NAMES.OVERVIEW, params: { deckId } });
}
</script>
