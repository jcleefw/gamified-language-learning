import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { Context } from 'hono';

type Variables = {
  userId: string | null;
};

export function errorHandler(err: Error, c: Context): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: err.message },
  };
  return c.json(body, 500);
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', cors());

app.use('*', async (c, next) => {
  c.set('userId', null);
  await next();
});

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
