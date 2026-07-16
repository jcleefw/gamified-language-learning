import type { Router } from 'vue-router'
import { ROUTE_NAMES } from './routeNames'
import { env } from './env'
import {
  useDebugRecording,
  finalizeRecordingOnNav,
  crossesPhaseOrMidQuiz,
  type Phase,
} from './composables/useDebugRecording'
import { getLearningSession } from './composables/learningSessionSingleton'

declare module 'vue-router' {
  interface RouteMeta {
    curationOnly?: boolean
  }
}

const CURATION_NAMES: string[] = [
  ROUTE_NAMES.CURATION,
  ROUTE_NAMES.CURATE,
  ROUTE_NAMES.MARK,
]

/**
 * Which top-level nav tab a route belongs to.
 *
 * @param {unknown} name - The route's `name` (typically a `RouteLocation.name`).
 * @returns {'home' | 'learn' | 'review' | 'curation'} The nav tab that owns this route.
 */
export function navTabOf(name: unknown): 'home' | 'learn' | 'review' | 'curation' {
  if (name === ROUTE_NAMES.HOME) return 'home'
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  if (CURATION_NAMES.includes(name as string)) return 'curation'
  return 'learn' // select | quiz | results | overview
}

/**
 * The learning phase a navigation is heading into.
 *
 * @param {unknown} name - The destination route's `name`.
 * @returns {Phase} `'review'` for review routes, `'learning'` otherwise.
 */
function targetPhaseOf(name: unknown): Phase {
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  return 'learning'
}

/**
 * The learning phase a navigation is leaving from.
 *
 * @param {unknown} name - The source route's `name`.
 * @returns {Phase | null} `null` when leaving home (no phase to cross), `'review'`
 *   for review routes, `'learning'` otherwise.
 */
function fromPhaseOf(name: unknown): Phase | null {
  if (name === ROUTE_NAMES.HOME || name == null) return null
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  return 'learning'
}

/**
 * Skips the next `beforeEach` guard's confirm/flush/finalize logic.
 *
 * Call before navigations that are internal to a composable (batch
 * start/finish, clear, exit-with-empty-batch) so they don't trigger the
 * "Leave this quiz?" confirmation meant only for user-initiated nav clicks.
 */
let skipNextGuard = false

/** Marks the upcoming router navigation as internal; see `skipNextGuard`. */
export function markInternalNavigation(): void {
  skipNextGuard = true
}

export function registerNavigationGuard(router: Router): void {
  router.beforeEach(async (to, from) => {
    if (to.meta.curationOnly && !env.curationMode) {
      return { name: ROUTE_NAMES.HOME }
    }

    if (skipNextGuard) {
      skipNextGuard = false
      return true
    }

    // Curation navigation is intentionally unguarded (no confirm/flush/finalize).
    if (CURATION_NAMES.includes(to.name as string)) return true

    const registered = getLearningSession()
    if (!registered) return true
    const { session: learning, apiError } = registered
    const recorder = useDebugRecording()

    const targetPhase = targetPhaseOf(to.name)
    const fromPhase = fromPhaseOf(from.name)
    const isMidQuiz = from.name === ROUTE_NAMES.QUIZ && to.name !== ROUTE_NAMES.QUIZ

    if (crossesPhaseOrMidQuiz(fromPhase, targetPhase, isMidQuiz)) {
      const message = recorder.isRecording.value
        ? 'Finish and download the recording before leaving? Cancel to stay and keep recording.'
        : 'Leave this quiz? Your progress so far will be saved. Cancel to keep going.'
      if (!window.confirm(message)) return false // stay; recording (if any) continues
    }

    if (isMidQuiz && (learning.batchState.value?.results.length ?? 0) > 0) {
      await learning.finishBatchAndTransition() // persists the answered results
    }

    const finalizeOutcome = await finalizeRecordingOnNav(recorder, targetPhase, isMidQuiz)
    if (finalizeOutcome === 'failed') {
      apiError.value =
        'Could not assemble the recording before navigating. Your recording is still active — please check the server and try again.'
      return false
    }

    return true
  })
}
