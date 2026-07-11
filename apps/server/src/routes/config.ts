import { Hono } from 'hono';
import { getDb, SqliteUserConfigStore } from '@gll/db';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import { getAppConfig, type AppConfigResponse } from '../config/learning.js';
import { putConfigSchema } from '../config/config-schema.js';
import { getCurrentUserId } from '../identity/current-user.js';

const router = new Hono();

/**
 * Read-only config surface, resolved per current user (base ← overrides). Clients
 * fetch this at boot and declare no config of their own. `user` (T1) is resolved and
 * writable via PUT; `system` (T3) is fixed and served read-only.
 */
router.get('/user/config', async (c) => {
  const store = new SqliteUserConfigStore(getDb());
  const body: ApiResponse<AppConfigResponse> = {
    success: true,
    data: await getAppConfig(store, getCurrentUserId()),
  };
  return c.json(body);
});

/**
 * T1 write path. Server-side zod validation is the SOLE guard of the
 * preset-name-only invariant (see `config-schema.ts`): unknown keys (T3 fields),
 * deferred/unknown preset names, and out-of-range prefs all 400 with nothing
 * persisted. Forward-only — the write changes future sessions, never past state.
 * On success the freshly-resolved config is returned so the client re-syncs in one
 * round trip.
 */
router.put('/user/config', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  const parsed = putConfigSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: `Invalid config — ${fieldErrors}` },
    };
    return c.json(body, 400);
  }

  const userId = getCurrentUserId();
  const store = new SqliteUserConfigStore(getDb());
  await store.put(userId, parsed.data);

  const body: ApiResponse<AppConfigResponse> = {
    success: true,
    data: await getAppConfig(store, userId),
  };
  return c.json(body);
});

export default router;
