import type { Ref } from 'vue';
import type { ConfigType } from '../types';

// TEST-ONLY (gated by VITE_TEST_HOOKS): the E2E suite injects a sentence-scheduling
// config via GET /api/test/config/sentence to make sentence questions deterministic.
// This endpoint exists only on the test server; the app never touches it in normal
// use. Merges the override onto the already-loaded CONFIG. Non-fatal on failure.
export async function applyTestSentenceConfig(
  CONFIG: Ref<ConfigType>,
): Promise<void> {
  try {
    const res = await fetch('/api/test/config/sentence');
    if (!res.ok) return;
    const body = (await res.json()) as {
      success: boolean;
      data: object | null;
    };
    if (!body.success || !body.data) return;
    const override = body.data as Partial<ConfigType>;
    CONFIG.value = {
      ...CONFIG.value,
      ...override,
      sentenceScheduling: {
        ...CONFIG.value.sentenceScheduling,
        ...override.sentenceScheduling,
      },
      sentenceGraduation: {
        ...CONFIG.value.sentenceGraduation,
        ...override.sentenceGraduation,
      },
    };
  } catch {
    // Non-fatal: fall back to server-provided config.
  }
}
