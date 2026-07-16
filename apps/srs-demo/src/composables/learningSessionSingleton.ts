import type { Ref } from 'vue';
import type { useLearningSession } from './useLearningSession';

// `useLearningSession` is a factory, not a true singleton (it needs App.vue's
// boot-time refs as deps) — but the router guard runs outside the component
// tree, so it can't `inject()` the instance App.vue creates. This module-level
// holder is the one seam that reaches both: App.vue registers the instance it
// creates (plus the `apiError` ref the guard reports failures through), the
// guard reads the same bundle to flush the active batch / surface errors.
export interface LearningSessionBundle {
  session: ReturnType<typeof useLearningSession>;
  apiError: Ref<string | null>;
}

let bundle: LearningSessionBundle | null = null;

export function setLearningSession(b: LearningSessionBundle): void {
  bundle = b;
}

/**
 * The registered learning session bundle, if one has been set.
 *
 * @returns {LearningSessionBundle | null} The bundle, or `null` if
 *   `setLearningSession()` hasn't run yet.
 */
export function getLearningSession(): LearningSessionBundle | null {
  return bundle;
}

/** Test seam: clear the singleton between test files/cases. */
export function resetLearningSessionForTest(): void {
  bundle = null;
}
