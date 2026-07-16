<template>
  <CurateAudio :decks="appDecks" @uploaded="refreshDecks" @back="goCuration" />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import type { AppDeckPayload } from '@gll/api-contract';
import CurateAudio from '../components/CurateAudio.vue';
import { ROUTE_NAMES } from '../routeNames';

const appDecks = inject<Ref<AppDeckPayload[]>>('appDecks')!;
const refreshDecks = inject<() => Promise<void>>('refreshDecks')!;
const router = useRouter();

function goCuration() {
  router.push({ name: ROUTE_NAMES.CURATION });
}
</script>
