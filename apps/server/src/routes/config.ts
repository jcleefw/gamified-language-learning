import { Hono } from 'hono';
import type { ApiResponse } from '@gll/api-contract';
import { getAppConfig, type AppConfigResponse } from '../config/learning.js';

const router = new Hono();

/**
 * Read-only config — the single source of truth for the whole config surface,
 * categorized by who may change it (user vs system). Clients fetch this at boot
 * and declare no config of their own. Derived from the server config constants
 * at request time, so changing a constant changes the response with no other
 * edit. Shaped so a future per-user resolver can slot in behind the `user` half.
 */
router.get('/config', (c) => {
  const body: ApiResponse<AppConfigResponse> = {
    success: true,
    data: getAppConfig(),
  };
  return c.json(body);
});

export default router;
