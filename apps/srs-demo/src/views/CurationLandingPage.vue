<template>
  <CurationLanding @curate="goCurate" @mark="goMark" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import CurationLanding from '../components/CurationLanding.vue';
import { ROUTE_NAMES } from '../routeNames';

const router = useRouter();

function goCurate() {
  router.push({ name: ROUTE_NAMES.CURATE });
}
function goMark() {
  router.push({ name: ROUTE_NAMES.MARK });
}
</script>
