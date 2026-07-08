import { Hono } from 'hono';
import type { ApiResponse } from '@gll/api-contract';
import { LEARNING_CONFIG, type LearningConfigResponse } from '../config/learning.js';

const router = new Hono();

/**
 * Read-only learning policy — the single source of truth for the transition
 * thresholds. Clients fetch this at boot and never carry their own copy. The
 * value is derived from LEARNING_CONFIG at request time, so changing the
 * constant changes the response with no other edit. Shaped as "the policy this
 * request should use" so a future per-user resolver can slot in behind it.
 */
router.get('/config', (c) => {
  const body: ApiResponse<LearningConfigResponse> = {
    success: true,
    data: {
      masteryThreshold: LEARNING_CONFIG.masteryThreshold,
      streakThresholds: LEARNING_CONFIG.streakThresholds,
    },
  };
  return c.json(body);
});

export default router;
