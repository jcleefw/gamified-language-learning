import { Hono } from 'hono';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ApiResponse } from '@gll/api-contract';
import { ErrorCode } from '@gll/api-contract';

const router = new Hono();
const DEBUG_DIR = join(process.cwd(), '..', 'srs-demo', 'manual-test-results');

router.post('/debug-logs', async (c) => {
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });

    const body = await c.req.json() as { filename: string; content: string };
    const filepath = join(DEBUG_DIR, body.filename);

    writeFileSync(filepath, body.content, 'utf-8');

    const response: ApiResponse<{ path: string }> = {
      success: true,
      data: { path: filepath },
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
    return c.json(response, 500);
  }
});

export default router;
