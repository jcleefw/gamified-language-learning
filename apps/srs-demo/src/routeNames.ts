// Split out of router.ts so router-guards.ts can import route names without a
// router.ts <-> router-guards.ts import cycle (router.ts registers the guard).
export const ROUTE_NAMES = {
  HOME: 'home',
  DECK_SELECT: 'select',
  QUIZ: 'quiz',
  RESULTS: 'results',
  OVERVIEW: 'overview',
  REVIEW_HUB: 'review-hub',
  REVIEW_SESSION: 'review',
  CURATION: 'curation',
  CURATE: 'curate',
  MARK: 'mark',
} as const
