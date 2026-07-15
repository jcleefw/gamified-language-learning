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

// Mirrors App.vue's old `activeNav` computed: which top-level nav tab a route
// belongs to. Exported so App.vue's activeNav can derive from `route.name`
// instead of duplicating this table.
export function navTabOf(name: unknown): 'home' | 'learn' | 'review' | 'curation' {
  if (name === ROUTE_NAMES.HOME) return 'home'
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  if (CURATION_NAMES.includes(name as string)) return 'curation'
  return 'learn' // select | quiz | results | overview
}

// The *target* side of navTo's `targetPhase = target === 'review' ? 'review' : 'learning'`.
// navTo only ever targeted 'home' | 'select' | 'review' (curation bypassed navTo
// entirely — see the early return below) — every non-review target counted as 'learning'.
function targetPhaseOf(name: unknown): Phase {
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  return 'learning'
}

// The *from* side of navTo's `fromPhase = activeNav === 'home' ? null : activeNav === 'review' ? 'review' : 'learning'`.
// Note the asymmetry with targetPhaseOf: 'home' is null only as a *source*
// (leaving home never counts as crossing a phase); curation-as-source falls
// into the 'learning' bucket, same as the original ternary's else-branch.
function fromPhaseOf(name: unknown): Phase | null {
  if (name === ROUTE_NAMES.HOME || name == null) return null
  if (name === ROUTE_NAMES.REVIEW_HUB || name === ROUTE_NAMES.REVIEW_SESSION) return 'review'
  return 'learning'
}

// Composable-internal transitions (batch start/finish, clear, exit-with-empty-batch)
// call `navigate()` too, but they must NOT re-run the confirm/flush/finalize logic
// below — that logic reproduces navTo, which only ever ran for NavMenu-initiated
// clicks. Without this seam, e.g. finishing a quiz batch (quiz -> results) would
// look identical to isMidQuiz to the guard and pop a "Leave this quiz?" confirm on
// every normal batch completion. The `navigate` callback wired up in App.vue calls
// `markInternalNavigation()` immediately before `router.push(...)`.
let skipNextGuard = false

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

    // Original navTo never guarded navigation *into* curation — the NavMenu's
    // Curation tab flips `screen` directly, bypassing navTo. Preserved verbatim;
    // see EP44-ST02 notes for why this (pre-existing) gap isn't closed here.
    if (CURATION_NAMES.includes(to.name as string)) return true

    const { session: learning, apiError } = getLearningSession()
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
