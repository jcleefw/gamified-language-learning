import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: err.message },
  };
  return c.json(body, 500);
}

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
