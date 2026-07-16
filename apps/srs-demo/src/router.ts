import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES } from './routeNames'
import { registerNavigationGuard } from './router-guards'

export { ROUTE_NAMES }

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('./views/HomePage.vue'),
  },
  {
    path: '/learn/select',
    name: ROUTE_NAMES.DECK_SELECT,
    component: () => import('./views/DeckSelectPage.vue'),
  },
  {
    path: '/learn/quiz/:deckId',
    name: ROUTE_NAMES.QUIZ,
    component: () => import('./views/QuizPage.vue'),
  },
  {
    path: '/learn/results',
    name: ROUTE_NAMES.RESULTS,
    component: () => import('./views/ResultsPage.vue'),
  },
  {
    path: '/learn/overview/:deckId',
    name: ROUTE_NAMES.OVERVIEW,
    component: () => import('./views/OverviewPage.vue'),
  },
  {
    path: '/review',
    name: ROUTE_NAMES.REVIEW_HUB,
    component: () => import('./views/ReviewHubPage.vue'),
  },
  {
    path: '/review/session',
    name: ROUTE_NAMES.REVIEW_SESSION,
    component: () => import('./views/ReviewSessionPage.vue'),
  },
  {
    path: '/curation',
    name: ROUTE_NAMES.CURATION,
    component: () => import('./views/CurationLandingPage.vue'),
    meta: { curationOnly: true },
  },
  {
    path: '/curation/curate',
    name: ROUTE_NAMES.CURATE,
    component: () => import('./views/CurateAudioPage.vue'),
    meta: { curationOnly: true },
  },
  {
    path: '/curation/mark',
    name: ROUTE_NAMES.MARK,
    component: () => import('./views/MarkAudioPage.vue'),
    meta: { curationOnly: true },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

registerNavigationGuard(router)
