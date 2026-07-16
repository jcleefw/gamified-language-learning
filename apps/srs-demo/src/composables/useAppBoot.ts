import type { Ref } from 'vue';
import { type QuizItem, type RunState } from '@gll/srs-engine-v2';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { loadRunState, loadConfig } from './useStore';
import { loadShelvedWords } from './useShelving';
import { applyTestSentenceConfig } from './useTestSentenceConfig';
import { LAST_DECK_KEY } from './useLearningSession';
import { env } from '../env';
import type { ConfigType } from '../types';

export interface AppBootDeps {
  appDecks: Ref<AppDeckPayload[]>;
  wordPool: Ref<QuizItem[]>;
  CONFIG: Ref<ConfigType>;
  configReady: Ref<boolean>;
  apiError: Ref<string | null>;
  hasSavedSession: Ref<boolean>;
  globalRunState: Ref<RunState>;
  deckId: Ref<string | null>;
  shelvedSet: Ref<Set<string>>;
  refreshDueBadge: () => Promise<void>;
  refreshReviewAvailability: () => Promise<void>;
  recalculateCompletedDecks: () => void;
}

/**
 * App.vue's onMounted sequence: fetch decks, build the word pool, load config
 * (fail-closed — no session without it), restore a saved run, refresh the
 * review badge/availability, and restore shelved words for the last deck.
 */
export async function bootApp(deps: AppBootDeps): Promise<void> {
  const {
    appDecks,
    wordPool,
    CONFIG,
    configReady,
    apiError,
    hasSavedSession,
    globalRunState,
    deckId,
    shelvedSet,
    refreshDueBadge,
    refreshReviewAvailability,
    recalculateCompletedDecks,
  } = deps;

  // Fetch decks from API first — required before any other initialisation
  try {
    const decksRes = await fetch('/api/decks');
    if (!decksRes.ok)
      throw new Error(`GET /api/decks failed: ${decksRes.status}`);
    const decksBody = (await decksRes.json()) as {
      success: true;
      data: GetDecksResponse;
    };
    appDecks.value = decksBody.data;

    // Build flat, deduplicated word pool across all decks
    const seen = new Set<string>();
    const pool: QuizItem[] = [];
    for (const deck of appDecks.value) {
      for (const word of deck.words) {
        if (!seen.has(word.id)) {
          seen.add(word.id);
          pool.push(word as QuizItem);
        }
      }
    }
    wordPool.value = pool;
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    return;
  }

  // Config is server-owned — fetch the whole surface before anything reads it
  // (completed-deck detection, session init). Fail closed: no session without it.
  try {
    const cfg = await loadConfig();
    CONFIG.value = { ...cfg.user, ...cfg.system };
    configReady.value = true;
  } catch {
    apiError.value =
      'Could not load learning settings. Please check that the server is running and try again.';
    return;
  }

  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    recalculateCompletedDecks();
    return;
  }
  if (runState.size > 0) {
    hasSavedSession.value = true;
    globalRunState.value = runState;
    deckId.value = localStorage.getItem(LAST_DECK_KEY);
  }

  // Review state at boot: the due-count badge and card availability. Availability
  // (any review card exists) unlocks Review even when nothing is due yet, so a
  // returning user with future-due cards isn't locked out (EP39-BUG01). Both are
  // error-tolerant (badgeError / best-effort) and safe for a brand-new user.
  await Promise.all([refreshDueBadge(), refreshReviewAvailability()]);

  // Load persisted shelved words for the last active deck on mount
  const savedDeckId = localStorage.getItem(LAST_DECK_KEY);
  if (savedDeckId) {
    try {
      const shelvedWords = await loadShelvedWords(savedDeckId);
      shelvedSet.value = new Set(shelvedWords.map((sw) => sw.wordId));
    } catch {
      // Non-fatal: shelving state will be empty
    }
  }

  if (env.testHooks) await applyTestSentenceConfig(CONFIG);

  recalculateCompletedDecks();
}
